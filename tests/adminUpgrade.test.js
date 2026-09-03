const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('新版后台升级', function () {
    it('提供外联资源的新版正式控制台', function () {
        const html = read('admin/console.html');

        assert.match(html, /^<!DOCTYPE html>/);
        assert.match(html, /href="\/admin\/admin-2026\.css"/);
        assert.match(html, /src="\/admin\/js\/admin-2026\.js"/);
        assert.doesNotMatch(html, /<style\b/i);
        assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i);
        assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
    });

    it('新版登录页沿用后台视觉并提供完整登录交互', function () {
        const html = read('admin/index.html');
        const script = read('admin/js/login.js');

        assert.match(html, /瑞华智策/);
        assert.match(html, /ADMIN CONSOLE/);
        assert.match(html, /id="loginError"/);
        assert.match(html, /id="togglePassword"/);
        assert.match(html, /autocomplete="username"/);
        assert.match(html, /autocomplete="current-password"/);
        assert.doesNotMatch(html, /bootstrap/i);
        assert.match(script, /togglePassword/);
        assert.match(script, /aria-pressed/);
    });

    it('新版控制台动态内容不生成内联事件', function () {
        const script = read('admin/js/admin-2026.js');

        assert.doesNotMatch(script, /\son[a-z]+\\?=["']/i);
        assert.match(script, /addEventListener\(['"]click['"]/);
        assert.match(script, /addEventListener\(['"]change['"]/);
    });

    it('编辑器提交完整内容且页面内容仅提供编辑操作', function () {
        const script = read('admin/js/admin-2026.js');

        assert.match(script, /\['category','分类','input'\]/);
        ['cover', 'tags', 'problems', 'goals', 'solutions', 'resultTags', 'stats', 'featuredOrder', 'order']
            .forEach(field => assert.match(script, new RegExp(`\\['${field}'`)));
        assert.match(script, /featuredOrder/);
    });

    it('案例更新保留未提交字段和现有精选排序', function () {
        const routes = read('routes/contentRoutes.js');

        assert.match(routes, /sanitizeCasePayload\(req\.body, true\)/);
        assert.match(routes, /hasOwnProperty\.call\(req\.body, 'featuredOrder'\)/);
    });

    it('新版控制台只保留核心运营视图和全局配置', function () {
        const html = read('admin/console.html');

        ['leads', 'articles', 'cases', 'featured', 'faq', 'experts', 'settings']
            .forEach(view => assert.match(html, new RegExp(`data-view="${view}"`)));
        ['attribution', 'pages'].forEach(view => assert.doesNotMatch(html, new RegExp(`data-view="${view}"`)));
        assert.doesNotMatch(html, /数据与配置/);
        assert.match(html, /<div class="nav-title">系统全局配置<\/div>\s*<button[^>]+data-target="settings"[^>]*>[\s\S]*?<span>全局配置<\/span><\/button>/);
        assert.doesNotMatch(html, /dashboard\.html#permissions|权限管理/);
    });

    it('六个核心模块具备设计稿中的筛选、统计、排序和详情交互', function () {
        const html = read('admin/console.html');
        const script = read('admin/js/admin-2026.js');
        ['leads', 'articles', 'cases', 'featured', 'faq', 'experts']
            .forEach(view => assert.match(html, new RegExp(`data-module="${view}"`)));
        ['leadStats', 'leadDrawer', 'articleZone', 'caseIndustry', 'featuredSort', 'faqSort', 'expertList', 'toast']
            .forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
        assert.match(script, /history\.replaceState/);
        assert.match(script, /data-action="open-lead"/);
        assert.match(script, /function moveFeatured/);
        assert.match(script, /function moveFaq/);
        assert.match(script, /\/api\/appointments/);
        assert.match(script, /\/api\/admin\/articles/);
        assert.match(script, /\/api\/admin\/cases/);
        assert.match(script, /\/api\/faqs/);
        assert.match(script, /\/api\/authors/);
    });

    it('导航严格只保留官网运营、新质组织和系统全局配置', function () {
        const html = read('admin/console.html');
        const script = read('admin/js/admin-2026.js');

        ['官网运营', '系统全局配置']
            .forEach(group => assert.match(html, new RegExp(`class="nav-title"[^>]*>${group}<\\/`)));
        assert.match(html, /class="nav-title nqoc-toggle"[^>]*><span>新质组织<\/span>/);
        ['总览', '内容管理', '线索与活动', '活动管理']
            .forEach(group => assert.doesNotMatch(html, new RegExp(`<div class="nav-title">${group}<\\/div>`)));
        ['TOOL_URLS', 'renderTools', 'legacyLinks']
            .forEach(name => assert.doesNotMatch(html + script, new RegExp(name)));
    });

    it('控制台主菜单使用 DEMO 同款内联 SVG 图标', function () {
        const html = read('admin/console.html');
        ['leads', 'articles', 'cases', 'featured', 'faq', 'experts', 'settings'].forEach(target => {
            assert.match(html, new RegExp(`<button[^>]+data-target="${target}"[^>]*>\\s*<svg class="nav-icon"`));
        });
        assert.doesNotMatch(html, /data-target="(?:leads|articles|cases|featured|faq|experts|settings)"[^>]*>\s*[^<]/);
    });

    it('新质组织标题按钮默认收起五项并持久化折叠状态', function () {
        const html = read('admin/console.html');
        const script = read('admin/js/admin-2026.js');
        const nqocItems = html.match(/<a href="\/admin\/nqoc-[^"]+\.html"/g) || [];

        assert.match(html, /<button[^>]+class="nav-title nqoc-toggle"[^>]+aria-expanded="false"[^>]+aria-controls="nqocNavItems"/);
        assert.match(html, /<svg class="nav-arrow"/);
        assert.match(html, /id="nqocNavItems"[^>]+hidden/);
        assert.strictEqual(nqocItems.length, 5);
        assert.match(script, /adminSidebarGroups/);
        assert.match(script, /nqoc.*===\s*true/);
        assert.match(script, /localStorage\.setItem\([^,]+,\s*JSON\.stringify/);
    });

    it('侧栏底部按原型展示用户、修改密码和退出登录', function () {
        const html = read('admin/console.html');
        const script = read('admin/js/admin-2026.js');

        assert.match(html, /id="currentUserName"/);
        assert.match(html, /data-action="change-password"[^>]*>修改密码/);
        assert.match(html, /data-action="logout"[^>]*>退出登录/);
        assert.match(script, /\/api\/auth\/password/);
        assert.match(script, /\/api\/logout/);
        assert.match(script, /sessionStorage\.clear\(\)/);
    });

    it('提供鉴权保护的真实密码修改 API', function () {
        const server = read('server.js');

        assert.match(server, /app\.put\('\/api\/auth\/password', authRequired/);
        assert.match(server, /bcrypt\.compare\(currentPassword, admin\.password\)/);
        assert.match(server, /bcrypt\.hash\(newPassword, 12\)/);
        assert.match(server, /admin\.password = passwordHash/);
        assert.match(server, /admin\.lastPasswordChangedAt = new Date\(\)/);
        assert.match(server, /clearAdminAuthCookie\(res\)/);
    });

    it('官网渠道溯源不复用 NQOC tracking API', function () {
        const files = ['models/Appointment.js', 'routes/appointmentAttributionRoutes.js', 'public/js/rh2026-engine.js'];
        files.forEach(file => assert.doesNotMatch(read(file), /\/api\/tracking|SurveyTrackingLog/i, file));
    });

    it('六个核心业务模块提供独立受保护路由并共用控制台壳', function () {
        const server = read('server.js');
        ['leads', 'articles', 'cases', 'featured', 'faq', 'experts'].forEach(route => {
            assert.match(server, new RegExp(`'/admin/${route}'`));
        });
        assert.match(server, /ADMIN_CONSOLE_ROUTES/);
        assert.match(server, /res\.sendFile\(path\.join\(__dirname, 'admin\/console\.html'\)\)/);
    });

    it('六路由使用独立页面权限，越权访问返回 403，超级管理员 all 保持放行', async function () {
        const server = read('server.js');
        const permissions = read('config/permissions.js');
        const sidebar = read('admin/js/unified-admin-sidebar.js');
        const html = read('admin/console.html');
        const script = read('admin/js/admin-2026.js');
        const expected = {
            leads: ['lead:list', 'appointment:list'],
            articles: 'article:list',
            cases: 'case:list',
            featured: 'featured-case:list',
            faq: 'faq:list',
            experts: 'expert:list'
        };

        assert.match(permissions, /lead:list/);
        assert.match(permissions, /featured-case:list/);
        assert.match(permissions, /expert:list/);
        Object.entries(expected).forEach(([route, perm]) => {
            const literal = Array.isArray(perm) ? `['${perm.join("', '")}']` : `'${perm}'`;
            assert.ok(server.includes(`'/admin/${route}': ${literal}`), `${route} 页面守卫应为 ${literal}`);
        });
        assert.match(sidebar, /线索管理[^\n]+perm: \['lead:list', 'appointment:list'\]/);
        assert.match(sidebar, /首页精选案例[^\n]+perm: 'featured-case:list'/);
        assert.match(sidebar, /讲师 \/ 专家团队[^\n]+perm: 'expert:list'/);
        ['lead:list', 'article:list', 'case:list', 'featured-case:list', 'faq:list', 'expert:list']
            .forEach(perm => assert.match(html, new RegExp(`data-permission="${perm}"`)));
        assert.match(script, /function hasPermission/);
        assert.match(script, /applyPermissions/);

        const jwt = require('jsonwebtoken');
        const { requireAdminPagePermission } = require('../middleware/adminPageAuth');
        const secretKey = 't2-permission-test';
        const token = jwt.sign({ id: 'limited-user' }, secretKey);
        const runGuard = permissions => new Promise(resolve => {
            const AdminModel = { findById: () => ({ populate: async () => ({ isActive: true, roles: [{ permissions }] }) }) };
            const req = { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, cookies: {}, originalUrl: '/admin/featured' };
            const response = { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, set(values) { Object.assign(this.headers, values); return this; }, json(body) { resolve({ status: this.statusCode, body }); }, send(body) { resolve({ status: this.statusCode, body }); } };
            requireAdminPagePermission({ AdminModel, secretKey, requiredPerm: 'featured-case:list' })(req, response, () => resolve({ status: 200 }));
        });
        assert.strictEqual((await runGuard(['case:list'])).status, 403);
        assert.strictEqual((await runGuard(['all'])).status, 200);
    });

    it('控制台从业务路径或旧 hash 恢复模块并支持浏览器前进后退', function () {
        const script = read('admin/js/admin-2026.js');
        assert.match(script, /location\.pathname/);
        assert.match(script, /location\.hash/);
        assert.match(script, /addEventListener\(['"]popstate['"]/);
        assert.match(script, /history\.pushState/);
    });

    it('线索、文章和案例筛选可从 URL 恢复且变更后写回查询参数', function () {
        const script = read('admin/js/admin-2026.js');
        ['leadKeyword', 'leadStatus', 'leadTime', 'articleZone', 'articleStatus', 'articleKeyword', 'caseIndustry', 'caseStatus', 'caseKeyword']
            .forEach(id => assert.match(script, new RegExp(`['"]${id}['"]`)));
        assert.match(script, /new URLSearchParams\(location\.search\)/);
        assert.match(script, /history\.replaceState/);
        assert.match(script, /restoreFilters/);
        assert.match(script, /syncFiltersToUrl/);
    });
});
