const Case = require('../models/Case');
const Article = require('../models/Article');
const Faq = require('../models/Faq');
const { render2026, loadBlock } = require('../utils/render2026');

// 2026 版前台多页 SSR 路由：首页 / 案例列表 / 案例详情
// 挂载：require('./routes/frontendRoutes2026')(app);

const INDS = ['全部', '制造业', '教育', '零售快消', '游戏文娱', '金融财税', '贸易物流', '物业地产', '其他'];
const INDUSTRY_SLUGS = {
  '制造业': 'manufacturing', '教育': 'education', '零售快消': 'retail',
  '游戏文娱': 'game', '金融财税': 'finance', '贸易物流': 'trade',
  '物业地产': 'property', '其他': 'other'
};
const SLUG_INDUSTRIES = Object.fromEntries(Object.entries(INDUSTRY_SLUGS).map(([industry, slug]) => [slug, industry]));
const industrySlugOf = industry => INDUSTRY_SLUGS[industry] || 'other';
const INSIGHT_CATEGORY_SLUGS = {
  'CIO 数智化转型智库': 'cio-digital-transformation',
  'CEO 经营增长智库': 'ceo-growth',
  'CHO 人效提升智库': 'cho-workforce-efficiency'
};
const SLUG_INSIGHT_CATEGORIES = Object.fromEntries(Object.entries(INSIGHT_CATEGORY_SLUGS).map(([category, slug]) => [slug, category]));
const absoluteUrl = value => {
  const raw = String(value || '');
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://www.ruihuaconsulting.com${raw.startsWith('/') ? raw : `/${raw}`}`;
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function notFound(res) {
  res.status(404).send(render2026({
    title: '页面未找到 · 404 | 瑞华智策',
    description: '您访问的页面不存在或已被移动，返回首页继续浏览。',
    content: loadBlock('404')
  }));
}

// DB 案例 → 设计稿 CASE_DB 结构（供 window.__CASES__ 注入，引擎 renderCases/openCase 直接消费）
function toCaseDB(c) {
  return {
    ind: c.industry || '其他',
    title: c.title || '',
    tags: Array.isArray(c.tags) ? c.tags : [],
    bg: c.background || '',
    prob: Array.isArray(c.problems) ? c.problems : [],
    goal: Array.isArray(c.goals) ? c.goals : [],
    sol: Array.isArray(c.solutions) ? c.solutions : [],
    resBody: Array.isArray(c.resultTags) ? c.resultTags : [],
    stats: Array.isArray(c.stats) ? c.stats.map(s => [s.label, s.value]) : [],
    slug: c.slug || ''
  };
}

module.exports = function (app) {
  // 旧查询参数分类 URL 永久跳转到英文语义路径
  app.get('/cases', async (req, res) => {
    if (req.query.industry && INDUSTRY_SLUGS[req.query.industry]) {
      const industrySlug = industrySlugOf(req.query.industry);
      return res.redirect(301, `/cases/industry/${industrySlug}`);
    }
    try {
      const cases = (await Case.find({ status: 'published', isOnline: { $ne: false } }).sort({ order: 1, createdAt: -1 }).lean())
        .filter(c => c.slug && c.slug.trim());
      res.set('Cache-Control', 'public, max-age=600');
      res.send(render2026({
        title: '行业案例 | 瑞华智策',
        description: '瑞华智策真实落地的 AI Agent 行业案例，覆盖制造、教育、零售、金融、物业等行业。',
        canonical: 'https://www.ruihuaconsulting.com/cases',
        content: buildCaseList(cases, '全部')
      }));
    } catch (e) {
      console.error('SSR /cases failed:', e);
      res.status(500).send('服务器错误');
    }
  });

  app.get('/cases/industry/:industrySlug', async (req, res) => {
    const industrySlug = req.params.industrySlug;
    const activeInd = SLUG_INDUSTRIES[industrySlug];
    if (!activeInd) return notFound(res);
    try {
      const cases = (await Case.find({ status: 'published', isOnline: { $ne: false } }).sort({ order: 1, createdAt: -1 }).lean())
        .filter(c => c.slug && c.slug.trim());
      res.set('Cache-Control', 'public, max-age=600');
      res.send(render2026({
        title: `${activeInd} AI Agent 案例 | 瑞华智策`,
        description: `瑞华智策${activeInd} AI Agent 落地案例、实施方案与业务成果。`,
        canonical: `https://www.ruihuaconsulting.com/cases/industry/${industrySlug}`,
        content: buildCaseList(cases.filter(c => c.industry === activeInd), activeInd)
      }));
    } catch (e) {
      console.error('SSR /cases/industry/:industrySlug failed:', e);
      res.status(500).send('服务器错误');
    }
  });

  // 案例详情 /cases/:slug（SSR，独立 URL + SEO；设计稿为弹窗，这里补充可直达页面）
  app.get('/cases/:slug', async (req, res) => {
    try {
      const c = await Case.findOne({ slug: req.params.slug, status: 'published', isOnline: { $ne: false } }).lean();
      if (!c) return notFound(res);
      const relatedCases = await Case.find({
        industry: c.industry,
        _id: { $ne: c._id },
        status: 'published',
        isOnline: { $ne: false },
        slug: { $exists: true, $ne: '' }
      }).sort({ featured: -1, order: 1, createdAt: -1 }).limit(3).lean();
      const title = (c.seo && c.seo.title) || `${c.title} | 瑞华智策案例`;
      const desc = (c.seo && c.seo.description) || (c.background || '').slice(0, 160);
      const canonical = `https://www.ruihuaconsulting.com/cases/${encodeURIComponent(c.slug)}`;
      const image = c.cover && /^https?:\/\//.test(c.cover) ? c.cover : '';
      const keywords = (c.seo && c.seo.keywords)
        || [c.industry, ...(c.tags || []), 'AI Agent', '企业案例', '瑞华智策'].filter(Boolean).join(',');
      const structuredData = [
        {
          '@context': 'https://schema.org',
          '@type': 'CaseStudy',
          name: c.title,
          headline: c.title,
          description: desc,
          url: canonical,
          image: image || undefined,
          about: [c.industry, ...(c.tags || [])].filter(Boolean),
          keywords,
          author: {
            '@type': 'Organization',
            name: '瑞华智策',
            url: 'https://www.ruihuaconsulting.com'
          },
          provider: {
            '@type': 'Organization',
            name: '瑞华智策',
            url: 'https://www.ruihuaconsulting.com'
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          dateCreated: c.createdAt,
          dateModified: c.updatedAt
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: 'https://www.ruihuaconsulting.com/' },
            { '@type': 'ListItem', position: 2, name: '行业案例', item: 'https://www.ruihuaconsulting.com/cases' },
            { '@type': 'ListItem', position: 3, name: c.title, item: canonical }
          ]
        }
      ];
      const caseFaqs = buildCaseFaq(c);
      if (caseFaqs.length) {
        structuredData.push({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: caseFaqs.map(f => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a }
          }))
        });
      }
      res.set('Cache-Control', 'public, max-age=600');
      res.send(render2026({
        title,
        description: desc,
        keywords,
        canonical,
        image,
        type: 'article',
        structuredData,
        publishedTime: c.createdAt,
        modifiedTime: c.updatedAt,
        content: buildCaseDetail(c, relatedCases)
      }));
    } catch (e) {
      console.error('SSR /cases/:slug failed:', e);
      res.status(500).send('服务器错误');
    }
  });

  // 行业洞察列表：SSR 输出真实文章卡片，确保搜索引擎可以抓取详情 URL
  app.get('/insights', async (req, res) => {
    if (req.query.category && INSIGHT_CATEGORY_SLUGS[req.query.category]) {
      return res.redirect(301, `/insights/category/${INSIGHT_CATEGORY_SLUGS[req.query.category]}`);
    }
    try {
      const articles = await Article.find({ status: 'published', isOnline: { $ne: false } })
        .sort({ publishDate: -1, updatedAt: -1 }).populate('authorId').lean();
      const content = buildInsightsList(articles);
      res.set('Cache-Control', 'public, max-age=600');
      res.send(render2026({
        title: '研究中心 · 行业洞察 | 瑞华智策',
        description: 'CIO/CEO/CHO 三大智库，追踪 AI 转型落地的真问题。',
        canonical: 'https://www.ruihuaconsulting.com/insights',
        content
      }));
    } catch (e) {
      console.error('SSR /insights failed:', e);
      res.status(500).send('服务器错误');
    }
  });

  app.get('/insights/industry', async (req, res) => {
    try {
      const articles = await Article.find({ status: 'published', isOnline: { $ne: false } }).sort({ publishDate: -1, updatedAt: -1 }).populate('authorId').lean();
      res.send(render2026({ title: '行业洞察 | 瑞华智策', description: 'CIO 数智化转型 / CEO 经营增长 / CHO 人效提升三大智库。', canonical: 'https://www.ruihuaconsulting.com/insights/industry', content: buildInsightsList(articles), activePath: '/insights/industry' }));
    } catch (e) {
      res.status(500).send('服务器错误');
    }
  });

  app.get('/insights/thinktank', (req, res) => {
    res.send(render2026({ title: '经营智库 · R=B×O | 瑞华智策', description: 'R=B×O 理论内核与管理实践框架。', canonical: 'https://www.ruihuaconsulting.com/insights/thinktank', content: loadBlock('i-thinktank'), activePath: '/insights/thinktank' }));
  });

  app.get('/insights/category/:categorySlug', async (req, res) => {
    const categorySlug = req.params.categorySlug;
    const category = SLUG_INSIGHT_CATEGORIES[categorySlug];
    if (!category) return notFound(res);
    try {
      const articles = await Article.find({ category, status: 'published', isOnline: { $ne: false } })
        .sort({ publishDate: -1, updatedAt: -1 }).populate('authorId').lean();
      res.set('Cache-Control', 'public, max-age=600');
      res.send(render2026({
        title: `${category} | 瑞华智策行业洞察`,
        description: `${category}的 AI 转型趋势、方法论与企业实践洞察。`,
        canonical: `https://www.ruihuaconsulting.com/insights/category/${categorySlug}`,
        content: buildInsightsList(articles, category),
        activePath: '/insights'
      }));
    } catch (e) {
      console.error('SSR /insights/category/:categorySlug failed:', e);
      res.status(500).send('服务器错误');
    }
  });

  app.get('/insights/:slug', async (req, res) => {
    // #region debug-point A:route-entry
    (() => { const fs = require('fs'), http = require('http'), payload = JSON.stringify({ sessionId: 'article-detail-error', runId: 'pre', hypothesisId: 'A', location: 'routes/frontendRoutes2026.js:237', msg: '[DEBUG] Article detail route entered', data: { path: req.path, slug: req.params.slug }, ts: Date.now() }); let u = 'http://127.0.0.1:7777/event'; try { const e = fs.readFileSync('.dbg/article-detail-error.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; } catch {} try { const target = new URL(u); const r = http.request({ hostname: target.hostname, port: target.port, path: target.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }); r.on('error', () => {}); r.end(payload); } catch {} })();
    // #endregion
    try {
      const article = await Article.findOneAndUpdate(
        { slug: req.params.slug, status: 'published', isOnline: { $ne: false } },
        { $inc: { views: 1 } },
        { new: true }
      ).populate('authorId').lean();
      // #region debug-point B:query-result
      (() => { const fs = require('fs'); let u = 'http://127.0.0.1:7777/event'; let s = 'article-detail-error'; try { const e = fs.readFileSync('.dbg/article-detail-error.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s; } catch {} fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s, runId: 'pre', hypothesisId: 'B', location: 'routes/frontendRoutes2026.js:239-244', msg: '[DEBUG] Article query completed', data: { found: !!article, slug: req.params.slug, status: article?.status, isOnline: article?.isOnline }, ts: Date.now() }) }).catch(() => {}); })();
      // #endregion
      if (!article) return notFound(res);
      const canonical = `https://www.ruihuaconsulting.com/insights/${encodeURIComponent(article.slug)}`;
      const title = article.seoTitle || `${article.title} | 瑞华智策行业洞察`;
      const description = article.seoDescription || article.summary || '';
      const keywords = (article.seoKeywords || article.tags || []).join(',');
      const author = article.authorId || article.author || {};
      const qa = Array.isArray(article.qa) ? article.qa.filter(x => x.question && x.answer) : [];
      const relatedArticles = await Article.find({
        _id: { $ne: article._id }, status: 'published', isOnline: { $ne: false }
      }).sort({ top: -1, publishDate: -1 }).limit(5).lean();
      const structuredData = [
        {
          '@context': 'https://schema.org', '@type': 'Article', headline: article.title,
          description, url: canonical, image: absoluteUrl(article.coverImage) || undefined,
          datePublished: article.publishDate, dateModified: article.updatedAt,
          author: { '@type': 'Person', name: author.name || '瑞华智策研究团队' },
          publisher: { '@type': 'Organization', name: '瑞华智策', url: 'https://www.ruihuaconsulting.com' }
        },
        {
          '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: 'https://www.ruihuaconsulting.com/' },
            { '@type': 'ListItem', position: 2, name: '行业洞察', item: 'https://www.ruihuaconsulting.com/insights' },
            { '@type': 'ListItem', position: 3, name: article.title, item: canonical }
          ]
        }
      ];
      if (qa.length) {
        structuredData.push({
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: qa.map(x => ({ '@type': 'Question', name: x.question,
            acceptedAnswer: { '@type': 'Answer', text: String(x.answer).replace(/<[^>]+>/g, '') } }))
        });
      }
      res.set('Cache-Control', 'no-store');
      res.send(render2026({ title, description, keywords, canonical,
        image: absoluteUrl(article.coverImage), type: 'article', structuredData,
        content: buildArticleDetail(article, author, qa, relatedArticles) }));
    } catch (e) {
      // #region debug-point C:render-error
      (() => { const fs = require('fs'), http = require('http'), payload = JSON.stringify({ sessionId: 'article-detail-error', runId: 'pre', hypothesisId: 'C', location: 'routes/frontendRoutes2026.js:287-289', msg: '[DEBUG] Article detail render failed', data: { name: e?.name, message: e?.message, stack: String(e?.stack || '').slice(0, 1200) }, ts: Date.now() }); let u = 'http://127.0.0.1:7777/event'; try { const x = fs.readFileSync('.dbg/article-detail-error.env', 'utf8'); u = x.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; } catch {} try { const target = new URL(u), r = http.request({ hostname: target.hostname, port: target.port, path: target.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }); r.on('error', () => {}); r.end(payload); } catch {} })();
      // #endregion
      console.error('SSR /insights/:slug failed:', e);
      res.status(500).send('服务器错误');
    }
  });

  // ===== 静态内容页（2026 设计块）SSR 路由 =====
  // URL → { block, title, description }
  const PAGES = {
    '/solutions': { block: 'solutions', title: '产品与服务 · 三位一体 | 瑞华智策', description: 'AI 赋能培训、AI 转型咨询、AI 落地陪跑三位一体，可单独采购，也可组合成一体化方案。' },
    '/solutions/training': { block: 'p-training', title: 'AI 赋能培训 · 12 门课带成果物 | 瑞华智策', description: '四条路径分角色培养，12 门课全部带可落地的成果物，解决「人会不会用 AI」。' },
    '/solutions/consulting': { block: 'p-consulting', title: 'AI 转型咨询 · 碳硅共智 | 瑞华智策', description: 'AI 驱动的新增长引擎打造 × 组织管理机制优化，解决「往哪走」。' },
    '/solutions/fde': { block: 'p-fde', title: 'AI 落地陪跑 · FDE | 瑞华智策', description: '现场部署 + 持续运营 + 能力转移，把 Agent 从演示拽进业务流。' },
    '/hcvm': { block: 'hcvm', title: '人力资本价值经营 · HCVM | 瑞华智策', description: '以管理+技术双轮驱动，实现客户、企业与人才的价值共赢。' },
    '/insights/thinktank': { block: 'i-thinktank', title: '经营智库 · R=B×O | 瑞华智策', description: 'R=B×O 理论内核与管理实践框架：增长诊断、碳硅共智组织设计、人效经营模型。' },
    '/about': { block: 'about', title: '关于我们 · AI 原生咨询公司 | 瑞华智策', description: '瑞华智策：人瑞人才全资子公司，AI 原生的本土咨询机构。' },
    '/about/team': { block: 'about-team', title: '团队基因 · 瑞华智策', description: '瑞华智策团队基因：AI 工程化、管理咨询与陪伴服务的复合型团队，先自己跑通，再服务客户。' },
    '/contact': { block: 'contact', title: '联系我们 · 预约诊断 | 瑞华智策', description: '400-175-0886。预约「AI 场景诊断」，顾问 1 个工作日内联系你。' }
  };

  Object.entries(PAGES).forEach(([url, cfg]) => {
    app.get(url, (req, res) => {
      try {
        const content = loadBlock(cfg.block);
        if (!content) return notFound(res);
        res.set('Cache-Control', 'public, max-age=600');
        res.send(render2026({ title: cfg.title, description: cfg.description, canonical: `https://www.ruihuaconsulting.com${url}`, content, activePath: url }));
      } catch (e) {
        console.error(`SSR ${url} failed:`, e);
        res.status(500).send('服务器错误');
      }
    });
  });

  module.exports.buildHome = buildHome;
};

function buildCaseCards(cases) {
  if (!cases.length) return '<p class="case-empty">暂无已发布案例。</p>';
  return cases.map(raw => {
    const c = toCaseDB(raw);
    const summary = c.bg.length > 64 ? `${c.bg.slice(0, 64)}…` : c.bg;
    const tags = c.tags.length
      ? `<div class="ctags">${c.tags.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '';
    const stats = c.stats.length
      ? `<div class="nums">${c.stats.slice(0, 2).map(x => `<span><b>${esc(x[1])}</b><i>${esc(x[0])}</i></span>`).join('')}</div>` : '';
    return `<a class="case-card" href="/cases/${encodeURIComponent(c.slug)}" data-industry="${esc(c.ind)}">
      <div class="chead"><span class="ind">${esc(c.ind)}</span></div>
      ${tags}<h4>${esc(c.title)}</h4><p>${esc(summary)}</p>${stats}
    </a>`;
  }).join('');
}

function buildCaseList(cases, activeInd) {
  const tabs = INDS.map(ind => ind === '全部'
    ? `<a href="/cases" data-industry="全部"${ind === activeInd ? ' class="act"' : ''}>全部</a>`
    : `<a href="/cases/industry/${industrySlugOf(ind)}" data-industry="${esc(ind)}"${ind === activeInd ? ' class="act"' : ''}>${esc(ind)}</a>`).join('');
  return loadBlock('cases')
    .replace('<!--CASE_TABS-->', tabs)
    .replace('<!--CASE_CARDS-->', buildCaseCards(cases));
}

function buildInsightsList(articles, activeCategory = '全部') {
  const tabs = ['全部', 'CIO 数智化转型智库', 'CEO 经营增长智库', 'CHO 人效提升智库'];
  const tabsHtml = tabs.map(category => {
    const href = category === '全部' ? '/insights' : `/insights/category/${INSIGHT_CATEGORY_SLUGS[category]}`;
    return `<a href="${href}"${category === activeCategory ? ' class="act"' : ''}>${esc(category)}</a>`;
  }).join('');
  const listHtml = articles.length ? articles.map(article => `<a class="art" href="/insights/${encodeURIComponent(article.slug)}"><div class="art-head"><span class="tk">${esc(article.category || '行业洞察')}</span><span class="go2">阅读全文 →</span></div><span class="t">${esc(article.title)}</span><span class="d">${esc(article.summary || article.seoDescription || '')}</span><span class="m">${article.publishDate ? new Date(article.publishDate).toLocaleDateString('zh-CN') : ''} · ${esc((article.authorId || article.author || {}).name || '瑞华智策研究团队')} · 阅读 ${article.views || 0}</span></a>`).join('') : '<p>暂无已发布文章。</p>';
  return loadBlock('i-industry')
    .replace('<div class="ind-tabs" id="insTabs"></div>', `<div class="ind-tabs" id="insTabs">${tabsHtml}</div>`)
    .replace('<div id="insList"></div>', `<div id="insList">${listHtml}</div>`);
}

function buildArticleDetail(article, author, qa, relatedArticles = []) {
  const published = article.publishDate ? new Date(article.publishDate).toLocaleDateString('zh-CN') : '';
  const updated = article.updatedAt ? new Date(article.updatedAt).toLocaleDateString('zh-CN') : published;
  const summary = article.summary || article.seoDescription || '';
  const authorName = author.name || '瑞华智策研究团队';
  const category = article.category || '行业洞察';
  const categorySlug = INSIGHT_CATEGORY_SLUGS[category];
  const categoryHref = categorySlug ? `/insights/category/${categorySlug}` : '/insights';
  const authorTitle = author.desc || '企业 AI 转型与新质组织研究';
  const authorBio = String(author.detail || author.desc || '持续研究企业 AI 转型、组织变革与经营增长，并将一线实践沉淀为可复用的方法。').replace(/<[^>]+>/g, '');
  const avatar = author.avatar ? `<img src="${esc(author.avatar)}" alt="${esc(authorName)}">` : `<span class="fb">${esc(authorName.charAt(0))}</span>`;
  const emptyState = article.contentStatus === 'soon'
    ? '本文即将发布，完整内容正在整理中。'
    : article.contentStatus === 'toc'
      ? '本文当前为章节导读，完整正文即将上线。'
      : '本文正文正在完善，您可以先阅读核心摘要。';
  const bodyHtml = article.content
    ? article.content
    : `<div class="a-note">${emptyState}</div>${summary ? `<p>${esc(summary)}</p>` : ''}`;
  const tocItems = [];
  const bodyWithAnchors = bodyHtml.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_, level, attrs, content) => {
    const text = String(content).replace(/<[^>]+>/g, '').trim();
    const id = `article-section-${tocItems.length + 1}`;
    if (text) tocItems.push({ id, text, level });
    return `<h${level}${attrs} id="${id}">${content}</h${level}>`;
  });
  const tocHtml = `<nav class="a-toc" aria-label="本文目录"><div class="h"><span>本文目录</span></div><div class="a-toc-links"><a href="#article-summary">核心摘要</a>${tocItems.length ? tocItems.map(item => `<a class="level-${item.level}" href="#${item.id}">${esc(item.text)}</a>`).join('') : '<a href="#article-content">正文内容</a>'}</div></nav>`;
  const qaHtml = qa.length ? `<section class="a-faq"><div class="a-block-label">FAQ</div><h2>常见问题</h2>${qa.map(x => `<div class="a-faq-item"><h3>${esc(x.question)}</h3><p>${esc(String(x.answer).replace(/<[^>]+>/g, ''))}</p></div>`).join('')}</section>` : '';
  const relatedHtml = relatedArticles.length ? `<section class="a-rel"><div class="h">相关文章</div>${relatedArticles.map(item => `<a class="r" href="/insights/${encodeURIComponent(item.slug)}"><span>${esc(item.title)}</span><em>${item.publishDate ? new Date(item.publishDate).toLocaleDateString('zh-CN') : '行业洞察'}</em></a>`).join('')}</section>` : '';
  return `<div class="page on" data-page="article-detail"><header class="a-hero"><div class="wrap"><div class="a-bc"><a href="/">首页</a> › <a href="/insights">行业洞察</a> › <a href="${categoryHref}">${esc(category)}</a></div><h1>${esc(article.title)}</h1><div class="a-meta"><span>发布时间：<b>${published}</b></span><span>作者：<b>${esc(authorName)}</b></span><span>阅读量：<b>${article.views || 0}</b></span><span>更新时间：<b>${updated}</b></span></div></div></header><main class="a-main"><article><div class="a-abs" id="article-summary"><div class="h">CORE SUMMARY · 核心摘要</div><p>${esc(summary)}</p></div><div class="a-body"><div class="article-content" id="article-content">${bodyWithAnchors}</div>${qaHtml}${relatedHtml}<p class="case-detail-back"><a href="/insights">← 返回行业洞察</a></p></div></article><aside class="a-side">${tocHtml}<section class="a-author"><div class="h">作者</div><div class="row">${avatar}<div><div class="nm">${esc(authorName)}</div><div class="ti">${esc(authorTitle)}</div></div></div><p>${esc(authorBio)}</p></section><section class="a-promo"><span class="chip">⚡ 限时免费诊断</span><div class="t">企业 AI 场景诊断</div><p>从业务价值、数据基础与落地难度出发，识别最值得优先启动的 AI 场景，形成可执行的场景清单。</p><a href="/contact">预约场景诊断 <span>→</span></a></section></aside></main></div>`;
}

// 案例详情页（沿用 rh2026 内容层级与视觉语言）
function buildCaseDetail(c, relatedCases = []) {
  const plainTextFromHtml = value => String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const overview = plainTextFromHtml(c.background) || '聚焦业务真实场景，以 AI Agent 与组织协同推动成果落地。';
  const list = items => (items || []).map(x => `<li>${esc(x)}</li>`).join('');
  const tags = (c.tags || []).map(x => `<span>${esc(x)}</span>`).join('');
  const stats = (c.stats && c.stats.length)
    ? `<div class="case-hero-stats">${c.stats.slice(0, 4).map(x => `<div class="stat"><b>${esc(x.value)}</b><i>${esc(x.label)}</i></div>`).join('')}</div>` : '';
  const looksLikeResultValue = value => /\d|%|↑|↓|→|倍|小时|分钟|天|周/.test(String(value || ''));
  const normalizeResultPair = (first, second) => {
    const firstValue = String(first || '');
    const secondValue = String(second || '');
    if (looksLikeResultValue(secondValue) && !looksLikeResultValue(firstValue)) {
      return { value: secondValue, label: firstValue };
    }
    return { value: firstValue, label: secondValue };
  };
  const resultItems = (c.resultTags || []).reduce((items, item, index, source) => {
    if (index % 2 === 0) items.push(normalizeResultPair(item, source[index + 1]));
    return items;
  }, []);
  const impactItems = resultItems.length
    ? resultItems
    : (c.stats || []).filter(x => x && (x.value || x.label)).map(x => normalizeResultPair(x.value, x.label));
  const results = impactItems.map(({ value, label }, index) => `<div class="case-result-item">
    <span class="case-result-index">${String(index + 1).padStart(2, '0')}</span><strong class="case-result-value">${esc(value)}</strong>${label ? `<p class="case-result-label">${esc(label)}</p>` : ''}
  </div>`).join('');
  const story = (className, id, number, title, items) => (items && items.length) ? `<article class="case-story-card ${className}" id="${id}">
    <div class="case-story-kicker"><span>${number}</span>${title}</div><ul>${list(items)}</ul>
  </article>` : '';
  const related = relatedCases.length ? `<section class="case-related" aria-labelledby="related-cases-title">
    <div class="case-section-head"><div><span>RELATED CASES</span><h2 id="related-cases-title">更多${esc(c.industry || '')}实践</h2></div><a href="/cases/industry/${industrySlugOf(c.industry)}">查看全部 →</a></div>
    <div class="case-grid">${buildCaseCards(relatedCases)}</div>
  </section>` : '';
  const faqs = buildCaseFaq(c);
  const faq = faqs.length ? `<section class="case-faq" aria-labelledby="case-faq-title">
    <div class="case-section-head"><div><span>FAQ</span><h2 id="case-faq-title">常见问题</h2></div></div>
    <div class="faq-list">${faqs.map(f => `<details class="faq-item"><summary>${esc(f.q)}<span class="ic">＋</span></summary><div class="a">${esc(f.a)}</div></details>`).join('')}</div>
  </section>` : '';
  return `
  <div class="page on" data-page="case-detail">
    <div class="case-detail-hero"><div class="case-detail-wrap">
      <nav class="case-breadcrumb" aria-label="面包屑"><a href="/">首页</a><span>／</span><a href="/cases">行业案例</a><span>／</span><strong>${esc(c.title)}</strong></nav>
      <div class="case-hero-meta"><span class="case-industry">${esc(c.industry || '其他')}</span>${tags ? `<div class="ctags">${tags}</div>` : ''}</div>
      <h1>${esc(c.title)}</h1>
      ${c.client ? `<p class="case-client">客户 · ${esc(c.client)}</p>` : ''}
      ${stats}
    </div></div>
    <main class="section case-detail-section"><div class="cm-body case-detail-body">
      <div class="case-report-layout">
        <aside class="case-report-index" aria-label="案例章节导航">
          <span class="case-index-eyebrow">CASE REVIEW</span>
          <strong>项目复盘</strong>
          <nav><a href="#case-overview"><i>00</i>项目概览</a><a href="#case-step-01"><i>01</i>遇到的问题</a><a href="#case-step-02"><i>02</i>期望目标</a><a href="#case-step-03"><i>03</i>解决方案</a><a href="#case-impact"><i>04</i>项目成果</a></nav>
          <span class="case-index-progress" aria-hidden="true"></span>
        </aside>
        <div class="case-report-content">
          <section class="case-overview" id="case-overview">
            <div class="case-section-label"><span>00</span>PROJECT OVERVIEW</div>
            <h2>项目概览</h2>
            <div class="case-overview-content"><p>${esc(overview).replace(/\n/g, '<br>')}</p></div>
          </section>
          <div class="case-story-grid" id="case-story">
            ${story('case-problem', 'case-step-01', '01', '遇到的问题', c.problems)}
            ${story('case-goal', 'case-step-02', '02', '希望实现的目标', c.goals)}
            ${story('case-solution', 'case-step-03', '03', '解决方案', c.solutions)}
          </div>
          <section class="case-results" id="case-impact">
            <div class="case-results-head"><div><div class="case-section-label"><span>04</span>DELIVERED IMPACT</div><h2>项目成果</h2></div><p>从关键业务指标到工作方式转变，项目价值被持续验证并留在组织内部。</p></div>
            ${results ? `<div class="case-result-grid">${results}</div>` : `<div class="case-results-empty"><span>RESULTS IN PROGRESS</span><p>项目成果正在持续沉淀，详细效果数据将在完成验证后更新。</p></div>`}
          </section>
        </div>
      </div>
      ${faq}
      ${related}
      <div class="cm-cta">
        <div class="t">想在你的企业复制这个场景？<span>先做一次轻量的 AI 场景诊断，顾问 1 个工作日内联系你。</span></div>
        <a class="btn case-detail-primary" href="/contact">预约「AI 场景诊断」<span class="arr">→</span></a>
        <button class="btn case-detail-ai" data-action="open-drawer">问 AI 顾问</button>
      </div>
      <p class="case-detail-back"><a href="/cases">← 返回全部案例</a></p>
    </div></main>
  </div>`;
}

// 案例 FAQ（GEO 友好：覆盖「方案/效果/痛点」三类高频问题，利于 AI 引擎与用户抓取）
function buildCaseFaq(c) {
  const qa = [];
  const title = (c.title || '').trim();
  const industry = (c.industry || '').trim();
  const solutions = (c.solutions || []).filter(Boolean);
  const problems = (c.problems || []).filter(Boolean);
  const stats = (c.stats || []).filter(s => s && (s.label || s.value));
  if (solutions.length) qa.push({ q: `${title} 采用了什么解决方案？`, a: solutions.slice(0, 3).join('；') });
  if (stats.length) {
    const impact = stats.slice(0, 3).map(s => `${s.label || ''} ${s.value || ''}`.trim()).join('、');
    qa.push({ q: `${industry ? industry + ' ' : ''}场景的落地效果如何？`, a: `核心成果：${impact}。` });
  }
  if (problems.length) qa.push({ q: '这个项目主要解决了哪些痛点？', a: problems.slice(0, 3).join('；') });
  return qa;
}

// 首页精选案例卡片（复用 .tl-card 视觉）
function buildHomeFeatured(cases) {
  if (!cases.length) return '';
  return cases.slice(0, 3).map(c => {
    const bg = c.background || '';
    const summary = bg.length > 42 ? `${bg.slice(0, 42)}…` : bg;
    return `<a class="tl-card" href="/cases/${encodeURIComponent(c.slug)}"><span class="k">${esc((c.industry || 'CASE').toUpperCase())}</span><h3>${esc(c.title)}</h3><p>${esc(summary)}</p><span class="go">看案例 →</span></a>`;
  }).join('');
}

// 首页 FAQ 列表
function buildHomeFaq(faqs) {
  if (!faqs.length) return '';
  return faqs.slice(0, 6).map(f => `<details class="faq-item"><summary>${esc(f.question)}<span class="ic">＋</span></summary><div class="a">${esc(f.answer || '')}</div></details>`).join('');
}

// 首页构建器：真实 hero+homeMain 块（引擎负责隧道/光墙/动画）；动态注入精选案例 + FAQ
async function buildHome() {
  let html = loadBlock('home');
  const [featured, faqs] = await Promise.all([
    Case.find({ status: 'published', isOnline: { $ne: false }, featured: true }).sort({ featuredOrder: 1, createdAt: -1 }).limit(3).lean(),
    Faq.find({ status: { $in: ['published', undefined] }, isOnline: { $ne: false } }).sort({ order: 1 }).limit(6).lean()
  ]);
  html = html.replace('<!--HOME_FEATURED-->', buildHomeFeatured(featured));
  html = html.replace('<!--HOME_FAQ-->', buildHomeFaq(faqs));
  return html;
}

module.exports.buildHome = buildHome;
