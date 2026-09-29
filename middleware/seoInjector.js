/**
 * SEO 自动注入中间件
 * 拦截 HTML 响应，自动注入 SEO 标签
 */

const cheerio = require('cheerio');
const Article = require('../models/Article');

// SEO 配置
const seoConfig = {
  baseUrl: 'https://www.ruihuaconsulting.com',
  brandName: '瑞华智策',
  defaultDescription: 'AI 时代组织进化全生命周期服务商，提供 AI 赋能培训、AI 转型咨询、AI 落地陪跑服务。',
  defaultKeywords: 'AI 转型, 数字化转型, 企业咨询, 人力资本管理, 组织进化',
  // 微信分享缩略图（TOS 对象存储，800x800）；原 /images/og-default.jpg 在仓库中不存在，会导致 og:image 404
  ogImage: 'https://ruihua-portal.tos-cn-shanghai.volces.com/page/weixinshare.png',

  // 页面级别配置：仅对缺少 SEO 标签的存量页面兜底；
  // 2026 SSR 路由（/、/about、/solutions、/contact、/insights、/cases 等）已自带标题与描述，不受影响。
  pages: {
    '/': {
      title: 'AI 时代组织进化全生命周期服务商',
      description: 'AI 赋能培训、AI 转型咨询、AI 落地陪跑三位一体，陪企业走完 AI 转型全程。',
      keywords: 'AI 转型, 企业培训, 管理咨询, 数字化转型'
    },
    '/article.html': {
      title: '行业洞察 - AI 转型实践与案例分享',
      description: '分享 AI 转型实践经验、行业案例、最佳实践，帮助企业少走弯路。',
      keywords: '行业洞察, AI 案例, 转型实践, 最佳实践'
    },
    '/resources': {
      title: '资源中心 - AI 转型工具与白皮书下载',
      description: '提供 AI 转型相关的工具、模板、白皮书等资源下载，助力企业转型。',
      keywords: '资源下载, AI 工具, 白皮书, 转型指南'
    }
  }
};

// 把相对路径补成绝对 URL（已是绝对地址时原样返回）
function absoluteUrl(url) {
  if (!url) return absoluteUrl(seoConfig.ogImage);
  if (/^https?:\/\//i.test(url)) return url;
  return `${seoConfig.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

// 判断 res.send 的载荷是否像 HTML 文档（用于 Content-Type 尚未设置的场景）
function isHtmlPayload(data) {
  let head = '';
  if (typeof data === 'string') head = data.slice(0, 200);
  else if (Buffer.isBuffer(data)) head = data.toString('utf8', 0, 200);
  return /^\s*(<!doctype html|<html[\s>])/i.test(head);
}

// 生成 Organization Schema
function generateOrgSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "瑞华智策",
    "url": "https://www.ruihuaconsulting.com",
    "logo": "https://www.ruihuaconsulting.com/images/logo.png",
    "description": "AI 时代组织进化全生命周期服务商",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "上海市",
      "addressRegion": "上海市",
      "addressCountry": "CN"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "areaServed": "CN",
      "availableLanguage": ["zh", "en"]
    }
  };
}

// 生成 Article Schema
function generateArticleSchema(article) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "image": article.coverImage ? [article.coverImage] : [],
    "datePublished": article.publishDate || article.createdAt,
    "dateModified": article.updatedAt,
    "author": {
      "@type": "Person",
      "name": article.author?.name || "瑞华智策"
    },
    "publisher": {
      "@type": "Organization",
      "name": "瑞华智策",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.ruihuaconsulting.com/images/logo.png",
        "width": 600,
        "height": 60
      }
    },
    "description": article.seoDescription || article.summary || "",
    "articleSection": article.category || "行业洞察",
    "keywords": article.seoKeywords?.join(', ') || article.tags?.join(', ') || ""
  };
}

// 生成 FAQPage Schema
function generateFAQSchema(qaList) {
  if (!qaList || qaList.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": qaList.map(qa => ({
      "@type": "Question",
      "name": qa.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": qa.answer
      }
    }))
  };
}

/**
 * SEO 注入中间件
 */
function seoInjector(req, res, next) {
  // 只处理 HTML 响应
  const originalSend = res.send;

  res.send = function(data) {
    // Content-Type 直到 res.send 内部才会写入响应头，此处 res.get('Content-Type') 恒为 undefined，
    // 因此改为直接探测载荷是否为 HTML 文档。
    const contentType = res.get('Content-Type');
    if (!isHtmlPayload(data) && !(contentType && contentType.includes('text/html'))) {
      return originalSend.call(this, data);
    }

    // res.send 必须同步返回 this，以保持 Express 链式语义；
    // 异步注入由 IIFE 承载，任何异常都回落原始响应，避免 Promise 悬空导致请求挂起。
    const res_ = this;
    const fallback = () => originalSend.call(res_, data);

    (async () => {
    try {
      const $ = cheerio.load(data);
      const path = req.path === '/' ? '/' : req.path.replace(/\/$/, '');

      // 获取页面配置
      const pageConfig = seoConfig.pages[path] || seoConfig.pages[path + '.html'] || {};

      // 检查是否是文章详情页
      let article = null;
      const articleId = req.query.id || req.params.id || req.params.slug;
      if ((path.includes('/article') || path.includes('/insight')) && articleId) {
        try {
          article = await Article.findOne({
            $or: [
              { _id: articleId },
              { slug: articleId }
            ]
          }).lean();
        } catch (err) {
          console.error('Failed to load article for SEO:', err);
        }
      }

      // 如果是文章页面，使用文章数据
      if (article) {
        pageConfig.title = article.seoTitle || article.title;
        pageConfig.description = article.seoDescription || article.summary || seoConfig.defaultDescription;
        pageConfig.keywords = article.seoKeywords?.join(', ') || article.tags?.join(', ') || seoConfig.defaultKeywords;
        pageConfig.ogImage = article.coverImage || seoConfig.ogImage;
      }

      // 1. 设置或更新 title
      const fullTitle = pageConfig.title
        ? `${pageConfig.title} | ${seoConfig.brandName}`
        : $('title').text() || `${seoConfig.brandName} - ${seoConfig.defaultDescription}`;

      if ($('title').length === 0) {
        $('head').prepend(`<title>${fullTitle}</title>`);
      } else {
        $('title').text(fullTitle);
      }

      // 2. Meta description
      const description = pageConfig.description || seoConfig.defaultDescription;
      if ($('meta[name="description"]').length === 0) {
        $('head').append(`<meta name="description" content="${description}">`);
      } else {
        $('meta[name="description"]').attr('content', description);
      }

      // 3. Meta keywords
      const keywords = pageConfig.keywords || seoConfig.defaultKeywords;
      if ($('meta[name="keywords"]').length === 0) {
        $('head').append(`<meta name="keywords" content="${keywords}">`);
      }

      // 4. Canonical URL
      const canonicalUrl = `${seoConfig.baseUrl}${path}`;
      if ($('link[rel="canonical"]').length === 0) {
        $('head').append(`<link rel="canonical" href="${canonicalUrl}">`);
      }

      // 5. Open Graph 标签
      const ogTitle = pageConfig.title || $('title').text();
      const ogImage = pageConfig.ogImage || seoConfig.ogImage;

      const ogTags = [
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: canonicalUrl },
        { property: 'og:title', content: ogTitle },
        { property: 'og:description', content: description },
        { property: 'og:image', content: absoluteUrl(ogImage) },
        { property: 'og:site_name', content: seoConfig.brandName },
        { property: 'og:locale', content: 'zh_CN' }
      ];

      ogTags.forEach(tag => {
        if ($(`meta[property="${tag.property}"]`).length === 0) {
          $('head').append(`<meta property="${tag.property}" content="${tag.content}">`);
        }
      });

      // 6. Twitter Card
      const twitterTags = [
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: ogTitle },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: absoluteUrl(ogImage) }
      ];

      twitterTags.forEach(tag => {
        if ($(`meta[name="${tag.name}"]`).length === 0) {
          $('head').append(`<meta name="${tag.name}" content="${tag.content}">`);
        }
      });

      // 7. 添加结构化数据
      if ($('script[type="application/ld+json"]:contains("Organization")').length === 0) {
        const orgSchemaScript = `<script type="application/ld+json">${JSON.stringify(generateOrgSchema(), null, 2)}</script>`;
        $('head').append(orgSchemaScript);
      }

      // 8. 如果是文章页面，添加 Article Schema
      if (article) {
        const articleSchemaScript = `<script type="application/ld+json">${JSON.stringify(generateArticleSchema(article), null, 2)}</script>`;
        $('head').append(articleSchemaScript);

        // 9. 如果文章有 Q&A，添加 FAQPage Schema
        if (article.qa && article.qa.length > 0) {
          const faqSchema = generateFAQSchema(article.qa);
          if (faqSchema) {
            const faqSchemaScript = `<script type="application/ld+json">${JSON.stringify(faqSchema, null, 2)}</script>`;
            $('head').append(faqSchemaScript);
          }
        }
      }

      // 10. 图片优化：自动添加 loading="lazy"
      $('img').each((i, elem) => {
        const $img = $(elem);
        // 首屏图片（前3张）不懒加载
        if (i < 3) {
          $img.attr('loading', 'eager');
        } else if (!$img.attr('loading')) {
          $img.attr('loading', 'lazy');
        }

        // 确保有 alt 属性
        if (!$img.attr('alt')) {
          $img.attr('alt', '');
        }
      });

      // 11. 链接优化：外部链接自动添加 rel
      $('a[href^="http"]').each((i, elem) => {
        const $link = $(elem);
        const href = $link.attr('href');

        // 如果不是本站链接
        if (!href.includes(seoConfig.baseUrl)) {
          if (!$link.attr('rel')) {
            $link.attr('rel', 'noopener noreferrer');
          }
        }
      });

      originalSend.call(res_, $.html());
    } catch (error) {
      console.error('SEO Injector Error:', error);
      fallback();
    }
    })();

    return this;
  };

  next();
}

module.exports = seoInjector;
