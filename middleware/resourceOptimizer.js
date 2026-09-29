/**
 * 静态资源缓存头部中间件
 *
 * 说明：原 resourceOptimizer（dns-prefetch/preconnect/preload 注入）在 res.send 内读取
 * 尚未写入的 Content-Type，导致永久短路、从未生效，已移除；preconnect/dns-prefetch/preload
 * 由 SSR 模板与 seoInjector 承担。
 */

/**
 * 缓存头部中间件
 */
function setCacheHeaders(req, res, next) {
  const path = req.path;

  // 静态资源（CSS、JS、图片、字体）设置长缓存
  if (/\.(css|js|jpg|jpeg|png|gif|webp|woff|woff2|ttf|svg|ico)$/.test(path)) {
    // 1 年缓存
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // HTML 页面设置短缓存
  else if (/\.html?$/.test(path) || path === '/') {
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
  // API 响应不缓存
  else if (path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  next();
}

module.exports = {
  setCacheHeaders
};
