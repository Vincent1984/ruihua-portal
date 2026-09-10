/**
 * 资源优化中间件
 *
 * 功能：
 * 1. 添加资源预加载提示
 * 2. 优化字体加载
 * 3. 添加 DNS 预解析
 * 4. 设置缓存头部
 */

const cheerio = require('cheerio');

// 预连接的第三方域名
const preconnectDomains = [
  'https://fonts.googleapis.com',
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com'
];

// DNS 预解析的域名
const dnsPrefetchDomains = [
  '//hm.baidu.com',
  '//cdn.tailwindcss.com',
  '//unpkg.com'
];

// 需要预加载的关键资源
const preloadResources = {
  '/': [
    { href: '/css/rh2026.css', as: 'style' },
    { href: '/fonts/main.woff2', as: 'font', type: 'font/woff2', crossorigin: true }
  ],
  '/about': [
    { href: '/css/main.css', as: 'style' }
  ]
};

/**
 * 资源优化中间件
 */
function resourceOptimizer(req, res, next) {
  const originalSend = res.send;

  res.send = function(data) {
    const contentType = res.get('Content-Type');
    if (!contentType || !contentType.includes('text/html')) {
      return originalSend.call(this, data);
    }

    try {
      const $ = cheerio.load(data);
      const path = req.path === '/' ? '/' : req.path.replace(/\/$/, '');

      // 1. 添加 DNS 预解析
      dnsPrefetchDomains.forEach(domain => {
        if ($(`link[rel="dns-prefetch"][href="${domain}"]`).length === 0) {
          $('head').prepend(`<link rel="dns-prefetch" href="${domain}">`);
        }
      });

      // 2. 添加预连接
      preconnectDomains.forEach(domain => {
        if ($(`link[rel="preconnect"][href="${domain}"]`).length === 0) {
          $('head').prepend(`<link rel="preconnect" href="${domain}" crossorigin>`);
        }
      });

      // 3. 添加资源预加载
      const resources = preloadResources[path] || [];
      resources.forEach(resource => {
        let preloadTag = `<link rel="preload" href="${resource.href}" as="${resource.as}"`;
        if (resource.type) preloadTag += ` type="${resource.type}"`;
        if (resource.crossorigin) preloadTag += ` crossorigin`;
        preloadTag += '>';

        if ($(`link[rel="preload"][href="${resource.href}"]`).length === 0) {
          $('head').append(preloadTag);
        }
      });

      // 4. 优化字体加载：添加 font-display: swap
      $('style, link[rel="stylesheet"]').each((i, elem) => {
        const $elem = $(elem);
        if ($elem.is('style')) {
          let content = $elem.html();
          // 为 @font-face 添加 font-display: swap
          content = content.replace(
            /(@font-face\s*{[^}]*)(})/g,
            '$1font-display: swap;$2'
          );
          $elem.html(content);
        }
      });

      // 5. 优化 iframe：添加 loading="lazy"
      $('iframe').each((i, elem) => {
        const $iframe = $(elem);
        if (!$iframe.attr('loading') && i >= 1) {
          $iframe.attr('loading', 'lazy');
        }
      });

      // 6. 添加性能监控代码（简单版）
      const perfScript = `
<script>
// 记录页面性能指标
window.addEventListener('load', function() {
  if ('performance' in window) {
    const perfData = performance.getEntriesByType('navigation')[0];
    if (perfData) {
      console.log('[Performance]', {
        'DNS': Math.round(perfData.domainLookupEnd - perfData.domainLookupStart) + 'ms',
        'TCP': Math.round(perfData.connectEnd - perfData.connectStart) + 'ms',
        'Request': Math.round(perfData.responseStart - perfData.requestStart) + 'ms',
        'Response': Math.round(perfData.responseEnd - perfData.responseStart) + 'ms',
        'DOM': Math.round(perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart) + 'ms',
        'Load': Math.round(perfData.loadEventEnd - perfData.loadEventStart) + 'ms',
        'Total': Math.round(perfData.loadEventEnd - perfData.fetchStart) + 'ms'
      });
    }
  }
});
</script>`;

      // 只在开发环境添加性能监控
      if (process.env.NODE_ENV !== 'production') {
        $('body').append(perfScript);
      }

      return originalSend.call(this, $.html());
    } catch (error) {
      console.error('Resource optimizer error:', error);
      return originalSend.call(this, data);
    }
  };

  next();
}

/**
 * 静态资源缓存头部中间件
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

/**
 * Gzip 压缩提示头部
 */
function compressionHeaders(req, res, next) {
  const acceptEncoding = req.headers['accept-encoding'] || '';

  // 如果客户端支持 Brotli
  if (acceptEncoding.includes('br')) {
    res.set('Content-Encoding', 'br');
  }
  // 如果客户端支持 Gzip
  else if (acceptEncoding.includes('gzip')) {
    res.set('Content-Encoding', 'gzip');
  }

  next();
}

module.exports = {
  resourceOptimizer,
  setCacheHeaders,
  compressionHeaders
};
