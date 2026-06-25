/**
 * 本地"忠实"预览服务器 —— 仅供开发预览，不参与生产。
 *
 * 复刻 server.js 的静态路径映射，让根绝对路径（/css、/js、/images...）能正确解析，
 * 从而在浏览器里看到与生产一致的页面，且无需 MongoDB。
 *
 * 解析顺序（与 server.js 行为对齐）：
 *   1) 先在 ./public 下找（/css、/js、/images、/uploads 等静态资源）
 *   2) 再在项目根下找（index.html 及根目录其它 .html 页面）
 *
 * 启动：node scripts/preview-server.js   （默认端口 4173，可用 PORT 覆盖）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = process.env.PORT || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

function tryServe(res, absPath) {
  // 防目录穿越
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(ROOT)) return false;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return false;
  const ext = path.extname(resolved).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(resolved).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // 1) public 优先（静态资源），2) 项目根（根 HTML 页面）
  if (tryServe(res, path.join(PUBLIC, urlPath))) return;
  if (tryServe(res, path.join(ROOT, urlPath))) return;

  // 目录式 URL 兜底：/about/ -> about.html
  const trimmed = urlPath.replace(/\/$/, '');
  if (trimmed && tryServe(res, path.join(ROOT, trimmed + '.html'))) return;
  if (trimmed && tryServe(res, path.join(PUBLIC, trimmed + '.html'))) return;

  const notFound = path.join(ROOT, '404.html');
  if (fs.existsSync(notFound)) {
    res.writeHead(404, { 'Content-Type': MIME['.html'] });
    return fs.createReadStream(notFound).pipe(res);
  }
  send(res, 404, 'Not Found');
});

server.listen(PORT, () => {
  console.log(`[preview] 忠实静态预览服务器已启动: http://localhost:${PORT}/`);
  console.log('[preview] 仅供本地预览，不参与生产部署。');
});
