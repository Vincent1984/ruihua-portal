/**
 * 由 public/js/rh2026.js 生成 public/js/rh2026-engine.js
 *
 * 目的：让设计稿的完整视觉引擎（3D 隧道 Hero、tileSVG、data-art、光墙、reveal 动画、
 * 案例弹窗等）能安全运行在多页 SSR 的每一个页面上，而不被 SPA hash 路由劫持或崩溃。
 *
 * 补丁：route() 加空值保护，无 #heroWrap（非首页）时直接返回，避免 SPA 逻辑与崩溃。
 *
 * 幂等：可重复运行。运行：node scripts/build-rh2026-engine.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'js', 'rh2026.js');
const OUT = path.join(ROOT, 'public', 'js', 'rh2026-engine.js');

function main() {
  let js = fs.readFileSync(SRC, 'utf8');

  // 补丁 1：route() 加空值保护
  const routeMarker = 'function route(){\n  const raw=(location.hash||\'#/\').replace(\'#/\',\'\');';
  if (!js.includes(routeMarker)) throw new Error('未找到 route() 入口，源文件结构可能已变');
  js = js.replace(
    routeMarker,
    'function route(){\n'
    + '  // [engine patch] 非首页（无 #heroWrap）不执行 SPA 路由逻辑\n'
    + '  if(!document.getElementById(\'heroWrap\')) return;\n'
    + '  const raw=(location.hash||\'#/\').replace(\'#/\',\'\');'
  );

  const banner = '/* 本文件由 scripts/build-rh2026-engine.js 自动生成，请勿手改。源：public/js/rh2026.js */\n';
  fs.writeFileSync(OUT, banner + js, 'utf8');
  console.log(`[engine] 生成 ${path.relative(ROOT, OUT)}（${js.length} chars）`);
}

main();
