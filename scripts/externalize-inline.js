/**
 * 内联外联化转换器（供 extract-rh2026-assets.js 调用）
 *
 * 目的：把设计稿页面块/partial 里残留的内联 style= 与 on*= 事件，机械化转成：
 *   - style="X"      → data-sx="sN"，规则写入 public/css/rh2026-ext.css
 *   - onEVT="EXPR"   → data-evt-EVT="eN"，表达式写入 public/js/rh2026-ext.js（事件委托）
 *
 * 设计要点：
 *   - 去重：相同 style 文本 / 相同(事件类型+表达式) 复用同一 id。
 *   - 确定性：首见顺序编号，重复运行输出稳定。
 *   - CSS 用双属性选择器 [data-sx="sN"][data-sx="sN"]（特指度 0,2,0），
 *     等价或高于单类，避免被既有类规则覆盖，且不使用 !important。
 *   - 事件表达式里 location.hash='#/..' 复用链接改写为真实 URL；return false → preventDefault。
 *   - 处理器如 openDrawer/send/toggleMnav/closeCase 均为引擎全局函数，委托可直接调用。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_EXT_CSS = path.join(ROOT, 'public', 'css', 'rh2026-ext.css');
const OUT_EXT_JS = path.join(ROOT, 'public', 'js', 'rh2026-ext.js');

// 与 utils/render2026.js 保持一致的行业 hash → 英文语义分类 URL
const INDUSTRY_MAP = {
  manufacturing: '制造业', retail: '零售快消', finance: '金融财税',
  education: '教育', game: '游戏文娱', trade: '贸易物流',
  property: '物业地产', other: '其他'
};

// 事件表达式改写：hash 路由 → 真实 URL；return false → preventDefault
function rewriteExpr(expr) {
  expr = expr.replace(/location\.hash\s*=\s*'#\/cases\/([a-z]+)'/g, (m, key) => {
    return INDUSTRY_MAP[key] ? `location.href='/cases/industry/${key}'` : "location.href='/cases'";
  });
  expr = expr.replace(/location\.hash\s*=\s*'#\/insights[^']*'/g, "location.href='/insights'");
  expr = expr.replace(/location\.hash\s*=\s*'#\/solutions\/([a-z]+)'/g, "location.href='/solutions/$1'");
  expr = expr.replace(/location\.hash\s*=\s*'#\/([^']*)'/g, (m, rest) => `location.href='/${rest}'`);
  // 尾部 return false → preventDefault；其余 return false 同样处理
  expr = expr.replace(/;?\s*return\s+false\s*;?\s*$/, '; event.preventDefault();');
  expr = expr.replace(/return\s+false/g, 'event.preventDefault()');
  return expr.trim();
}

function createExternalizer() {
  const styleMap = new Map();          // styleText -> id
  const eventMap = new Map();          // `${type}\n${expr}` -> { id, type, expr }
  let styleSeq = 0, eventSeq = 0;

  function styleId(text) {
    if (styleMap.has(text)) return styleMap.get(text);
    const id = 's' + (++styleSeq);
    styleMap.set(text, id);
    return id;
  }
  function eventId(type, rawExpr) {
    const expr = rewriteExpr(rawExpr);
    const key = type + '\n' + expr;
    if (eventMap.has(key)) return eventMap.get(key).id;
    const id = 'e' + (++eventSeq);
    eventMap.set(key, { id, type, expr });
    return id;
  }

  // 转换一段 HTML：先事件后样式（两类互不重叠，独立替换）
  function transform(html) {
    html = html.replace(/\son([a-z]+)="([^"]*)"/g, (m, type, expr) => {
      const id = eventId(type, expr);
      return ` data-evt-${type}="${id}"`;
    });
    html = html.replace(/\sstyle="([^"]*)"/g, (m, text) => {
      const id = styleId(text);
      return ` data-sx="${id}"`;
    });
    return html;
  }

  function writeAssets() {
    // CSS：双属性选择器提升特指度
    let css = '/* 本文件由 scripts/extract-rh2026-assets.js 自动生成：外联化原内联 style。请勿手改。 */\n';
    for (const [text, id] of styleMap) {
      css += `[data-sx="${id}"][data-sx="${id}"]{${text}}\n`;
    }
    fs.writeFileSync(OUT_EXT_CSS, css, 'utf8');

    // JS：处理器表 + 按事件类型的委托绑定
    const types = new Set();
    let table = '';
    for (const { id, type, expr } of eventMap.values()) {
      types.add(type);
      table += `    ${id}: function (event) { ${expr} },\n`;
    }
    let js = '/* 本文件由 scripts/extract-rh2026-assets.js 自动生成：外联化原内联事件（事件委托）。请勿手改。 */\n';
    js += '(function () {\n';
    js += '  "use strict";\n';
    js += '  var H = {\n' + table + '  };\n';
    for (const type of types) {
      js += `  document.addEventListener('${type}', function (event) {\n`;
      js += `    var el = event.target && event.target.closest ? event.target.closest('[data-evt-${type}]') : null;\n`;
      js += `    if (!el) return;\n`;
      js += `    var fn = H[el.getAttribute('data-evt-${type}')];\n`;
      js += `    if (fn) fn.call(el, event);\n`;
      js += `  }, false);\n`;
    }
    js += '})();\n';
    fs.writeFileSync(OUT_EXT_JS, js, 'utf8');

    return { styles: styleMap.size, events: eventMap.size, types: [...types] };
  }

  return { transform, writeAssets };
}

module.exports = { createExternalizer, rewriteExpr };
