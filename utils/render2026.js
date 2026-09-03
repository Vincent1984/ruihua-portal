/**
 * 2026 版页面渲染辅助
 *
 * 复用现有 SSR 思路：读取 views/2026/base.html 模板，注入公共骨架 partial
 * （nav / mobile-nav / footer / drawer）与页面内容、标题、描述。
 *
 * 用法：
 *   const { render2026 } = require('./utils/render2026');
 *   res.send(render2026({ title, description, content }));
 *
 * partial 与模板均带内存缓存；生产环境只读一次。开发环境可用 clearCache() 重载。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'views', '2026', 'base.html');
const PARTIAL_DIR = path.join(ROOT, 'views', '2026', 'partials');

let _cache = null;
let _globalConfigCache = null;

async function reloadGlobalConfig() {
  try {
    const GlobalConfig = require('../models/GlobalConfig');
    const doc = await GlobalConfig.findOne({ key: 'website' }).lean();
    if (doc) {
      _globalConfigCache = {
        tel: doc.tel || '400-175-0886',
        mail: doc.mail || 'rxzj@renruihr.com',
        icp: doc.icp || '沪ICP备12042344号-24',
        cities: Array.isArray(doc.cities) && doc.cities.length ? doc.cities.join(' · ') : '上海 · 北京 · 深圳 · 成都',
        qr: doc.qr || 'data:image/jpeg;base64,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'
      };
    }
  } catch (e) {
    console.error('Failed to reload global config:', e);
  }
}
// Initial load (will be ready quickly after server starts)
reloadGlobalConfig();


// 行业 hash → 英文语义分类 URL
const INDUSTRY_MAP = {
  manufacturing: '制造业', retail: '零售快消', finance: '金融财税',
  education: '教育', game: '游戏文娱', trade: '贸易物流',
  property: '物业地产', other: '其他'
};

// 将 SPA 的 hash 路由链接改写为真实 URL（href 与 onclick location.hash 均处理）
function rewriteLinks(html) {
  if (!html) return html;
  // 案例行业：#/cases/manufacturing → /cases/industry/manufacturing
  html = html.replace(/href="#\/cases\/([a-z]+)"/g, (m, key) => {
    return INDUSTRY_MAP[key] ? `href="/cases/industry/${key}"` : 'href="/cases"';
  });
  // solutions 子路由：#/solutions/training → /solutions/training
  html = html.replace(/href="#\/solutions\/([a-z]+)"/g, 'href="/solutions/$1"');
  // 其余 href="#/xxx" → href="/xxx"（根 #/ → /）
  html = html.replace(/href="#\/([^"]*)"/g, (m, rest) => `href="/${rest}"`);

  // onclick="location.hash='#/xxx'" → location.href='/xxx'（页面块里的卡片点击）
  html = html.replace(/location\.hash\s*=\s*'#\/cases\/([a-z]+)'/g, (m, key) => {
    return INDUSTRY_MAP[key] ? `location.href='/cases/industry/${key}'` : "location.href='/cases'";
  });
  html = html.replace(/location\.hash\s*=\s*'#\/solutions\/([a-z]+)'/g, "location.href='/solutions/$1'");
  html = html.replace(/location\.hash\s*=\s*'#\/([^']*)'/g, (m, rest) => `location.href='/${rest}'`);
  return html;
}

function loadCache() {
  if (_cache) return _cache;
  const read = (p) => fs.readFileSync(p, 'utf8');
  _cache = {
    base: read(BASE),
    nav: rewriteLinks(read(path.join(PARTIAL_DIR, 'nav.html'))),
    mobileNav: rewriteLinks(read(path.join(PARTIAL_DIR, 'mobile-nav.html'))),
    footer: rewriteLinks(read(path.join(PARTIAL_DIR, 'footer.html'))),
    drawer: read(path.join(PARTIAL_DIR, 'drawer.html')),
  };
  return _cache;
}

function clearCache() {
  _cache = null;
  reloadGlobalConfig();
}

function getPublicShell(activePath = '') {
  const c = loadCache();
  return {
    nav: markActive(c.nav, activePath),
    mobileNav: markActive(c.mobileNav, activePath),
    footer: c.footer,
    drawer: c.drawer
  };
}

/** 简单占位符替换（值中若含 $ 特殊字符也安全） */
function fill(tpl, marker, value) {
  return tpl.split(marker).join(value != null ? String(value) : '');
}

function escAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function markActive(html, activePath) {
  if (!activePath) return html;
  const key = activePath === '/' ? 'home'
    : activePath.startsWith('/about') ? 'about'
    : activePath.startsWith('/solutions') || activePath === '/hcvm' ? 'solutions'
    : activePath.startsWith('/cases') ? 'cases'
    : activePath.startsWith('/insights') ? 'insights'
    : activePath.startsWith('/contact') ? 'contact' : '';
  return key ? html.replace(/<a([^>]*)>/g, (match, attrs) => {
    if (!new RegExp('data-nav-key="' + key + '"').test(attrs) || /class="[^"]*\\bact\\b/.test(attrs)) return match;
    return /class="[^"]*"/.test(attrs)
      ? match.replace(/class="([^"]*)"/, 'class="$1 act"')
      : '<a' + attrs + ' class="act">';
  }) : html;
}

// 读取并缓存页面块（views/2026/page-blocks/<key>.html），已做链接改写
const BLOCK_DIR = path.join(ROOT, 'views', '2026', 'page-blocks');
const _blockCache = {};
function loadBlock(key) {
  if (key in _blockCache) return _blockCache[key];
  const p = path.join(BLOCK_DIR, `${key}.html`);
  let html = fs.existsSync(p) ? rewriteLinks(fs.readFileSync(p, 'utf8')) : '';
  // .page 块在多页 SSR 下需带 on 类才显示（route() 不再切换）
  html = html.replace(/^(<div class="page)"/, '$1 on"');
  _blockCache[key] = html;
  return html;
}

/**
 * @param {object} opts
 * @param {string} opts.title        页面标题
 * @param {string} [opts.description] meta description
 * @param {string} opts.content      页面主体 HTML（已是最终 HTML，原样注入）
 * @param {string} [opts.preScript]  引擎脚本之前注入的内联脚本（如 window.__CASES__）
 */
function render2026({ title = '瑞华智策', description = '', keywords = '', canonical = '', image = '', type = 'website', structuredData = null, content = '', preScript = '', activePath = '', publishedTime = '', modifiedTime = '' } = {}) {
  const c = loadCache();
  const iso = (v) => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  };
  const pub = iso(publishedTime);
  const mod = iso(modifiedTime);
  const seoMeta = [
    keywords ? `<meta name="keywords" content="${escAttr(keywords)}" />` : '',
    canonical ? `<link rel="canonical" href="${escAttr(canonical)}" />` : '',
    `<meta property="og:type" content="${escAttr(type)}" />`,
    '<meta property="og:site_name" content="瑞华智策" />',
    '<meta property="og:locale" content="zh_CN" />',
    `<meta property="og:title" content="${escAttr(title)}" />`,
    `<meta property="og:description" content="${escAttr(description)}" />`,
    canonical ? `<meta property="og:url" content="${escAttr(canonical)}" />` : '',
    image ? `<meta property="og:image" content="${escAttr(image)}" />` : '',
    '<meta name="twitter:card" content="summary_large_image" />',
    pub ? `<meta property="article:published_time" content="${escAttr(pub)}" />` : '',
    mod ? `<meta property="article:modified_time" content="${escAttr(mod)}" />` : ''
  ].filter(Boolean).join('\n    ');
  const pageUrl = canonical || 'https://www.ruihuaconsulting.com/';
  const baseStructuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://www.ruihuaconsulting.com/#organization',
      name: '瑞华智策',
      url: 'https://www.ruihuaconsulting.com/'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': 'https://www.ruihuaconsulting.com/#website',
      name: '瑞华智策',
      url: 'https://www.ruihuaconsulting.com/',
      publisher: { '@id': 'https://www.ruihuaconsulting.com/#organization' }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      name: title,
      description,
      url: pageUrl,
      isPartOf: { '@id': 'https://www.ruihuaconsulting.com/#website' },
      about: { '@id': 'https://www.ruihuaconsulting.com/#organization' }
    }
  ];
  const pageStructuredData = structuredData ? (Array.isArray(structuredData) ? structuredData : [structuredData]) : [];
  const structured = `<script type="application/ld+json">${safeJson([...baseStructuredData, ...pageStructuredData])}</script>`;
  let html = c.base;
  html = fill(html, '<!--TITLE-->', escAttr(title));
  html = fill(html, '<!--DESCRIPTION-->', escAttr(description));
  html = fill(html, '<!--SEO_META-->', seoMeta);
  html = fill(html, '<!--STRUCTURED_DATA-->', structured);
  html = fill(html, '<!--NAV-->', markActive(c.nav, activePath));
  html = fill(html, '<!--MOBILE_NAV-->', markActive(c.mobileNav, activePath));
  html = fill(html, '<!--FOOTER-->', c.footer);
  html = fill(html, '<!--DRAWER-->', c.drawer);
  html = fill(html, '<!--CONTENT-->', content);
  html = fill(html, '<!--PRESCRIPT-->', preScript ? `<script>${preScript}</script>` : '');
  
  if (_globalConfigCache) {
    html = fill(html, '<!--CONFIG_TEL-->', escAttr(_globalConfigCache.tel));
    html = fill(html, '<!--CONFIG_MAIL-->', escAttr(_globalConfigCache.mail));
    html = fill(html, '<!--CONFIG_ICP-->', escAttr(_globalConfigCache.icp));
    html = fill(html, '<!--CONFIG_CITIES-->', escAttr(_globalConfigCache.cities));
    html = fill(html, '<!--CONFIG_QR-->', escAttr(_globalConfigCache.qr));
  }
  
  return html;
}

module.exports = { render2026, clearCache, loadBlock, reloadGlobalConfig, getPublicShell };
