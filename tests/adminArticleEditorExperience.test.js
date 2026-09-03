const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('CMS 文章编辑器体验', function () {
    it('Slug 使用英文小写短横线格式并预览真实静态 URL', function () {
        const script = read('admin/js/article-management.js');
        assert.match(script, /function normalizeSeoSlug/);
        assert.match(script, /\.slice\(0, 60\)/);
        assert.match(script, /\/insights\/\$\{cleanSlug\}/);
        assert.doesNotMatch(script, /\/article\/\$\{cleanSlug\}\.html/);
    });

    it('分类下拉提供就地新增分类入口并调用分类 API', function () {
        const script = read('admin/js/article-management.js');
        assert.match(script, /value="__new__"/);
        assert.match(script, /id="newCategoryFields"/);
        assert.match(script, /async function saveInlineCategory/);
        assert.match(script, /fetch\('\/api\/categories'/);
    });

    it('选择手动输入作者后显示姓名与简介字段', function () {
        const script = read('admin/js/article-management.js');
        assert.match(script, /id="manualAuthorFields" hidden/);
        assert.match(script, /manualDiv\.hidden = val !== 'manual'/);
        assert.match(script, /id="artAuthor"/);
        assert.match(script, /id="artAuthorDesc"/);
    });

    it('核心摘要限制 150 字且支持从正文提炼', function () {
        const script = read('admin/js/article-management.js');
        assert.match(script, /id="artDesc"[^>]*maxlength="150"/);
        assert.match(script, /基于正文提炼/);
        assert.match(script, /data\.summary\.slice\(0, 150\)/);
        assert.match(script, /summary:\s*document\.getElementById\('artDesc'\)\.value\.trim\(\)\.slice\(0, 150\)/);
    });

    it('保存前阻止无效 Slug、未完成的新增分类和空手动作者', function () {
        const script = read('admin/js/article-management.js');
        const save = script.slice(script.indexOf('async function saveStudioData'), script.indexOf('window.updateSeoDescCount'));

        assert.match(save, /if \(!articleSlug\)/);
        assert.match(save, /categoryValue === '__new__'/);
        assert.match(save, /authorVal === 'manual' && !manualAuthor\.name/);
        assert.match(save, /Slug 必须由英文小写字母/);
    });
});
