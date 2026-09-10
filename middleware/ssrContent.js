/**
 * SSR 内容注入中间件
 * 为 JS 动态加载的内容提供服务端渲染的 HTML 后备
 *
 * 解决问题：
 * 1. 百度爬虫不执行 JS，看不到动态内容
 * 2. Google 爬虫执行 JS 有延迟
 * 3. 用户禁用 JS 时页面不可用
 */

const cheerio = require('cheerio');
const {
  renderClientLogos,
  renderScenarioChips
} = require('../utils/homeContentRenderer');

/**
 * SSR 内容注入中间件
 */
function ssrContentInjector(req, res, next) {
  const originalSend = res.send;

  res.send = function(data) {
    // 检查是否是 HTML 内容（通过数据类型判断）
    const isHtml = typeof data === 'string' && (data.trim().startsWith('<!DOCTYPE html>') || data.trim().startsWith('<html'));

    if (!isHtml) {
      return originalSend.call(this, data);
    }

    try {
      const $ = cheerio.load(data);
      const path = req.path === '/' ? '/' : req.path.replace(/\/$/, '');

      // 只处理首页
      if (path === '/' || path === '/index.html') {
        let modified = false;

        // ========================================
        // 1. 注入客户 Logo（最重要）
        // ========================================
        const lwHome = $('#lwHome');
        if (lwHome.length > 0) {
          const currentContent = lwHome.html().trim();

          // 只有当容器为空时才注入
          if (!currentContent || currentContent === '') {
            const logosHtml = renderClientLogos();
            lwHome.html(logosHtml);

            modified = true;
            // console.log('[SSR] Injected client logos');
          }
        }

        // ========================================
        // 2. 注入场景标签（业务关键词）- 已禁用，由前端 JS 动态渲染
        // ========================================
        // const tlChips = $('#tlChips');
        // if (tlChips.length > 0) {
        //   const currentContent = tlChips.html().trim();
        //
        //   if (!currentContent || currentContent === '') {
        //     const chipsHtml = renderScenarioChips();
        //     tlChips.html(chipsHtml);
        //
        //     // 添加 SEO 友好的隐藏文本
        //     tlChips.after(`
        //       <div class="sr-only" aria-label="服务场景">
        //         AI 转型服务场景：HR自动化、知识库管理、销售赋能、运营效率提升、数据分析
        //       </div>
        //     `);
        //
        //     modified = true;
        //     // console.log('[SSR] Injected scenario chips');
        //   }
        // }

        // ========================================
        // 3. 添加结构化数据（Schema.org）
        // ========================================
        // 注释：客户案例和场景服务的结构化数据已移除
        // 原因：用户要求删除这些结构化数据

        // ========================================
        // 4. 添加 noscript 后备（JS 禁用时的兜底）
        // ========================================
        if (!$('noscript.ssr-fallback').length) {
          $('body').append(`
            <noscript class="ssr-fallback">
              <div style="padding: 20px; background: #f0f0f0; text-align: center;">
                <p>为获得最佳体验，请启用 JavaScript。</p>
                <p>当前页面部分功能需要 JavaScript 支持。</p>
              </div>
            </noscript>
          `);
        }

        if (modified) {
          console.log('[SSR] Content injection completed for:', path);
        }

        return originalSend.call(this, $.html());
      }

      // 非首页，直接返回
      return originalSend.call(this, data);

    } catch (error) {
      console.error('[SSR] Content injection error:', error);
      return originalSend.call(this, data);
    }
  };

  next();
}

/**
 * 检测是否为搜索引擎爬虫
 * @param {string} userAgent
 * @returns {boolean}
 */
function isSearchBot(userAgent) {
  if (!userAgent) return false;

  const botPatterns = [
    'googlebot',
    'bingbot',
    'baiduspider',
    'yandexbot',
    'sogou',
    '360spider',
    'bytespider',
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'slackbot'
  ];

  const ua = userAgent.toLowerCase();
  return botPatterns.some(pattern => ua.includes(pattern));
}

/**
 * 爬虫检测中间件（可选）
 * 为爬虫添加特殊标记
 */
function botDetector(req, res, next) {
  const userAgent = req.headers['user-agent'];
  req.isBot = isSearchBot(userAgent);

  if (req.isBot) {
    console.log('[Bot Detected]', userAgent);
  }

  next();
}

module.exports = ssrContentInjector;
module.exports.botDetector = botDetector;
