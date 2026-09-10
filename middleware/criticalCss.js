/**
 * 关键 CSS 提取和内联中间件
 *
 * 功能：
 * 1. 自动提取首屏关键 CSS
 * 2. 内联到 <head> 中
 * 3. 异步加载完整 CSS
 */

const fs = require('fs').promises;
const path = require('path');

// 预定义的关键 CSS（手动提取或自动生成）
const criticalCssCache = {
  '/': null, // 首页关键 CSS
  '/about': null,
  '/training': null
};

// 关键 CSS 选择器规则（首屏必需的样式）
const criticalSelectors = [
  // 布局
  'html', 'body', 'main', 'header', 'nav', 'footer',
  // 首屏元素
  '.hero', '.header', '.nav', '.banner', '.above-fold',
  // 字体
  '@font-face',
  // 关键动画
  '@keyframes fadeIn', '@keyframes slideIn',
  // 工具类
  '.container', '.wrapper', '.grid', '.flex',
  // 响应式
  '@media (max-width: 768px)',
  '@media (min-width: 769px)'
];

/**
 * 从 CSS 文件中提取关键样式
 */
async function extractCriticalCss(cssPath) {
  try {
    const cssContent = await fs.readFile(cssPath, 'utf8');

    // 简单实现：提取匹配关键选择器的规则
    let criticalCss = '';
    const rules = cssContent.match(/[^}]+{[^}]+}/g) || [];

    rules.forEach(rule => {
      // 检查是否匹配关键选择器
      const selector = rule.split('{')[0].trim();
      const isCritical = criticalSelectors.some(cs =>
        selector.includes(cs) ||
        rule.includes(cs)
      );

      if (isCritical) {
        criticalCss += rule + '\n';
      }
    });

    return criticalCss;
  } catch (error) {
    console.error('Failed to extract critical CSS:', error);
    return '';
  }
}

/**
 * 加载或生成关键 CSS
 */
async function loadCriticalCss(pagePath) {
  // 如果已缓存，直接返回
  if (criticalCssCache[pagePath]) {
    return criticalCssCache[pagePath];
  }

  // 尝试加载预生成的关键 CSS
  const criticalCssPath = path.join(__dirname, '../public/css/critical', `${pagePath.replace('/', 'home')}.css`);

  try {
    const criticalCss = await fs.readFile(criticalCssPath, 'utf8');
    criticalCssCache[pagePath] = criticalCss;
    return criticalCss;
  } catch (error) {
    // 如果没有预生成，从主 CSS 中提取
    const mainCssPath = path.join(__dirname, '../public/css/main.css');
    const extracted = await extractCriticalCss(mainCssPath);
    criticalCssCache[pagePath] = extracted;
    return extracted;
  }
}

/**
 * 关键 CSS 内联中间件
 */
async function inlineCriticalCss(req, res, next) {
  const originalSend = res.send;

  res.send = async function(data) {
    const contentType = res.get('Content-Type');
    if (!contentType || !contentType.includes('text/html')) {
      return originalSend.call(this, data);
    }

    try {
      const path = req.path === '/' ? '/' : req.path.replace(/\/$/, '');

      // 只为关键页面内联 CSS
      if (criticalCssCache.hasOwnProperty(path)) {
        const criticalCss = await loadCriticalCss(path);

        if (criticalCss) {
          // 在 </head> 前插入关键 CSS
          const criticalStyle = `<style id="critical-css">${criticalCss}</style>`;
          data = data.replace('</head>', `${criticalStyle}</head>`);

          // 修改主 CSS 为异步加载
          data = data.replace(
            /<link\s+rel="stylesheet"\s+href="([^"]*main\.css[^"]*)"/g,
            '<link rel="preload" href="$1" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">'
          );

          // 添加 noscript 后备
          data = data.replace(
            '</head>',
            '<noscript><link rel="stylesheet" href="/css/main.css"></noscript></head>'
          );
        }
      }

      return originalSend.call(this, data);
    } catch (error) {
      console.error('Critical CSS inline error:', error);
      return originalSend.call(this, data);
    }
  };

  next();
}

module.exports = inlineCriticalCss;
