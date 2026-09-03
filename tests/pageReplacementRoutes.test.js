const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function request(pathname) {
    return fetch(BASE_URL + pathname, { redirect: 'manual' });
}

describe('2026 页面替换路由', function () {
    const newPages = [
        '/solutions',
        '/solutions/training',
        '/solutions/consulting',
        '/solutions/fde',
        '/hcvm',
        '/insights',
        '/insights/industry',
        '/insights/thinktank',
        '/about',
        '/about/team',
        '/contact'
    ];

    for (const pathname of newPages) {
        it(`${pathname} 返回 2026 SSR 页面`, async function () {
            const response = await request(pathname);
            const html = await response.text();

            assert.strictEqual(response.status, 200);
            assert.match(html, /\/js\/rh2026-engine\.js/);
        });
    }

    it('/about/team 独立呈现团队区且不重复公司介绍块', async function () {
        const response = await request('/about/team');
        const html = await response.text();

        assert.strictEqual(response.status, 200);
        assert.match(html, /id="about-team"/);
        assert.match(html, /团队基因|先自己跑通，再服务客户/);
        assert.doesNotMatch(html, /data-page="about"/);
    });

    it('非 NQOC 根页面源文件不重复维护主站导航和页脚', function () {
        const files = [
            '404.html', 'privacy.html', 'resources.html', 'video-detail.html',
            'article.html', 'training.html', 'videos.html', 'efficiency-diagnostic.html',
            'productivity.html', 'diagnostic.html', 'diagnostic-result.html',
            'event-registration.html', 'index.html', 'about.html', 'solutions.html'
        ];
        for (const filename of files) {
            const html = fs.readFileSync(path.join(ROOT, filename), 'utf8');
            assert.doesNotMatch(html, /<nav\s+[^>]*(?:class=["'][^"']*\bnav\b|id=["']nav["'])/i, filename);
            assert.doesNotMatch(html, /<(?:header|div)\s+[^>]*(?:id=["'](?:mobileMenu|mnav|footer-container)["']|class=["'][^"']*(?:mega-sheet|mega-dim|mnav)[^"']*)/i, filename);
            assert.doesNotMatch(html, /<footer\b/i, filename);
            assert.doesNotMatch(html, /data:image\/[^;"']+;base64/i, filename);
        }
    });

    it('非 NQOC 旧版页面通过统一公共壳渲染，NQOC 页面保持独立页面壳', function () {
        const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
        assert.match(server, /renderStaticHtmlWith2026Shell/);
        assert.match(server, /app\.get\('\/videos\/', \(req, res\) => renderStaticHtmlWith2026Shell\(req, res, 'videos\.html'\)\)/);
        assert.match(server, /app\.get\('\/nqoc', \(req, res\) => \{/);
        assert.doesNotMatch(server, /app\.get\('\/nqoc', \(req, res\) => renderStaticHtmlWith2026Shell/);
        assert.match(fs.readFileSync(path.join(ROOT, 'views', '2026', 'partials', 'nav.html'), 'utf8'), /href="\/nqoc"/);
    });

    it('桌面、移动导航和页脚均指向团队页', function () {
        for (const filename of ['nav.html', 'mobile-nav.html', 'footer.html']) {
            const html = fs.readFileSync(path.join(ROOT, 'views', '2026', 'partials', filename), 'utf8');
            assert.match(html, /\/about\/team/);
        }
    });

    it('2026 页脚研究链接分别指向对应页面', function () {
        const footer = fs.readFileSync(path.join(ROOT, 'views', '2026', 'partials', 'footer.html'), 'utf8');

        assert.match(footer, /href="\/insights\/thinktank">经营智库<\/a>/);
        assert.match(footer, /href="\/nqoc"[^>]*>新质组织研究<\/a>/);
    });

    it('sitemap 收录 2026 规范 URL，并排除下架文章与案例', function () {
        const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
        const canonicalPaths = [
            'solutions', 'solutions/training', 'solutions/consulting', 'solutions/fde',
            'hcvm', 'cases', 'insights', 'insights/industry', 'insights/thinktank',
            'about', 'about/team', 'contact'
        ];

        canonicalPaths.forEach(url => assert.match(server, new RegExp(`url: '${url}'`), `sitemap 缺少 /${url}`));
        assert.match(server, /Article\.find\(\{ status: 'published', isOnline: \{ \$ne: false \}, slug:/);
        assert.match(server, /Case\.find\(\{ status: 'published', isOnline: \{ \$ne: false \}, slug:/);
        assert.match(server, /encodeURIComponent\(c\.slug\)/);
    });

    it('桌面与移动导航包含可由当前路径激活的 About 标识', function () {
        const nav = fs.readFileSync(path.join(ROOT, 'views', '2026', 'partials', 'nav.html'), 'utf8');
        const mobileNav = fs.readFileSync(path.join(ROOT, 'views', '2026', 'partials', 'mobile-nav.html'), 'utf8');
        assert.match(nav, /data-nav-key="about"/, '桌面导航缺少可激活的 About 标识');
        assert.match(mobileNav, /data-nav-key="about"/, '移动导航缺少可激活的 About 标识');
    });

    it('2026 模板与脚本生成链接不再使用 hash 路由，同时保留旧 SPA 路由解析', function () {
        const viewsRoot = path.join(ROOT, 'views', '2026');
        const htmlFiles = [];
        const collectHtml = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) collectHtml(fullPath);
            else if (entry.name.endsWith('.html')) htmlFiles.push(fullPath);
        });
        collectHtml(viewsRoot);

        htmlFiles.forEach(file => {
            const html = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(html, /href=["']#\//, `${path.relative(ROOT, file)} 仍含可点击 #/ 链接`);
        });

        const script = fs.readFileSync(path.join(ROOT, 'public', 'js', 'rh2026.js'), 'utf8');
        assert.doesNotMatch(script, /href=["'`]#\//, '脚本仍生成 #/ 链接');
        assert.doesNotMatch(script, /(?:src:\[|\bh:)['"]#\//, '用户内容索引仍使用 #/ 链接');
        assert.match(script, /location\.hash\|\|'#\/'/);
        assert.match(script, /replace\('#\/',\s*''\)/);
        assert.match(script, /addEventListener\('hashchange',route\)/);
    });

    const legacyRedirects = {
        '/solutions/': '/solutions',
        '/solutions.html': '/solutions',
        '/solutions-hcvm/': '/hcvm',
        '/solutions-hcvm.html': '/hcvm',
        '/solutions-ohcvm/': '/solutions',
        '/solutions-ohcvm.html': '/solutions',
        '/about/': '/about',
        '/about.html': '/about'
    };

    for (const [pathname, target] of Object.entries(legacyRedirects)) {
        it(`${pathname} 301 跳转到 ${target}`, async function () {
            const response = await request(pathname);

            assert.strictEqual(response.status, 301);
            assert.strictEqual(response.headers.get('location'), target);
        });
    }
});
