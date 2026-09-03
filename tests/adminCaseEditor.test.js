const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('CMS 案例编辑器体验', function () {
    it('案例模式提供分区导航和四个语义化编辑步骤', function () {
        const script = read('admin/js/article-management.js');

        assert.match(script, /case-editor-nav/);
        ['case-section-basic', 'case-section-story', 'case-section-impact', 'case-section-publish'].forEach(id => {
            assert.match(script, new RegExp(`id="${id}"`));
            assert.match(script, new RegExp(`href="#${id}"`));
        });
    });

    it('案例字段按基础信息、项目复盘、成果数据和发布设置分组', function () {
        const script = read('admin/js/article-management.js');
        const caseConfig = script.slice(script.indexOf("} else {", script.indexOf('window.openStudio')), script.indexOf('// 渲染 GEO 侧边栏'));

        ['基础信息', '项目复盘', '成果数据', '发布设置'].forEach(title => assert.match(caseConfig, new RegExp(title)));
        ['caseClient', 'caseIndustry', 'caseProblems', 'caseGoals', 'caseSolutions', 'caseStats', 'caseResultTags', 'caseOnlineBtn'].forEach(id => {
            assert.match(caseConfig, new RegExp(`id="${id}"`));
        });
    });

    it('保存时检查 HTTP 响应并在失败时保留编辑器', function () {
        const script = read('admin/js/article-management.js');
        const save = script.slice(script.indexOf('async function saveStudioData'), script.indexOf('window.updateSeoDescCount'));

        assert.match(save, /const response = await fetch/);
        assert.match(save, /if \(!response\.ok\)/);
        assert.match(save, /throw new Error/);
        assert.ok(save.indexOf('if (!response.ok)') < save.indexOf('closeStudio()'));
    });

    it('案例编辑器具备桌面双栏与移动端单栏布局', function () {
        const css = read('admin/admin-2026.css');

        assert.match(css, /\.studio\.case-mode/);
        assert.match(css, /\.case-editor-nav/);
        assert.match(css, /\.case-config-section/);
        assert.match(css, /@media\(max-width:860px\)[\s\S]*\.studio\.case-mode/);
    });

    it('案例概览使用普通文本框而不是富文本编辑器', function () {
        const html = read('admin/console.html');
        const script = read('admin/js/article-management.js');
        const save = script.slice(script.indexOf('async function saveStudioData'), script.indexOf('window.updateSeoDescCount'));

        assert.match(html, /id="caseOverviewInput"/);
        assert.match(script, /caseOverviewInput/);
        assert.match(save, /background:\s*document\.getElementById\('caseOverviewInput'\)\.value\.trim\(\)/);
        assert.match(read('admin/admin-2026.css'), /\.studio\.case-mode \.studio-toolbar[^}]*display:none/);
    });

    it('前台将历史富文本概览转换为安全纯文本段落', function () {
        const routes = read('routes/frontendRoutes2026.js');
        const detail = routes.slice(routes.indexOf('function buildCaseDetail'), routes.indexOf('function buildHome'));

        assert.match(detail, /plainTextFromHtml\(c\.background/);
        assert.match(detail, /case-overview-content/);
        assert.doesNotMatch(detail, /\$\{c\.background \|\|/);
    });
});
