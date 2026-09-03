const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('SEO 与 GEO 全站优化', function () {
    it('AI 顾问来源链接使用真实 SSR 路径而不是旧 Hash 路由', function () {
        const engine = read('public/js/rh2026-engine.js');
        assert.match(engine, /location\.assign\(|window\.location\.href/);
        assert.doesNotMatch(engine, /location\.hash=h/);
        assert.match(engine, /new URL\(h,\s*location\.origin\)/);
        const source = read('new/rh2026.html');
        assert.doesNotMatch(source, /location\.hash=h/);
        assert.match(source, /new URL\(h,\s*location\.origin\)/);
    });

    it('旧文章入口统一 301 到新版洞察规范 URL', function () {
        const server = read('server.js');
        assert.match(server, /res\.redirect\(301, `\/insights\/\$\{encodeURIComponent\([^)]+\)\}`\)/);
        assert.doesNotMatch(server, /const articleUrl = `\$\{SITE_URL\}\/article\/\$\{article\.slug \|\| article\._id\}\.html`/);
    });

    it('llms.txt 仅收录在线文章并使用新版规范 URL', function () {
        const server = read('server.js');
        assert.match(server, /Article\.find\(\{ status: 'published', isOnline: \{ \$ne: false \}, slug:/);
        assert.match(server, /const canonicalUrl = `\$\{SITE_URL\}\/insights\/\$\{encodeURIComponent\(article\.slug\)\}`/);
    });

    it('所有新版核心 SSR 页面均输出自引用 canonical', function () {
        const server = read('server.js');
        const routes = read('routes/frontendRoutes2026.js');
        assert.match(server, /canonical: ['`]https:\/\/www\.ruihuaconsulting\.com\/['`]/);
        ['/insights', '/insights/industry', '/insights/thinktank'].forEach(url => {
            const escaped = url.replace(/\//g, '\\/');
            assert.match(routes, new RegExp(`canonical: ['\`]https:\\/\\/www\\.ruihuaconsulting\\.com${escaped}['\`]`));
        });
        assert.match(routes, /canonical: `https:\/\/www\.ruihuaconsulting\.com\$\{url\}`/);
    });

    it('首页和静态 SSR 页面具备统一组织、网站与页面结构化数据', function () {
        const renderer = read('utils/render2026.js');
        assert.match(renderer, /'@id': [`']https:\/\/www\.ruihuaconsulting\.com\/#organization[`']/);
        assert.match(renderer, /'@type': 'WebSite'/);
        assert.match(renderer, /'@type': 'WebPage'/);
    });

    it('文章仅在有问答时输出 FAQPage，并使用绝对图片 URL', function () {
        const routes = read('routes/frontendRoutes2026.js');
        assert.match(routes, /if \(qa\.length\) \{[\s\S]{0,500}structuredData\.push\(\{[\s\S]{0,200}'@type': 'FAQPage'/);
        assert.match(routes, /absoluteUrl\(article\.coverImage\)/);
    });

    it('Sitemap 不含重复跳转 URL，并收录已发布视频详情', function () {
        const server = read('server.js');
        assert.doesNotMatch(server, /\{ url: 'about\/'/);
        assert.doesNotMatch(server, /\{ url: 'ai-strategic\/'/);
        assert.match(server, /Video\.find\(\{ status: 'published'/);
        assert.match(server, /\/video\/\$\{encodeURIComponent\(video\.slug\)\}\//);
    });

    it('robots 不再阻止所有查询参数且覆盖当前内容路径', function () {
        const robots = read('robots.txt');
        assert.doesNotMatch(robots, /Disallow: \/\*\?\*/);
        assert.match(robots, /^Allow: \/$/m, 'robots.txt 未允许公开页面');
    });

    it('所有 2026 生产模板均使用真实站内链接', function () {
        const templateRoot = path.join(ROOT, 'views', '2026');
        const files = [];
        const collect = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
            const target = path.join(directory, entry.name);
            if (entry.isDirectory()) collect(target);
            else if (entry.name.endsWith('.html')) files.push(target);
        });
        collect(templateRoot);
        files.forEach(file => {
            const html = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(html, /(?:href|action)=["']#\//, `${path.relative(ROOT, file)} 仍包含 hash 路由`);
        });
    });

    it('2026 运行时生成的用户链接不再使用 Hash 路由', function () {
        for (const file of ['public/js/rh2026.js', 'public/js/rh2026-engine.js']) {
            const js = read(file);
            assert.doesNotMatch(js, /href=["']#\//, `${file} 仍生成 hash 链接`);
            assert.doesNotMatch(js, /(?:src:\s*\[|h:)['"]#\//, `${file} 的内容索引仍返回 hash 链接`);
        }
    });

    it('公开页面只链接最终规范 URL，并提供隐私与视频入口兼容跳转', function () {
        const publicHtml = fs.readdirSync(ROOT).filter(file => file.endsWith('.html')).concat([
            'public/fangan/rui-hua-solution.html',
            'public/fangan/rui-hua-intro.html'
        ]);
        publicHtml.forEach(file => {
            const html = read(file);
            assert.doesNotMatch(html, /href=["']\/videos["']/);
            assert.doesNotMatch(html, /href=["']\/privacy\/["']/);
            assert.doesNotMatch(html, /href=["']\/solutions\/["']/);
            assert.doesNotMatch(html, /href=["']\/solutions-hcvm\/?["']/);
            assert.doesNotMatch(html, /href=["']\/solutions-ohcvm(?:\/|\.html)?["']/);
            assert.doesNotMatch(html, /href=["']\/about\/["']/);
        });
        const server = read('server.js');
        assert.match(server, /app\.get\('\/videos\/', \(req, res\) => renderStaticHtmlWith2026Shell\(req, res, 'videos\.html'\)\)/);
        assert.match(server, /app\.get\('\/videos\.html', \(req, res\) => res\.redirect\(301, '\/videos\/'\)\)/);
        assert.match(server, /app\.get\('\/privacy\/', \(req, res\) => res\.redirect\(301, '\/privacy'\)\)/);
    });

    it('公开页面不再使用旧信息架构和行为型空链接', function () {
        const files = fs.readdirSync(ROOT).filter(file => file.endsWith('.html') && file !== 'rh2026_0902.html' && !['nurture.html', 'solutions-hcvm.html', 'solutions-ohcvm.html'].includes(file))
            .concat(['views/2026/page-blocks/contact.html', 'public/fangan/nurture.html']);
        files.forEach(file => {
            const html = read(file);
            assert.doesNotMatch(html, /href=["']\/resources\/["']/, `${file} 仍链接旧资源中心`);
            assert.doesNotMatch(html, /(?:href|onclick)=["'][^"']*\/productivity\//, `${file} 仍链接旧预约入口`);
            assert.doesNotMatch(html, /<a\b[^>]*href=["']#["'][^>]*>/, `${file} 仍使用行为型空链接`);
        });
        assert.doesNotMatch(read('public/fangan/nqoc-nurture.html'), /<a href="#"[^>]*>立即参与调研<\/a>/);
        assert.doesNotMatch(read('public/nqoc/awards.html'), /<a href="#"[^>]*>[^<]*加载更多入围企业/);
    });

    it('所有文章生成器直接输出新版洞察 URL', function () {
        const files = ['server.js', 'resources.html', 'public/js/main.js', 'utils/homeContentRenderer.js', 'admin/js/article-management.js'];
        files.forEach(file => {
            const source = read(file);
            assert.doesNotMatch(source, /\/article\/\$\{[^}]+\}\.html/, `${file} 仍生成旧文章 URL`);
        });
    });

    it('运行时知识库来源使用真实站内路径', function () {
        for (const file of ['public/js/rh2026.js', 'public/js/rh2026-engine.js']) {
            assert.doesNotMatch(read(file), /['"]#\/solutions\/fde['"]|['"]#\/cases['"]/);
        }
    });

    it('公开传播物料和表单页具有明确 noindex 策略', function () {
        const files = [
            'public/fangan/geo-monitor.html',
            'public/fangan/nurture.html',
            'public/fangan/nqoc-nurture.html',
            'public/fangan/wechat-traffic-analysis.html',
            'public/nqoc/flyer.html',
            'public/nqoc/poster.html',
            'public/nqoc/expert-apply.html'
        ];
        files.forEach(file => assert.match(read(file), /<meta name="robots" content="noindex,\s*follow"\s*\/?>/i, `${file} 缺少 noindex`));
    });
});
