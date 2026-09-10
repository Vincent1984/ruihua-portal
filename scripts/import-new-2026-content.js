require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { slugify } = require('transliteration');

const Case = require('../models/Case');
const Article = require('../models/Article');

const ROOT = path.join(__dirname, '..');
const CASES_PATH = path.join(ROOT, 'new', 'rh-site', 'content', 'cases.json');
const ARTICLES_PATH = path.join(ROOT, 'new', 'rh-site', 'content', 'articles.json');

// 幂等导入：按唯一键 upsert，仅 $setOnInsert 写入初始内容，不覆盖后台已有改动
async function upsertOnInsert(Model, filter, doc) {
  const result = await Model.updateOne(
    filter,
    { $setOnInsert: doc },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return result.upsertedCount ? 'created' : 'skipped';
}

// 稳定兜底 slug（transliteration 对纯中文也能产出拼音，兜底用 md5 保证确定性）
function genSlug(title) {
  const s = slugify(String(title || ''), { separator: '-' })
    .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return s || `article-${crypto.createHash('md5').update(String(title || '')).digest('hex').slice(0, 8)}`;
}

// 内容状态映射：cases.json 无此字段；articles.json 的 state=full/guide/soon → full/toc/soon
function mapContentStatus(state) {
  if (state === 'guide') return 'toc'; // 章节导读（只有 outline 无正文）
  if (state === 'soon') return 'soon';
  return 'full';
}

// outline（[{t, pts}]）→ HTML，用于「章节导读」类文章
function outlineToHtml(outline) {
  if (!Array.isArray(outline) || !outline.length) return '';
  return outline.map(s => {
    const pts = (s.pts || []).map(p => `<li>${p}</li>`).join('');
    return `<h3>${s.t}</h3>${pts ? `<ul>${pts}</ul>` : ''}`;
  }).join('\n');
}

// cases.json 行 → Case 文档
function mapCase(row) {
  return {
    title: row.title,
    slug: row.slug,
    industry: row.ind || '其他',
    tags: Array.isArray(row.tags) ? row.tags : [],
    background: row.bg || '',
    problems: Array.isArray(row.prob) ? row.prob : [],
    goals: Array.isArray(row.goal) ? row.goal : [],
    solutions: Array.isArray(row.sol) ? row.sol : [],
    resultTags: Array.isArray(row.resBody) ? row.resBody : [],
    stats: (Array.isArray(row.stats) ? row.stats : []).map(([value, label]) => ({ label, value })),
    status: 'published',
    isOnline: true,
    order: typeof row.id === 'number' ? row.id : 0
  };
}

// articles.json industry 行 → Article 文档
function mapIndustryArticle(row) {
  const content = (row.body && row.body.trim())
    ? row.body
    : outlineToHtml(row.outline);
  return {
    title: row.title,
    slug: row.slug,
    zone: 'industry',
    category: row.cat || '行业洞察',
    contentStatus: mapContentStatus(row.state),
    isOnline: true,
    summary: row.abstract || '',
    content,
    author: {
      name: row.aname || row.author || '',
      avatar: row.aimg || '',
      desc: row.atitle || '',
      detail: row.abio || ''
    },
    publishDate: row.pub ? new Date(row.pub) : new Date(),
    status: 'published',
    views: parseInt(row.views, 10) || 0
  };
}

// articles.json thinktank 行 → Article 文档（「即将发布」不入正式列表，仅入库备查）
function mapThinktankArticle(row) {
  return {
    title: row.title,
    slug: genSlug(row.title),
    zone: 'thinktank',
    category: row.cat || '方法论',
    contentStatus: 'soon',
    isOnline: true,
    summary: row.desc || '',
    publishDate: row.date ? new Date(row.date) : new Date(),
    status: 'draft'
  };
}

async function run() {
  const cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  const articlesJson = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
  const industry = Array.isArray(articlesJson.industry) ? articlesJson.industry : [];
  const thinktank = Array.isArray(articlesJson.thinktank) ? articlesJson.thinktank : [];

  const stat = { cases: { created: 0, skipped: 0 }, articles: { created: 0, skipped: 0 }, thinktank: { created: 0, skipped: 0 } };

  for (const row of cases) {
    if (!row.slug) continue;
    const r = await upsertOnInsert(Case, { slug: row.slug }, mapCase(row));
    stat.cases[r]++;
  }

  for (const row of industry) {
    if (!row.slug) continue;
    const r = await upsertOnInsert(Article, { slug: row.slug }, mapIndustryArticle(row));
    stat.articles[r]++;
  }

  for (const row of thinktank) {
    const slug = genSlug(row.title);
    const r = await upsertOnInsert(Article, { slug }, mapThinktankArticle(row));
    stat.thinktank[r]++;
  }

  return stat;
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/ruihua_cms';
  await mongoose.connect(mongoUrl);
  const result = await run();
  console.log(JSON.stringify(result));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(err => { console.error('导入失败:', err); process.exit(1); });
}

module.exports = { run, mapCase, mapIndustryArticle, mapThinktankArticle, genSlug };
