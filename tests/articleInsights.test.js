const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('行业洞察文章系统', function () {
    it('文章模型持久化独立 SEO 与 GEO 配置', function () {
        const model = read('models/Article.js');

        assert.match(model, /seoTitle:/);
        assert.match(model, /seoKeywords:/);
        assert.match(model, /summary:/);
        assert.match(model, /qa:/);
        assert.match(model, /geoScore:/);
        assert.match(model, /geoDimensions:/);
    });

    it('行业洞察使用数据库文章和可抓取详情 URL', function () {
        const routes = read('routes/frontendRoutes2026.js');

        assert.match(routes, /app\.get\('\/insights\/:slug'/);
        assert.match(routes, /slug: req\.params\.slug, status: 'published', isOnline: \{ \$ne: false \}/);
        assert.match(routes, /href="\/insights\/\$\{encodeURIComponent\(article\.slug\)\}"/);
        assert.doesNotMatch(routes, /href="#\/article/);
    });

    it('面包屑分类使用可索引的英文静态 URL', function () {
        const routes = read('routes/frontendRoutes2026.js');

        assert.match(routes, /app\.get\('\/insights\/category\/:categorySlug'/);
        assert.match(routes, /'CEO 经营增长智库': 'ceo-growth'/);
        assert.match(routes, /`\/insights\/category\/\$\{categorySlug\}`/);
        assert.doesNotMatch(routes, /categoryHref = `\/insights\?category=/);
    });

    it('文章详情每次访问原子递增阅读量并渲染最新值', function () {
        const routes = read('routes/frontendRoutes2026.js');

        assert.match(routes, /Article\.findOneAndUpdate\(/);
        assert.match(routes, /\{ \$inc: \{ views: 1 \} \}/);
        assert.match(routes, /\{ new: true \}/);
        assert.match(routes, /res\.set\('Cache-Control', 'no-store'\)/);
    });

    it('正文为空时输出摘要和内容状态提示，不产生空白详情页', function () {
        const routes = read('routes/frontendRoutes2026.js');

        assert.match(routes, /const bodyHtml = article\.content/);
        assert.match(routes, /article\.summary \|\| article\.seoDescription/);
        assert.match(routes, /即将发布/);
        assert.match(routes, /章节导读/);
    });

    it('文章详情输出 Article、FAQ 和面包屑结构化数据', function () {
        const routes = read('routes/frontendRoutes2026.js');

        assert.match(routes, /'@type': 'Article'/);
        assert.match(routes, /'@type': 'FAQPage'/);
        assert.match(routes, /'@type': 'BreadcrumbList'/);
        assert.match(routes, /https:\/\/www\.ruihuaconsulting\.com\/insights\/\$\{encodeURIComponent\(article\.slug\)\}/);
    });

    it('新版后台可设置文章发布、SEO 与 GEO 字段', function () {
        const script = read('admin/js/admin-2026.js');

        ['slug', 'seoTitle', 'seoDescription', 'seoKeywords', 'summary', 'qa', 'geoScore', 'geoDimensions', 'publishDate', 'coverImage', 'tags']
            .forEach(field => assert.match(script, new RegExp(`\\['${field}'`)));
        assert.match(script, /ARTICLE_STATUSES/);
        assert.match(script, /draft/);
        assert.match(script, /published/);
        assert.match(script, /archived/);
    });

    it('文章写接口清洗新增 SEO 字段并保留局部更新语义', function () {
        const server = read('server.js');

        assert.match(server, /payload\.seoTitle = xss/);
        assert.match(server, /payload\.seoKeywords = payload\.seoKeywords/);
        assert.match(server, /hasOwnProperty\.call\(payload, 'category'\)/);
    });
});
