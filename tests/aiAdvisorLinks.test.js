const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'public/js/rh2026.js'), 'utf8');

describe('AI 顾问对话框动态链接回归', function () {
  it('来源卡使用真实 SSR 路径并保留首页锚点', function () {
    assert.match(source, /<a href="\$\{s\[2\]\|\|''\}\$\{s\[3\]\?'#'\+s\[3\]:''\}" class="src"/);
    assert.doesNotMatch(source, /<a href="#\$\{s\[2\]/);
    assert.ok(source.includes("src:[['预约「AI 场景诊断」','服务入口','/contact']"));
    assert.ok(source.includes("['三位一体交付模式','首页','/','home-svc']"));
  });

  it('隐私政策文字是可点击的 /privacy 链接', function () {
    assert.match(source, /<a href="\/privacy">隐私政策<\/a>/);
  });

  it('对话框内直接跳转不使用 hash SPA 路径', function () {
    assert.doesNotMatch(source, /class="src"[^>]*href="#/);
  });
});
