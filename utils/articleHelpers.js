/**
 * 文章相关辅助函数
 */

const xss = require('xss');
const { escapeRegex } = require('./validators');

// 文章 HTML 内容清理器
const articleHtmlSanitizer = new xss.FilterXSS({
  whiteList: {
    ...xss.whiteList,
    h1: ['class'], h2: ['class'], h3: ['class'], h4: ['class'], h5: ['class'], h6: ['class'],
    p: ['class'],
    span: ['class'],
    div: ['class'],
    a: ['href', 'title', 'target', 'rel', 'class'],
    img: ['src', 'alt', 'title', 'width', 'height', 'class'],
    ul: ['class'], ol: ['class'], li: ['class'],
    blockquote: ['class'],
    code: ['class'], pre: ['class'],
    table: ['class'], thead: ['class'], tbody: ['class'], tr: ['class'], th: ['class'], td: ['class'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script'],
  onTagAttr: function(tag, name, value) {
    // Only allow iframe src from whitelisted domains
    if (tag === 'iframe' && name === 'src') {
      try {
        const url = new URL(value);
        const allowedHosts = ['player.bilibili.com', 'www.youtube.com', 'youtube.com', 'v.qq.com'];
        if (allowedHosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
          return name + '="' + xss.safeAttrValue(value) + '"';
        }
      } catch(e) {}
      return '';
    }
  }
});

/**
 * 清理文章数据
 */
function sanitizeArticlePayload(body = {}) {
  const payload = { ...body };
  if (typeof payload.content === 'string') {
    payload.content = articleHtmlSanitizer.process(payload.content);
  }
  if (typeof payload.summary === 'string') payload.summary = xss(payload.summary);
  if (typeof payload.seoTitle === 'string') payload.seoTitle = xss(payload.seoTitle);
  if (typeof payload.seoDescription === 'string') payload.seoDescription = xss(payload.seoDescription);
  if (Array.isArray(payload.seoKeywords)) {
    payload.seoKeywords = payload.seoKeywords.map(item => xss(String(item)).trim()).filter(Boolean);
  }
  if (typeof payload.title === 'string') payload.title = xss(payload.title);

  // Add isOnline and isRecommended fields
  if (body.isOnline !== undefined) payload.isOnline = !!body.isOnline;
  if (body.isRecommended !== undefined) payload.isRecommended = !!body.isRecommended;

  return payload;
}

/**
 * 获取文章作者信息（优先使用关联的作者，否则使用快照）
 */
function getResolvedArticleAuthor(article) {
  const snapshot = (article && article.author && typeof article.author === 'object') ? article.author : {};
  const linkedAuthor = (article && article.authorId && typeof article.authorId === 'object' && article.authorId.name !== undefined)
    ? article.authorId
    : null;

  if (!linkedAuthor) {
    return {
      name: snapshot.name || '瑞华智策',
      avatar: snapshot.avatar || '/images/rhzclogo.png',
      desc: snapshot.desc || '',
      detail: snapshot.detail || ''
    };
  }

  return {
    name: linkedAuthor.name || snapshot.name || '瑞华智策',
    avatar: linkedAuthor.avatar || snapshot.avatar || '/images/rhzclogo.png',
    desc: linkedAuthor.desc || snapshot.desc || '',
    detail: linkedAuthor.detail || snapshot.detail || ''
  };
}

module.exports = {
  articleHtmlSanitizer,
  sanitizeArticlePayload,
  getResolvedArticleAuthor,
  escapeRegex  // Re-export from validators for backward compatibility
};
