# SEO 快速参考手册

## 页面模板快速复制

### 标准服务页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- SEO 基础 -->
    <title>AI 转型咨询服务 - 企业数字化转型专家 | 瑞华智策</title>
    <meta name="description" content="瑞华智策提供专业的 AI 转型咨询服务，已服务 200+ 企业客户，平均提升效率 40%。">
    <meta name="keywords" content="AI 转型, 数字化转型, 企业咨询, 人工智能">
    
    <!-- Canonical -->
    <link rel="canonical" href="https://www.ruihua.com/services/ai-consulting">
    
    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://www.ruihua.com/services/ai-consulting">
    <meta property="og:title" content="AI 转型咨询服务 - 瑞华智策">
    <meta property="og:description" content="专业的 AI 转型咨询服务">
    <meta property="og:image" content="https://www.ruihua.com/images/og/ai-consulting.jpg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="AI 转型咨询服务 - 瑞华智策">
    <meta name="twitter:description" content="专业的 AI 转型咨询服务">
    <meta name="twitter:image" content="https://www.ruihua.com/images/twitter/ai-consulting.jpg">
    
    <!-- Favicon -->
    <link rel="icon" href="/favicon.ico" type="image/x-icon">
    
    <!-- 结构化数据 -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": "AI 转型咨询",
      "description": "专业的 AI 转型咨询服务",
      "provider": {
        "@type": "Organization",
        "name": "瑞华智策",
        "url": "https://www.ruihua.com"
      },
      "areaServed": "CN",
      "serviceType": "咨询服务"
    }
    </script>
</head>
<body>
    <!-- 页面内容 -->
</body>
</html>
```

### 标准文章页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- SEO 基础 -->
    <title>AI 转型的五大关键步骤 | 瑞华智策行业洞察</title>
    <meta name="description" content="本文详细介绍企业进行 AI 转型的五个关键步骤，包括战略规划、技术选型、人才培养等核心要素。">
    <meta name="keywords" content="AI 转型, 数字化转型, 实施步骤, 企业管理">
    <meta name="author" content="瑞华智策">
    
    <!-- Canonical -->
    <link rel="canonical" href="https://www.ruihua.com/articles/ai-transformation-guide">
    
    <!-- Open Graph - 文章类型 -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://www.ruihua.com/articles/ai-transformation-guide">
    <meta property="og:title" content="AI 转型的五大关键步骤">
    <meta property="og:description" content="本文详细介绍企业进行 AI 转型的五个关键步骤">
    <meta property="og:image" content="https://www.ruihua.com/images/articles/ai-guide-cover.jpg">
    <meta property="article:published_time" content="2026-09-09T10:00:00+08:00">
    <meta property="article:modified_time" content="2026-09-10T15:30:00+08:00">
    <meta property="article:author" content="张三">
    <meta property="article:section" content="行业洞察">
    <meta property="article:tag" content="AI转型">
    <meta property="article:tag" content="数字化">
    
    <!-- 结构化数据 - 文章 -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "AI 转型的五大关键步骤",
      "image": [
        "https://www.ruihua.com/images/articles/ai-guide-1x1.jpg",
        "https://www.ruihua.com/images/articles/ai-guide-4x3.jpg",
        "https://www.ruihua.com/images/articles/ai-guide-16x9.jpg"
      ],
      "datePublished": "2026-09-09T10:00:00+08:00",
      "dateModified": "2026-09-10T15:30:00+08:00",
      "author": {
        "@type": "Person",
        "name": "张三"
      },
      "publisher": {
        "@type": "Organization",
        "name": "瑞华智策",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.ruihua.com/images/logo-600x60.png",
          "width": 600,
          "height": 60
        }
      },
      "description": "本文详细介绍企业进行 AI 转型的五个关键步骤"
    }
    </script>
    
    <!-- 面包屑 -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [{
        "@type": "ListItem",
        "position": 1,
        "name": "首页",
        "item": "https://www.ruihua.com"
      }, {
        "@type": "ListItem",
        "position": 2,
        "name": "行业洞察",
        "item": "https://www.ruihua.com/articles"
      }, {
        "@type": "ListItem",
        "position": 3,
        "name": "AI 转型的五大关键步骤",
        "item": "https://www.ruihua.com/articles/ai-transformation-guide"
      }]
    }
    </script>
</head>
<body>
    <!-- 文章内容 -->
</body>
</html>
```

---

## 常用 Schema.org 模板

### 组织（Organization）

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "瑞华智策",
  "url": "https://www.ruihua.com",
  "logo": "https://www.ruihua.com/images/logo.png",
  "description": "AI 时代组织进化全生命周期服务商",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "建国路XX号",
    "addressLocality": "北京市",
    "addressRegion": "朝阳区",
    "postalCode": "100000",
    "addressCountry": "CN"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+86-10-12345678",
    "contactType": "customer service",
    "areaServed": "CN",
    "availableLanguage": ["zh", "en"]
  },
  "sameAs": [
    "https://www.linkedin.com/company/ruihua",
    "https://weibo.com/ruihua"
  ]
}
```

### 常见问题（FAQPage）

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "什么是 AI 转型？",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "AI 转型是指企业通过引入人工智能技术，优化业务流程、提升运营效率的过程。"
    }
  }, {
    "@type": "Question",
    "name": "AI 转型需要多长时间？",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "根据企业规模和业务复杂度，AI 转型通常需要 6-18 个月。"
    }
  }]
}
```

### 视频（VideoObject）

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "AI 转型案例分享",
  "description": "某制造企业的 AI 转型成功案例",
  "thumbnailUrl": "https://www.ruihua.com/images/video-thumb.jpg",
  "uploadDate": "2026-09-09T10:00:00+08:00",
  "duration": "PT10M30S",
  "contentUrl": "https://www.ruihua.com/videos/case-study.mp4",
  "embedUrl": "https://www.ruihua.com/embed/video/123"
}
```

### 事件（Event）

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "AI 转型峰会 2026",
  "startDate": "2026-10-15T09:00:00+08:00",
  "endDate": "2026-10-15T18:00:00+08:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "北京国际会议中心",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "朝阳区XX路",
      "addressLocality": "北京市",
      "addressCountry": "CN"
    }
  },
  "image": "https://www.ruihua.com/images/event-2026.jpg",
  "description": "汇聚行业专家，探讨 AI 转型最佳实践",
  "organizer": {
    "@type": "Organization",
    "name": "瑞华智策",
    "url": "https://www.ruihua.com"
  }
}
```

---

## 图片优化快速指南

### 基础图片标签

```html
<!-- 完整属性 -->
<img 
    src="/images/hero.jpg" 
    alt="瑞华智策 AI 转型咨询服务团队"
    width="1200" 
    height="630"
    loading="lazy"
    decoding="async">
```

### 响应式图片

```html
<picture>
    <!-- WebP 格式 -->
    <source 
        srcset="/images/hero-400.webp 400w,
                /images/hero-800.webp 800w,
                /images/hero-1200.webp 1200w"
        sizes="(max-width: 768px) 100vw, 1200px"
        type="image/webp">
    
    <!-- JPEG 后备 -->
    <source 
        srcset="/images/hero-400.jpg 400w,
                /images/hero-800.jpg 800w,
                /images/hero-1200.jpg 1200w"
        sizes="(max-width: 768px) 100vw, 1200px"
        type="image/jpeg">
    
    <img 
        src="/images/hero-800.jpg" 
        alt="描述文本"
        width="1200"
        height="630"
        loading="lazy">
</picture>
```

### 图片尺寸规范

| 用途 | 尺寸 (px) | 比例 | 格式 |
|-----|----------|------|------|
| OG 图片 | 1200 × 630 | 1.91:1 | JPEG/WebP |
| Twitter 卡片 | 1200 × 628 | 1.91:1 | JPEG/WebP |
| 文章封面 | 1200 × 675 | 16:9 | JPEG/WebP |
| Logo | 600 × 60 | 10:1 | PNG/SVG |
| Favicon | 32 × 32 | 1:1 | ICO/PNG |
| Apple Touch Icon | 180 × 180 | 1:1 | PNG |

---

## URL 规范快速检查

### ✅ 好的 URL

```
https://www.ruihua.com/services/ai-consulting
https://www.ruihua.com/articles/ai-transformation-guide
https://www.ruihua.com/case-studies/manufacturing-company
https://www.ruihua.com/cn/about
```

**特点**：
- 全小写
- 使用连字符 `-`
- 描述性强
- 包含关键词
- 简短明了

### ❌ 坏的 URL

```
https://www.ruihua.com/page.php?id=123
https://www.ruihua.com/服务/AI咨询
https://www.ruihua.com/SeRvIcEs/AI_Consulting
https://www.ruihua.com/p/article/view/123456
```

**问题**：
- 动态参数
- 中文字符
- 大小写混合
- 下划线
- 过长或无意义

---

## robots.txt 模板

```txt
# robots.txt

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /private/
Disallow: /*?*sort=
Disallow: /*?*filter=

# 百度爬虫
User-agent: Baiduspider
Allow: /
Crawl-delay: 1

# Google 爬虫
User-agent: Googlebot
Allow: /

# 禁止抓取特定文件类型
User-agent: *
Disallow: /*.json$
Disallow: /*.xml$ 
Disallow: /*.pdf$

# 站点地图
Sitemap: https://www.ruihua.com/sitemap.xml
Sitemap: https://www.ruihua.com/sitemap-articles.xml
Sitemap: https://www.ruihua.com/sitemap-images.xml
```

---

## 性能优化检查清单

### 关键 CSS 内联

```html
<head>
    <!-- 关键 CSS 内联 -->
    <style>
        /* 首屏关键样式 */
        .header { /* ... */ }
        .hero { /* ... */ }
    </style>
    
    <!-- 非关键 CSS 异步加载 -->
    <link rel="preload" href="/css/main.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="/css/main.css"></noscript>
</head>
```

### 资源预加载

```html
<!-- DNS 预解析 -->
<link rel="dns-prefetch" href="//cdn.example.com">

<!-- 预连接 -->
<link rel="preconnect" href="https://fonts.googleapis.com">

<!-- 预加载关键资源 -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/images/hero.jpg" as="image">

<!-- 预获取下一页资源 -->
<link rel="prefetch" href="/about">
```

### 脚本加载优化

```html
<!-- 关键脚本 - defer -->
<script src="/js/critical.js" defer></script>

<!-- 非关键脚本 - async -->
<script src="/js/analytics.js" async></script>

<!-- 延迟加载 -->
<script>
window.addEventListener('load', function() {
    var script = document.createElement('script');
    script.src = '/js/non-critical.js';
    document.body.appendChild(script);
});
</script>
```

---

## 常用 HTTP 头部

### 缓存控制

```javascript
// 静态资源 - 长缓存
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

// HTML 页面 - 短缓存
res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');

// API 响应 - 无缓存
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
```

### 安全头部

```javascript
// HSTS
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

// XSS 保护
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'SAMEORIGIN');
res.setHeader('X-XSS-Protection', '1; mode=block');

// CSP
res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'");
```

---

## 常见问题解决

### 问题：重复内容

**解决方案**：使用 Canonical URL

```html
<!-- 原始页面 -->
<link rel="canonical" href="https://www.ruihua.com/article">

<!-- 打印版本 -->
<link rel="canonical" href="https://www.ruihua.com/article">

<!-- 参数版本 -->
<link rel="canonical" href="https://www.ruihua.com/article">
```

### 问题：404 软错误

**解决方案**：正确返回 404 状态码

```javascript
// ❌ 错误：返回 200 但显示 404 内容
app.get('/not-found', (req, res) => {
    res.send('<h1>404 Not Found</h1>');
});

// ✅ 正确：返回 404 状态码
app.get('/not-found', (req, res) => {
    res.status(404).render('404');
});
```

### 问题：移动端不友好

**解决方案**：响应式设计 + viewport

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

```css
/* 移动优先 */
.container {
    width: 100%;
    padding: 0 20px;
}

/* 平板 */
@media (min-width: 768px) {
    .container {
        max-width: 720px;
        margin: 0 auto;
    }
}

/* 桌面 */
@media (min-width: 1200px) {
    .container {
        max-width: 1140px;
    }
}
```

---

## 测试工具快速链接

### SEO 测试
- [Google Search Console](https://search.google.com/search-console)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [百度站长平台](https://ziyuan.baidu.com/)

### 性能测试
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [GTmetrix](https://gtmetrix.com/)
- [WebPageTest](https://www.webpagetest.org/)

### 结构化数据
- [Schema.org Validator](https://validator.schema.org/)
- [Google Structured Data Testing Tool](https://developers.google.com/search/docs/advanced/structured-data)

### 移动端测试
- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)

---

**最后更新**: 2026-09-09
