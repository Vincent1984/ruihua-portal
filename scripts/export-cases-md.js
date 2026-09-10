const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'exports', 'cases-sync-20260910', 'cases-payload-as-is.json');
const OUT_DIR = path.join(ROOT, 'exports', 'cases-md');

function md(value) {
  return String(value == null ? '' : value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function safeName(value) {
  const s = String(value || '').trim().replace(/[\\/:*?"<>|\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, 60) || 'case';
}

function bullets(items, mapFn) {
  const arr = (items || []).map(x => md(mapFn ? mapFn(x) : x)).filter(Boolean);
  return arr.map(x => `- ${x}`).join('\n');
}

function section(title, body) {
  return body ? `## ${title}\n\n${body}\n` : '';
}

function buildMarkdown(c) {
  const out = [];
  out.push(`# ${md(c.title) || '未命名案例'}`);
  out.push('');

  const meta = [];
  if (c.industry) meta.push(`**行业**：${md(c.industry)}`);
  if (c.client) meta.push(`**客户**：${md(c.client)}`);
  if ((c.tags || []).length) meta.push(`**标签**：${c.tags.map(md).join('、')}`);
  if (meta.length) {
    out.push(meta.join('  \n'));
    out.push('');
  }

  const stats = (c.stats || []).filter(s => s && (s.label || s.value));
  if (stats.length) {
    out.push('## 核心指标');
    out.push('');
    out.push(stats.map(s => `| ${md(s.label)} | ${md(s.value)} |`).join('\n'));
    out.push('');
  }

  out.push(section('项目背景', md(c.background)));
  out.push(section('遇到的问题', bullets(c.problems)));
  out.push(section('希望实现的目标', bullets(c.goals)));
  out.push(section('解决方案', bullets(c.solutions)));
  out.push(section('带来的结果', bullets(c.resultTags)));

  out.push('---');
  out.push('');
  if (c.slug) out.push(`官网链接：https://www.ruihuaconsulting.com/cases/${encodeURIComponent(c.slug)}`);
  if (c.seo && c.seo.title) out.push(`SEO 标题：${md(c.seo.title)}`);
  if (c.seo && c.seo.description) out.push(`SEO 描述：${md(c.seo.description)}`);
  if (c.seo && c.seo.keywords) out.push(`SEO 关键词：${md(c.seo.keywords)}`);
  out.push('');
  return out.filter(x => x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('找不到源文件：' + SRC);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const cases = Array.isArray(raw) ? raw : (raw.cases || []);

  if (!cases.length) {
    console.log('源文件里没有案例。');
    process.exit(0);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const used = new Set();
  cases.forEach((c, i) => {
    const prefix = String(i + 1).padStart(2, '0');
    let base = safeName(c.slug || c.title);
    let name = `${prefix}-${base}.md`;
    let n = 2;
    while (used.has(name)) {
      name = `${prefix}-${base}-${n}.md`;
      n++;
    }
    used.add(name);
    fs.writeFileSync(path.join(OUT_DIR, name), buildMarkdown(c), 'utf8');
    console.log(`✓ ${name}`);
  });

  console.log(`\n完成：共导出 ${cases.length} 个案例 → ${OUT_DIR}`);
}

main();
