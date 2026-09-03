const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pages = {
    'index.html': 'heroWrap',
    'solutions.html': 'data-page="solutions"',
    'about.html': 'data-page="about"'
};

describe('2026 根页面文件替换', function () {
    for (const [filename, marker] of Object.entries(pages)) {
        it(`${filename} 已替换为完整的 2026 页面`, function () {
            const html = fs.readFileSync(path.join(ROOT, filename), 'utf8');

            assert.match(html, /^<!DOCTYPE html>/);
            assert.match(html, new RegExp(marker));
            assert.match(html, /<link rel="stylesheet" href="\/css\/rh2026\.css" \/>/);
            assert.match(html, /<script src="\/js\/rh2026-engine\.js"><\/script>/);
            assert.doesNotMatch(html, /\/css\/(?:styles|tailwind|solutions)\.css/);
        });
    }

    it('桌面导航与正文左侧对齐且 Logo 尺寸适中', function () {
        const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'rh2026.css'), 'utf8');
        const extCss = fs.readFileSync(path.join(ROOT, 'public', 'css', 'rh2026-ext.css'), 'utf8');

        assert.match(css, /padding:0 max\(34px,calc\(\(100vw - 1320px\)\/2 \+ 34px\)\)/);
        assert.match(extCss, /\{height:44px;display:block\}/);
    });

    it('新版根页面只使用外联 CSS、JavaScript 和事件绑定', function () {
        for (const filename of Object.keys(pages)) {
            const html = fs.readFileSync(path.join(ROOT, filename), 'utf8');

            assert.doesNotMatch(html, /\sstyle\s*=/i, `${filename} 含内联 style`);
            assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${filename} 含内联事件`);
            assert.doesNotMatch(html, /<style\b/i, `${filename} 含 style 标签`);
            assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, `${filename} 含内嵌脚本`);
        }
    });
});
