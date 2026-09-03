/**
 * 阶段 0 · 资产抽取脚本
 *
 * 从设计稿 new/rh2026.html 中机械化抽取：
 *   1) <style> → public/css/rh2026.css
 *   2) 末尾 <script> → public/js/rh2026.js
 *   3) 公共骨架 partial（nav / 移动菜单 / footer / AI 抽屉）→ views/2026/partials/*.html
 *
 * 幂等：可重复运行，每次覆盖输出。仅做文本切分，不改动源文件。
 *
 * 运行：node scripts/extract-rh2026-assets.js
 */
const fs = require('fs');
const path = require('path');
const { createExternalizer } = require('./externalize-inline');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'new', 'rh2026.html');

// 首页整改范围：仅对首页块与其 partial 做内联外联化（style=/on*= → 外部 css/js）
const EXT = createExternalizer();

const OUT_CSS = path.join(ROOT, 'public', 'css', 'rh2026.css');
const OUT_JS = path.join(ROOT, 'public', 'js', 'rh2026.js');
const PARTIAL_DIR = path.join(ROOT, 'views', '2026', 'partials');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** 抽取第一个 <tag>…</tag> 之间的内部内容（不含标签本身） */
function sliceInner(html, openTag, closeTag, fromIndex = 0) {
  const start = html.indexOf(openTag, fromIndex);
  if (start === -1) throw new Error(`未找到 ${openTag}`);
  const contentStart = start + openTag.length;
  const end = html.indexOf(closeTag, contentStart);
  if (end === -1) throw new Error(`未找到 ${closeTag}`);
  return { inner: html.slice(contentStart, end), start, end: end + closeTag.length };
}

/** 抽取包含标签在内的整块 <tagStart …> … <tagEndFull>（按标记定位） */
function sliceBlock(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  if (start === -1) throw new Error(`未找到起始标记：${startMarker}`);
  const end = html.indexOf(endMarker, start);
  if (end === -1) throw new Error(`未找到结束标记：${endMarker}`);
  return html.slice(start, end + endMarker.length);
}

function main() {
  const html = fs.readFileSync(SRC, 'utf8');

  // 1) CSS
  const css = sliceInner(html, '<style>', '</style>');
  ensureDir(path.dirname(OUT_CSS));
  fs.writeFileSync(OUT_CSS, css.inner.trim() + '\n', 'utf8');
  console.log(`[css] ${path.relative(ROOT, OUT_CSS)}  (${css.inner.length} chars)`);

  // 2) JS —— 末尾 <script>（正文之后、</body> 之前的那个）
  const lastScriptOpen = html.lastIndexOf('<script>');
  const js = sliceInner(html, '<script>', '</script>', lastScriptOpen);
  ensureDir(path.dirname(OUT_JS));
  fs.writeFileSync(OUT_JS, js.inner.trim() + '\n', 'utf8');
  console.log(`[js]  ${path.relative(ROOT, OUT_JS)}  (${js.inner.length} chars)`);

  // 3) 公共骨架 partial
  ensureDir(PARTIAL_DIR);

  // nav（含 mega 菜单与 mega-dim）：<nav class="nav" … 到 <div class="mega-dim" …></div>
  const nav = EXT.transform(sliceBlock(html, '<nav class="nav"', '<div class="mega-dim" id="megaDim"></div>'));
  fs.writeFileSync(path.join(PARTIAL_DIR, 'nav.html'), nav.trim() + '\n', 'utf8');
  console.log(`[partial] nav.html (${nav.length} chars)`);

  // 移动端全屏菜单（切到 Hero 注释前，剔除注释本身）
  const mnavRaw = sliceBlock(html, '<div class="mnav" id="mnav">', '<!-- ============ Hero');
  const mnav = EXT.transform(mnavRaw.slice(0, mnavRaw.indexOf('<!-- ============ Hero')));
  fs.writeFileSync(path.join(PARTIAL_DIR, 'mobile-nav.html'), mnav.trim() + '\n', 'utf8');
  console.log(`[partial] mobile-nav.html (${mnav.length} chars)`);

  // footer
  const footer = EXT.transform(sliceBlock(html, '<footer class="footer">', '</footer>'));
  fs.writeFileSync(path.join(PARTIAL_DIR, 'footer.html'), footer.trim() + '\n', 'utf8');
  console.log(`[partial] footer.html (${footer.length} chars)`);

  // AI 顾问悬浮按钮 + 抽屉（含案例弹窗容器）
  const drawer = EXT.transform(sliceBlock(html, '<div class="cmodal" id="cmodal">', '</aside>'));
  fs.writeFileSync(path.join(PARTIAL_DIR, 'drawer.html'), drawer.trim() + '\n', 'utf8');
  console.log(`[partial] drawer.html (${drawer.length} chars)`);

  // ===== 页面块（真实结构，供 SSR 各页复用）=====
  const BLOCK_DIR = path.join(ROOT, 'views', '2026', 'page-blocks');
  ensureDir(BLOCK_DIR);

  // 首页块：hero（#heroWrap）+ homeMain（到 </main>）—— 内联外联化
  const homeBlock = EXT.transform(sliceBlock(html, '<div class="j3d-scroll" id="heroWrap"', '</main>'));
  fs.writeFileSync(path.join(BLOCK_DIR, 'home.html'), homeBlock.trim() + '\n', 'utf8');
  console.log(`[block] home.html (${homeBlock.length} chars)`);

  // 各 .page[data-page] 块：从每个 <div class="page" data-page="X"> 到下一个块注释或页脚
  // 用注释分隔符定位每个块的结束（下一个 <!-- ==== 或 页脚注释）
  const pageRe = /<div class="page" data-page="([^"]+)">/g;
  let m;
  const starts = [];
  while ((m = pageRe.exec(html)) !== null) starts.push({ key: m[1], idx: m.index });
  // 结束边界：footer 注释
  const footerIdx = html.indexOf('<!-- ============ 页脚');
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const endIdx = (i + 1 < starts.length) ? starts[i + 1].idx : footerIdx;
    // 回退到上一个块注释前（去掉尾部的 <!-- ==== 注释行）
    let chunk = html.slice(s.idx, endIdx);
    const cmt = chunk.lastIndexOf('\n<!-- ====');
    if (cmt !== -1) chunk = chunk.slice(0, cmt);
    chunk = EXT.transform(chunk);
    fs.writeFileSync(path.join(BLOCK_DIR, `${s.key}.html`), chunk.trim() + '\n', 'utf8');
    console.log(`[block] ${s.key}.html (${chunk.length} chars)`);
  }

  // 写出外联化产物（首页块 + partial 的内联 style/事件）
  const ext = EXT.writeAssets();
  console.log(`[ext] rh2026-ext.css (${ext.styles} styles) / rh2026-ext.js (${ext.events} events: ${ext.types.join(',')})`);

  // 4) 正式根页面：实际覆盖旧版文件，根文件与 SSR 共用同一套模板和页面块
  const { render2026, loadBlock, clearCache } = require('../utils/render2026');
  clearCache();
  const rootPages = {
    'index.html': {
      block: 'home',
      title: '瑞华智策 · AI 时代组织进化全生命周期服务商',
      description: '瑞华智策：AI 赋能培训、AI 转型咨询、AI 落地陪跑三位一体，陪企业走完 AI 转型全程。'
    },
    'solutions.html': {
      block: 'solutions',
      title: '产品与服务 · 三位一体 | 瑞华智策',
      description: 'AI 赋能培训、AI 转型咨询、AI 落地陪跑三位一体，可单独采购，也可组合成一体化方案。'
    },
    'about.html': {
      block: 'about',
      title: '关于我们 · AI 原生咨询公司 | 瑞华智策',
      description: '瑞华智策：人瑞人才全资子公司，AI 原生的本土咨询机构。'
    }
  };
  for (const [filename, page] of Object.entries(rootPages)) {
    const output = render2026({
      title: page.title,
      description: page.description,
      content: loadBlock(page.block)
    });
    fs.writeFileSync(path.join(ROOT, filename), output, 'utf8');
    console.log(`[page] ${filename} (${output.length} chars)`);
  }

  console.log('\n资产抽取完成。');
}

main();
