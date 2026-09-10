/**
 * SEO 自动注入中间件
 * 拦截 HTML 响应，自动注入 SEO 标签
 */

const cheerio = require('cheerio');
const Article = require('../models/Article');

// SEO 配置
const seoConfig = {
  baseUrl: 'https://www.ruihua.com',
  brandName: '瑞华智策',
  defaultDescription: 'AI 时代组织进化全生命周期服务商，提供 AI 赋能培训、AI 转型咨询、AI 落地陪跑服务。',
  defaultKeywords: 'AI 转型, 数字化转型, 企业咨询, 人力资本管理, 组织进化',
  ogImage: '/images/og-default.jpg',

  // 页面级别配置
  pages: {
    '/': {
      title: 'AI 时代组织进化全生命周期服务商',
      description: 'AI 赋能培训、AI 转型咨询、AI 落地陪跑三位一体，陪企业走完 AI 转型全程。',
      keywords: 'AI 转型, 企业培训, 管理咨询, 数字化转型'
    },
    '/index.html': {
      title: 'AI 时代组织进化全生命周期服务商',
      description: 'AI 赋能培训、AI 转型咨询、AI 落地陪跑三位一体，陪企业走完 AI 转型全程。',
      keywords: 'AI 转型, 企业培训, 管理咨询, 数字化转型'
    },
    '/about': {
      title: '关于我们 - 专业的 AI 转型服务团队',
      description: '瑞华智策成立于 2020 年，专注于企业 AI 转型服务，已服务 200+ 企业客户。',
      keywords: '关于瑞华智策, 企业介绍, AI 转型团队'
    },
    '/about.html': {
      title: '关于我们 - 专业的 AI 转型服务团队',
      description: '瑞华智策成立于 2020 年，专注于企业 AI 转型服务，已服务 200+ 企业客户。',
      keywords: '关于瑞华智策, 企业介绍, AI 转型团队'
    },
    '/training': {
      title: 'AI 赋能培训 - 四条路径分角色培养',
      description: '提供 AI 赋能培训服务，12 门课程全部带可落地的成果物，帮助企业员工快速掌握 AI 技能。',
      keywords: 'AI 培训, 企业培训, AI 技能, 人才培养'
    },
    '/training.html': {
      title: 'AI 赋能培训 - 四条路径分角色培养',
      description: '提供 AI 赋能培训服务，12 门课程全部带可落地的成果物，帮助企业员工快速掌握 AI 技能。',
      keywords: 'AI 培训, 企业培训, AI 技能, 人才培养'
    },
    '/solutions': {
      title: 'AI 转型解决方案 - 定制化企业服务',
      description: '提供 AI 转型咨询、AI 落地陪跑、人力资本价值经营等全方位解决方案。',
      keywords: 'AI 解决方案, 企业服务, 数字化转型方案'
    },
    '/solutions.html': {
      title: 'AI 转型解决方案 - 定制化企业服务',
      description: '提供 AI 转型咨询、AI 落地陪跑、人力资本价值经营等全方位解决方案。',
      keywords: 'AI 解决方案, 企业服务, 数字化转型方案'
    },
    '/article': {
      title: '行业洞察 - AI 转型实践与案例分享',
      description: '分享 AI 转型实践经验、行业案例、最佳实践，帮助企业少走弯路。',
      keywords: '行业洞察, AI 案例, 转型实践, 最佳实践'
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
    },
    '/resources.html': {
      title: '资源中心 - AI 转型工具与白皮书下载',
      description: '提供 AI 转型相关的工具、模板、白皮书等资源下载，助力企业转型。',
      keywords: '资源下载, AI 工具, 白皮书, 转型指南'
    }
  }
};

// 生成 Organization Schema
function generateOrgSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "瑞华智策",
    "url": "https://www.ruihua.com",
    "logo": "https://www.ruihua.com/images/logo.png",
    "description": "AI 时代组织进化全生命周期服务商",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "北京市",
      "addressRegion": "朝阳区",
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
        "url": "https://www.ruihua.com/images/logo.png",
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
async function seoInjector(req, res, next) {
  // 只处理 HTML 响应
  const originalSend = res.send;

  res.send = async function(data) {
    // 检查是否是 HTML
    const contentType = res.get('Content-Type');
    if (!contentType || !contentType.includes('text/html')) {
      return originalSend.call(this, data);
    }

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
        { property: 'og:image', content: `${seoConfig.baseUrl}${ogImage}` },
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
        { name: 'twitter:image', content: `${seoConfig.baseUrl}${ogImage}` }
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
        if (!href.includes(seoConfig.baseUrl) && !href.includes('ruihua.com')) {
          if (!$link.attr('rel')) {
            $link.attr('rel', 'noopener noreferrer');
          }
        }
      });

      return originalSend.call(this, $.html());
    } catch (error) {
      console.error('SEO Injector Error:', error);
      return originalSend.call(this, data);
    }
  };

  next();
}

module.exports = seoInjector;
