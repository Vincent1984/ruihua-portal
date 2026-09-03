const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { render2026 } = require('../utils/render2026');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('案例独立详情页', function () {
    it('案例分类使用英文语义路径并为旧查询参数提供 301 跳转', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const renderer = read('utils/render2026.js');

        assert.match(routes, /app\.get\('\/cases\/industry\/:industrySlug'/);
        assert.match(routes, /canonical: `https:\/\/www\.ruihuaconsulting\.com\/cases\/industry\/\$\{industrySlug\}`/);
        assert.match(routes, /res\.redirect\(301, `\/cases\/industry\/\$\{industrySlug\}`\)/);
        assert.match(routes, /href="\/cases\/industry\/\$\{industrySlugOf/);
        assert.doesNotMatch(routes, /href="\/cases\?industry=/);
        assert.doesNotMatch(renderer, /cases\?industry=/);
    });

    it('案例卡片使用可抓取的语义化详情链接', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const script = read('public/js/rh2026.js');

        assert.match(routes, /<a class="case-card" href="\/cases\/\$\{encodeURIComponent\(c\.slug\)\}"/);
        assert.doesNotMatch(script, /class="case-card" onclick="openCase/);
    });

    it('详情页输出 Canonical、Open Graph 与 JSON-LD', function () {
        const html = render2026({
            title: '海尔智家 AI Agent 案例 | 瑞华智策',
            description: '制造业 AI Agent 落地案例。',
            keywords: 'AI Agent,制造业,企业案例',
            canonical: 'https://www.ruihuaconsulting.com/cases/haier-agent-os',
            image: 'https://www.ruihuaconsulting.com/images/cases/haier.jpg',
            type: 'article',
            structuredData: {
                '@context': 'https://schema.org',
                '@type': 'CaseStudy',
                name: '海尔智家 AI Agent 案例'
            },
            content: '<main><h1>海尔智家 AI Agent 案例</h1></main>'
        });

        assert.match(html, /<link rel="canonical" href="https:\/\/www\.ruihuaconsulting\.com\/cases\/haier-agent-os"/);
        assert.match(html, /<meta property="og:type" content="article"/);
        assert.match(html, /<meta property="og:url" content="https:\/\/www\.ruihuaconsulting\.com\/cases\/haier-agent-os"/);
        assert.match(html, /<meta property="og:image" content="https:\/\/www\.ruihuaconsulting\.com\/images\/cases\/haier.jpg"/);
        assert.match(html, /<script type="application\/ld\+json">/);
        assert.match(html, /"@type":"CaseStudy"/);
    });

    it('案例列表 SSR 输出真实卡片并过滤空 slug', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const block = read('views/2026/page-blocks/cases.html');

        assert.match(routes, /filter\(c => c\.slug && c\.slug\.trim\(\)\)/);
        assert.match(routes, /buildCaseCards\(cases\)/);
        assert.match(block, /<div class="case-grid"[^>]*><!--CASE_CARDS-->/);
    });

    it('案例卡片统计先输出 value 再输出 label，并对内容做 HTML 转义', function () {
        const routes = read('routes/frontendRoutes2026.js');

        assert.ok(routes.includes('<b>${esc(x[1])}</b><i>${esc(x[0])}</i>'));
        assert.match(routes, /buildCaseCards/);
        assert.match(routes, /esc\(c\.title\)/);
    });

    it('详情页结构不包含内联样式或内联事件', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const detailBuilder = routes.slice(routes.indexOf('function buildCaseDetail'), routes.indexOf('function buildHome'));

        assert.doesNotMatch(detailBuilder, /style="/);
        assert.doesNotMatch(detailBuilder, /\son[a-z]+="/i);
        assert.match(detailBuilder, /case-detail-body/);
        assert.match(detailBuilder, /data-action="open-drawer"/);
    });

    it('详情路由基于规范域名和 slug 构建唯一 URL', function () {
        const routes = read('routes/frontendRoutes2026.js');

        assert.match(routes, /https:\/\/www\.ruihuaconsulting\.com\/cases\/\$\{encodeURIComponent\(c\.slug\)\}/);
        assert.match(routes, /'@type': 'CaseStudy'/);
        assert.match(routes, /'@type': 'BreadcrumbList'/);
    });

    it('详情页按设计顺序提供面包屑、概览、问题目标方案、结果、相关案例、CTA 与返回入口', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const detailBuilder = routes.slice(routes.indexOf('function buildCaseDetail'), routes.indexOf('function buildHome'));
        const selectors = ['case-breadcrumb', 'case-overview', "story('case-problem'", "story('case-goal'", "story('case-solution'", 'case-results', '${related}', 'cm-cta', 'case-detail-back'];
        let last = -1;
        selectors.forEach(selector => {
            const current = detailBuilder.indexOf(selector);
            assert.ok(current > last, `${selector} 应存在并保持正确顺序`);
            last = current;
        });
    });

    it('详情统计正确输出 value 和 label，结果标签按标题与说明成对渲染', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const detailBuilder = routes.slice(routes.indexOf('function buildCaseDetail'), routes.indexOf('function buildHome'));

        assert.ok(detailBuilder.includes('<b>${esc(x.value)}</b><i>${esc(x.label)}</i>'));
        assert.match(detailBuilder, /resultTags \|\| \[\]\)\.reduce/);
        assert.match(detailBuilder, /case-result-item/);
        assert.match(detailBuilder, /case-result-value/);
        assert.match(detailBuilder, /case-result-label/);
    });

    it('案例章节导航与正文楼层锚点一一对应', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const detailBuilder = routes.slice(routes.indexOf('function buildCaseDetail'), routes.indexOf('function buildHome'));

        assert.match(detailBuilder, /id="\$\{id\}"/);
        ['case-step-01', 'case-step-02', 'case-step-03'].forEach(id => {
            assert.match(detailBuilder, new RegExp(`href="#${id}"`));
            assert.match(detailBuilder, new RegExp(`story\\('[^']+', '${id}'`));
        });
    });

    it('成果模块使用明确的数值与指标类名，避免依赖视觉顺序猜测', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const detailBuilder = routes.slice(routes.indexOf('function buildCaseDetail'), routes.indexOf('function buildHome'));

        assert.match(detailBuilder, /case-result-value/);
        assert.match(detailBuilder, /case-result-label/);
        assert.doesNotMatch(detailBuilder, /case-result-copy/);
    });

    it('章节导航提供阅读进度与当前章节可访问状态', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const script = read('public/js/rh2026.js');

        assert.match(routes, /case-index-progress/);
        assert.match(script, /case-report-index a\[href\^="#"\]/);
        assert.match(script, /aria-current/);
        assert.match(script, /--case-progress/);
    });

    it('详情路由查询同业相关案例并排除当前案例', function () {
        const routes = read('routes/frontendRoutes2026.js');

        assert.match(routes, /industry: c\.industry/);
        assert.match(routes, /_id: \{ \$ne: c\._id \}/);
        assert.match(routes, /buildCaseDetail\(c, relatedCases\)/);
    });

    it('cm-body 正文样式不依赖弹窗祖先，移动端详情布局降为单列', function () {
        const css = read('public/css/rh2026.css');

        assert.match(css, /\.cm-body h5\{/);
        assert.match(css, /\.cm-body p,\.cm-body li\{/);
        assert.match(css, /@media \(max-width:760px\)\{[\s\S]{0,1200}\.case-story-grid\{grid-template-columns:1fr/);
        assert.match(css, /@media \(max-width:760px\)\{[\s\S]{0,1200}\.case-detail-body\{/);
    });
});
