const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ quiet: true });

const Case = require('../models/Case');

const ROOT = path.join(__dirname, '..');

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toPayload(row) {
  return {
    title: row.title || '',
    slug: row.slug || '',
    industry: row.industry || '',
    client: row.client || '',
    cover: row.cover || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    background: row.background || '',
    problems: Array.isArray(row.problems) ? row.problems : [],
    goals: Array.isArray(row.goals) ? row.goals : [],
    solutions: Array.isArray(row.solutions) ? row.solutions : [],
    resultTags: Array.isArray(row.resultTags) ? row.resultTags : [],
    stats: Array.isArray(row.stats)
      ? row.stats.map(item => ({ label: item.label || '', value: item.value || '' }))
      : [],
    featured: Boolean(row.featured),
    featuredOrder: Number(row.featuredOrder) || 0,
    order: Number(row.order) || 0,
    isOnline: row.isOnline !== false,
    status: row.status || 'draft',
    seo: row.seo && typeof row.seo === 'object'
      ? {
          title: row.seo.title || '',
          description: row.seo.description || '',
          keywords: row.seo.keywords || ''
        }
      : { title: '', description: '', keywords: '' }
  };
}

function toDraftPayload(row) {
  return {
    ...row,
    featured: false,
    featuredOrder: 0,
    isOnline: false,
    status: 'draft'
  };
}

function countBy(rows, key) {
  return rows.reduce((result, row) => {
    const value = row[key] || '(empty)';
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function resolveLocalCover(cover) {
  if (!cover || /^(?:https?:|data:)/i.test(cover)) return null;
  const relative = cover.split(/[?#]/, 1)[0].replace(/^\/+/, '');
  if (!relative.startsWith('images/') && !relative.startsWith('uploads/')) return null;
  return { relative, absolute: path.join(ROOT, 'public', relative) };
}

async function main() {
  const outputName = getArg('output', `exports/cases-sync-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  const outputDir = path.resolve(ROOT, outputName);
  if (!outputDir.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error('输出目录必须位于项目目录内');
  }
  if (fs.existsSync(outputDir)) {
    throw new Error(`输出目录已存在，为避免覆盖已停止：${outputDir}`);
  }

  const mongoUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/ruihua_cms';
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });

  try {
    const sourceRows = await Case.find({}).sort({ order: 1, createdAt: 1 }).lean();
    const payload = sourceRows.map(toPayload);
    const draftPayload = payload.map(toDraftPayload);
    const slugs = payload.map(item => item.slug);
    const duplicateSlugs = [...new Set(slugs.filter((slug, index) => slug && slugs.indexOf(slug) !== index))];
    const validation = {
      missingTitle: payload.filter(item => !item.title).map(item => item.slug || '(no slug)'),
      missingSlug: payload.filter(item => !item.slug).map(item => item.title || '(no title)'),
      duplicateSlugs,
      invalidStatus: payload.filter(item => !['draft', 'published', 'archived'].includes(item.status)).map(item => item.slug)
    };

    fs.mkdirSync(outputDir, { recursive: true });

    const sourceSnapshot = sourceRows.map((row, index) => ({
      sourceId: String(row._id),
      sourceCreatedAt: row.createdAt || null,
      sourceUpdatedAt: row.updatedAt || null,
      syncOrder: index + 1,
      ...payload[index]
    }));
    const sourceJson = json(sourceSnapshot);
    const payloadJson = json(payload);
    const draftJson = json(draftPayload);
    fs.writeFileSync(path.join(outputDir, 'cases-source-snapshot.json'), sourceJson, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'cases-payload-as-is.json'), payloadJson, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'cases-payload-draft.json'), draftJson, 'utf8');

    const csvHeaders = ['order', 'title', 'slug', 'industry', 'status', 'isOnline', 'featured', 'featuredOrder', 'cover'];
    const csvRows = payload.map(item => csvHeaders.map(key => csvCell(item[key])).join(','));
    fs.writeFileSync(
      path.join(outputDir, 'cases-summary.csv'),
      `\ufeff${csvHeaders.join(',')}\n${csvRows.join('\n')}\n`,
      'utf8'
    );

    const media = [];
    for (const item of payload) {
      const local = resolveLocalCover(item.cover);
      if (!local) continue;
      const bundledPath = path.join('assets', 'public', local.relative);
      const destination = path.join(outputDir, bundledPath);
      const exists = fs.existsSync(local.absolute);
      if (exists) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(local.absolute, destination);
      }
      media.push({ slug: item.slug, original: item.cover, bundledPath: exists ? bundledPath : null, exists });
    }

    const manifest = {
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      source: {
        database: mongoose.connection.name,
        collection: Case.collection.collectionName
      },
      syncKey: 'slug',
      counts: {
        total: payload.length,
        byStatus: countBy(payload, 'status'),
        byIndustry: countBy(payload, 'industry'),
        online: payload.filter(item => item.isOnline).length,
        featured: payload.filter(item => item.featured).length,
        withCover: payload.filter(item => item.cover).length,
        bundledCoverFiles: media.filter(item => item.exists).length,
        missingLocalCoverFiles: media.filter(item => !item.exists).length
      },
      validation,
      files: {
        sourceSnapshot: { name: 'cases-source-snapshot.json', sha256: sha256(sourceJson) },
        productionStatePayload: { name: 'cases-payload-as-is.json', sha256: sha256(payloadJson) },
        safeDraftPayload: { name: 'cases-payload-draft.json', sha256: sha256(draftJson) },
        summary: { name: 'cases-summary.csv' }
      },
      media
    };
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), json(manifest), 'utf8');

    const readme = `# 案例同步资料包\n\n` +
      `生成时间：${manifest.generatedAt}\n\n` +
      `- 案例数量：${payload.length}\n` +
      `- 同步键：\`slug\`\n` +
      `- 推荐首次导入文件：\`cases-payload-draft.json\`\n` +
      `- 保持本地状态文件：\`cases-payload-as-is.json\`\n` +
      `- 原始审计快照：\`cases-source-snapshot.json\`\n` +
      `- 人工核对清单：\`cases-summary.csv\`\n` +
      `- 完整性与校验信息：\`manifest.json\`\n\n` +
      `安全同步建议：先读取生产案例并按 slug 比对；默认只新增，冲突不覆盖；先导入草稿，检查页面后再发布；不自动删除生产数据。\n`;
    fs.writeFileSync(path.join(outputDir, 'README.md'), readme, 'utf8');

    const hasErrors = Object.values(validation).some(items => items.length > 0);
    console.log(JSON.stringify({ outputDir, total: payload.length, media: media.length, validation, ready: !hasErrors }));
    if (hasErrors) process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
