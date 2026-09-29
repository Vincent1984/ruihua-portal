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

        // 桌面导航与正文容器共用同一 34px 水平内边距，保证左侧对齐
        assert.match(css, /\.nav\{[^}]*padding:0 34px/);
        assert.match(css, /\.sub-hero \.wrap,\.section \.wrap\{max-width:1320px;margin:0 auto;padding:0 34px\}/);
        // Logo 图片由外联样式限定高度，尺寸适中
        assert.match(extCss, /\[data-sx="b1"\]\[data-sx="b1"\]\{height:52px;display:block\}/);
    });

    it('网站数字与英文统一使用同一字体栈', function () {
        const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'rh2026.css'), 'utf8');

        // 正文与标题统一为同一黑体字栈（--serif 现为 --sans 的别名）
        const sans = (css.match(/--sans:([^;]+);/) || [])[1];
        const serif = (css.match(/--serif:([^;]+);/) || [])[1];
        assert.ok(sans && serif && sans === serif, '--serif 应与 --sans 指向同一字体族');
        assert.match(sans, /PingFang SC/i);
        // 数字/英文统一走 --mono 等宽字栈
        assert.match(css, /--mono:[^;]*JetBrains Mono/i);
        assert.match(css, /body\{[^}]*font-family:var\(--sans\)/);
    });

    it('联系表单提交成功后展示完整确认回执', function () {
        const script = fs.readFileSync(path.join(ROOT, 'public', 'js', 'rh2026-engine.js'), 'utf8');
        const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'rh2026.css'), 'utf8');

        assert.match(script, /class="ok-msg"[^>]*role="status"/);
        assert.match(script, /class="ok-msg__mark"/);
        assert.match(script, /预约信息已确认/);
        assert.match(script, /1 个工作日内/);
        assert.match(css, /\.form\.is-success/);
        assert.match(css, /\.ok-msg__mark/);
    });

    it('新版根页面只使用外联 CSS、JavaScript 和事件绑定', function () {
        for (const filename of Object.keys(pages)) {
            const html = fs.readFileSync(path.join(ROOT, filename), 'utf8');

            assert.doesNotMatch(html, /\sstyle\s*=/i, `${filename} 含内联 style`);
            assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${filename} 含内联事件`);
            assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, `${filename} 含内嵌脚本`);
        }
    });
});
