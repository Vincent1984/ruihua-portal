# B2B 营销型网站 SEO & GEO 规范指南

## 目录

1. [HTML 结构规范](#1-html-结构规范)
2. [SEO 元数据规范](#2-seo-元数据规范)
3. [内容结构规范](#3-内容结构规范)
4. [技术 SEO 规范](#4-技术-seo-规范)
5. [GEO 地理定位优化](#5-geo-地理定位优化)
6. [性能优化](#6-性能优化)
7. [Schema.org 结构化数据](#7-schemaorg-结构化数据)
8. [国际化与多语言](#8-国际化与多语言)
9. [URL 结构规范](#9-url-结构规范)
10. [站点地图与索引](#10-站点地图与索引)

---

## 1. HTML 结构规范

### 1.1 基础文档结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- 基础 SEO -->
    <title>页面标题（50-60字符）- 品牌名</title>
    <meta name="description" content="页面描述（150-160字符）">
    <meta name="keywords" content="关键词1, 关键词2, 关键词3">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="https://www.example.com/page">
    
    <!-- 移动端优化 -->
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    
    <!-- DNS 预解析 -->
    <link rel="dns-prefetch" href="//cdn.example.com">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    
    <!-- 样式表 -->
    <link rel="stylesheet" href="/css/main.css">
    
    <!-- 结构化数据 -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "瑞华智策",
        "url": "https://www.ruihua.com"
    }
    </script>
</head>
<body>
    <!-- 内容区 -->
</body>
</html>
```

### 1.2 语义化 HTML5 标签

```html
<body>
    <!-- 跳过导航链接（无障碍） -->
    <a href="#main-content" class="skip-link">跳到主内容</a>
    
    <header>
        <nav aria-label="主导航">
            <!-- 导航内容 -->
        </nav>
    </header>
    
    <main id="main-content">
        <article>
            <header>
                <h1>文章标题</h1>
                <p class="meta">
                    <time datetime="2026-09-09">2026年9月9日</time>
                </p>
            </header>
            
            <section>
                <h2>章节标题</h2>
                <p>内容...</p>
            </section>
        </article>
        
        <aside>
            <!-- 相关内容、推荐阅读 -->
        </aside>
    </main>
    
    <footer>
        <nav aria-label="页脚导航">
            <!-- 页脚链接 -->
        </nav>
    </footer>
</body>
```

---

## 2. SEO 元数据规范

### 2.1 核心元数据

```html
<head>
    <!-- 标题：50-60字符最佳 -->
    <title>AI 转型咨询服务 - 企业数字化转型专家 | 瑞华智策</title>
    
    <!-- 描述：150-160字符最佳 -->
    <meta name="description" content="瑞华智策提供专业的 AI 转型咨询、数字化转型、人力资本管理服务，助力企业实现智能化升级。已服务 200+ 企业客户。">
    
    <!-- 关键词：5-10个，逗号分隔 -->
    <meta name="keywords" content="AI 转型, 数字化转型, 企业咨询, 人力资本管理, 组织进化">
    
    <!-- 作者 -->
    <meta name="author" content="瑞华智策">
    
    <!-- 版权 -->
    <meta name="copyright" content="© 2026 瑞华智策">
    
    <!-- Robots 指令 -->
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    
    <!-- Googlebot 指令（可选，单独控制） -->
    <meta name="googlebot" content="index, follow">
    
    <!-- 百度站点验证 -->
    <meta name="baidu-site-verification" content="codeva-xxxx">
    
    <!-- Google Search Console 验证 -->
    <meta name="google-site-verification" content="xxxxx">
</head>
```

### 2.2 Open Graph（社交分享优化）

```html
<!-- Open Graph 基础 -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.ruihua.com/page">
<meta property="og:title" content="AI 转型咨询服务 - 瑞华智策">
<meta property="og:description" content="专业的 AI 转型咨询服务，助力企业智能化升级。">
<meta property="og:image" content="https://www.ruihua.com/images/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="瑞华智策">
<meta property="og:locale" content="zh_CN">

<!-- 针对文章类型 -->
<meta property="article:published_time" content="2026-09-09T10:00:00+08:00">
<meta property="article:modified_time" content="2026-09-10T15:30:00+08:00">
<meta property="article:author" content="作者名">
<meta property="article:section" content="行业洞察">
<meta property="article:tag" content="AI转型">
```

### 2.3 Twitter Card

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@ruihuaai">
<meta name="twitter:creator" content="@ruihuaai">
<meta name="twitter:title" content="AI 转型咨询服务 - 瑞华智策">
<meta name="twitter:description" content="专业的 AI 转型咨询服务">
<meta name="twitter:image" content="https://www.ruihua.com/images/twitter-card.jpg">
```

### 2.4 移动端优化元数据

```html
<!-- 移动端浏览器颜色 -->
<meta name="theme-color" content="#211e28">
<meta name="msapplication-navbutton-color" content="#211e28">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

<!-- PWA 支持 -->
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
```

---

## 3. 内容结构规范

### 3.1 标题层级

```html
<!-- ❌ 错误：跳级 -->
<h1>主标题</h1>
<h3>子标题</h3>  <!-- 跳过了 h2 -->

<!-- ✅ 正确：层级递进 -->
<h1>AI 转型咨询服务</h1>
  <h2>服务内容</h2>
    <h3>AI 赋能培训</h3>
    <h3>AI 转型咨询</h3>
  <h2>服务案例</h2>
    <h3>案例一：某制造企业</h3>
```

**规则**：
- 每页只有一个 `<h1>`
- 标题层级不跳级
- 标题要描述性强，包含关键词
- 不要用标题标签做样式（用 CSS）

### 3.2 段落与文本

```html
<!-- 使用语义化标签 -->
<p><strong>重要文本</strong> 而不是 <b>加粗文本</b></p>
<p><em>强调文本</em> 而不是 <i>斜体文本</i></p>

<!-- 使用列表 -->
<ul>
    <li>列表项一</li>
    <li>列表项二</li>
</ul>

<!-- 引用 -->
<blockquote cite="https://source.com">
    <p>引用内容</p>
    <footer>—— <cite>来源</cite></footer>
</blockquote>

<!-- 代码 -->
<pre><code class="language-javascript">
console.log('Hello World');
</code></pre>
```

### 3.3 图片优化

```html
<!-- 完整的图片标签 -->
<picture>
    <!-- WebP 格式（现代浏览器） -->
    <source srcset="/images/hero.webp" type="image/webp">
    
    <!-- 响应式图片 -->
    <source 
        media="(max-width: 768px)" 
        srcset="/images/hero-mobile.jpg">
    
    <!-- 后备图片 -->
    <img 
        src="/images/hero.jpg" 
        alt="瑞华智策 AI 转型咨询服务团队为企业提供数字化转型方案"
        width="1200" 
        height="630"
        loading="lazy"
        decoding="async">
</picture>

<!-- 装饰性图片使用空 alt -->
<img src="/images/decoration.svg" alt="" role="presentation">

<!-- Logo -->
<img 
    src="/logo.svg" 
    alt="瑞华智策 Logo" 
    width="120" 
    height="40"
    loading="eager">
```

**图片 SEO 最佳实践**：
- ✅ 文件名描述性强：`ai-consulting-team.jpg` 而非 `IMG_1234.jpg`
- ✅ Alt 文本详细、包含关键词
- ✅ 指定宽高避免 CLS
- ✅ 使用 `loading="lazy"` 延迟加载
- ✅ 首屏关键图片用 `loading="eager"` 或不设置
- ✅ 提供多种格式（WebP + JPEG）
- ✅ 响应式图片（不同屏幕尺寸）

### 3.4 链接优化

```html
<!-- 内部链接 -->
<a href="/services/ai-consulting" title="了解 AI 转型咨询服务">
    AI 转型咨询
</a>

<!-- 外部链接 -->
<a 
    href="https://external-site.com" 
    target="_blank" 
    rel="noopener noreferrer"
    title="访问外部网站（新窗口打开）">
    外部链接
</a>

<!-- 下载链接 -->
<a 
    href="/downloads/whitepaper.pdf" 
    download="瑞华智策-AI转型白皮书.pdf"
    type="application/pdf">
    下载白皮书 <span class="sr-only">(PDF, 2.3MB)</span>
</a>

<!-- 锚点链接 -->
<a href="#services">跳转到服务介绍</a>
```

**链接 SEO 最佳实践**：
- ✅ 使用描述性锚文本（避免"点击这里"）
- ✅ 内部链接使用相对路径
- ✅ 外部链接加 `rel="noopener noreferrer"`
- ✅ 付费/广告链接加 `rel="sponsored"`
- ✅ UGC 内容链接加 `rel="ugc"`
- ✅ 不想传递权重的链接加 `rel="nofollow"`

---

## 4. 技术 SEO 规范

### 4.1 Robots.txt

```txt
# robots.txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /private/
Disallow: /*?*  # 屏蔽查询参数URL

# 特定搜索引擎
User-agent: Baiduspider
Allow: /
Crawl-delay: 1

User-agent: Googlebot
Allow: /

# 站点地图
Sitemap: https://www.ruihua.com/sitemap.xml
Sitemap: https://www.ruihua.com/sitemap-articles.xml
Sitemap: https://www.ruihua.com/sitemap-images.xml
```

### 4.2 Canonical URL

```html
<!-- 避免重复内容 -->
<link rel="canonical" href="https://www.ruihua.com/services/ai-consulting">

<!-- 分页内容 -->
<!-- 第1页 -->
<link rel="canonical" href="https://www.ruihua.com/articles">
<link rel="next" href="https://www.ruihua.com/articles?page=2">

<!-- 第2页 -->
<link rel="canonical" href="https://www.ruihua.com/articles?page=2">
<link rel="prev" href="https://www.ruihua.com/articles">
<link rel="next" href="https://www.ruihua.com/articles?page=3">
```

### 4.3 状态码

```javascript
// server.js 示例
// ✅ 301 永久重定向（域名迁移、URL变更）
app.get('/old-page', (req, res) => {
    res.redirect(301, '/new-page');
});

// ✅ 302 临时重定向
app.get('/promo', (req, res) => {
    res.redirect(302, '/landing-page');
});

// ✅ 404 页面不存在
app.use((req, res) => {
    res.status(404).render('404', {
        title: '页面未找到 - 瑞华智策',
        description: '您访问的页面不存在'
    });
});

// ✅ 410 资源已永久删除
app.get('/deleted-service', (req, res) => {
    res.status(410).send('此服务已下线');
});
```

### 4.4 性能指标

**核心 Web Vitals**：
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

```html
<!-- 预加载关键资源 -->
<link rel="preload" href="/css/main.css" as="style">
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

<!-- 预连接第三方域名 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="//cdn.example.com">

<!-- 延迟非关键脚本 -->
<script src="/js/main.js" defer></script>
<script src="/js/analytics.js" async></script>
```

---

## 5. GEO 地理定位优化

### 5.1 地理元数据

```html
<head>
    <!-- 地理位置 -->
    <meta name="geo.region" content="CN-11">  <!-- 北京 -->
    <meta name="geo.placename" content="北京市朝阳区">
    <meta name="geo.position" content="39.9042;116.4074">
    <meta name="ICBM" content="39.9042, 116.4074">
    
    <!-- 针对特定地区的内容 -->
    <meta name="geo.country" content="CN">
    <meta http-equiv="content-language" content="zh-CN">
</head>
```

### 5.2 hCard 微格式（本地 SEO）

```html
<div class="vcard">
    <div class="fn org">瑞华智策</div>
    <div class="adr">
        <span class="country-name">中国</span>
        <span class="region">北京市</span>
        <span class="locality">朝阳区</span>
        <span class="street-address">建国路XX号XX大厦XX层</span>
        <span class="postal-code">100000</span>
    </div>
    <div class="tel">
        <span class="type">工作</span>:
        <span class="value">+86-10-12345678</span>
    </div>
    <a class="email" href="mailto:contact@ruihua.com">contact@ruihua.com</a>
    <a class="url" href="https://www.ruihua.com">www.ruihua.com</a>
</div>
```

### 5.3 LocalBusiness Schema

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "name": "瑞华智策",
  "image": "https://www.ruihua.com/images/logo.png",
  "@id": "https://www.ruihua.com",
  "url": "https://www.ruihua.com",
  "telephone": "+86-10-12345678",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "建国路XX号XX大厦XX层",
    "addressLocality": "北京市",
    "addressRegion": "朝阳区",
    "postalCode": "100000",
    "addressCountry": "CN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 39.9042,
    "longitude": 116.4074
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday"
    ],
    "opens": "09:00",
    "closes": "18:00"
  },
  "sameAs": [
    "https://www.linkedin.com/company/ruihua",
    "https://weibo.com/ruihua"
  ]
}
</script>
```

### 5.4 多地区页面处理

```html
<!-- 北京页面 -->
<head>
    <link rel="canonical" href="https://www.ruihua.com/beijing">
    <link rel="alternate" hreflang="zh-CN" href="https://www.ruihua.com/beijing">
    <title>北京 AI 转型咨询服务 - 瑞华智策</title>
</head>

<!-- 上海页面 -->
<head>
    <link rel="canonical" href="https://www.ruihua.com/shanghai">
    <link rel="alternate" hreflang="zh-CN" href="https://www.ruihua.com/shanghai">
    <title>上海 AI 转型咨询服务 - 瑞华智策</title>
</head>
```

---

## 6. 性能优化

### 6.1 资源优化

```html
<!-- 关键 CSS 内联 -->
<style>
/* 首屏关键样式 */
.header { /* ... */ }
.hero { /* ... */ }
</style>

<!-- 非关键 CSS 异步加载 -->
<link rel="preload" href="/css/main.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/css/main.css"></noscript>

<!-- 字体优化 -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face {
  font-family: 'Main';
  src: url('/fonts/main.woff2') format('woff2');
  font-display: swap; /* 避免 FOIT */
}
</style>
```

### 6.2 图片优化策略

```html
<!-- 响应式图片 + 懒加载 -->
<img 
    srcset="
        /images/hero-400.jpg 400w,
        /images/hero-800.jpg 800w,
        /images/hero-1200.jpg 1200w"
    sizes="(max-width: 768px) 100vw, 1200px"
    src="/images/hero-800.jpg"
    alt="描述文本"
    loading="lazy"
    decoding="async"
    width="1200"
    height="630">

<!-- 原生懒加载 -->
<img src="/image.jpg" loading="lazy" alt="描述">

<!-- 首屏图片不懒加载 -->
<img src="/hero.jpg" loading="eager" alt="描述">
```

### 6.3 JavaScript 优化

```html
<!-- 关键脚本放 head，使用 defer -->
<head>
    <script src="/js/critical.js" defer></script>
</head>

<!-- 非关键脚本用 async -->
<script src="/js/analytics.js" async></script>

<!-- 第三方脚本延迟加载 -->
<script>
window.addEventListener('load', function() {
    // 页面加载完成后再加载第三方脚本
    var script = document.createElement('script');
    script.src = 'https://third-party.com/widget.js';
    document.body.appendChild(script);
});
</script>
```

---

## 7. Schema.org 结构化数据

### 7.1 组织（Organization）

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "瑞华智策",
  "alternateName": "Ruihua Consulting",
  "url": "https://www.ruihua.com",
  "logo": "https://www.ruihua.com/images/logo.png",
  "description": "AI 时代组织进化全生命周期服务商",
  "foundingDate": "2020",
  "founder": {
    "@type": "Person",
    "name": "创始人姓名"
  },
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
    "https://weibo.com/ruihua",
    "https://twitter.com/ruihuaai"
  ]
}
</script>
```

### 7.2 文章（Article）

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "AI 转型的五大关键步骤",
  "image": [
    "https://www.ruihua.com/images/article-1x1.jpg",
    "https://www.ruihua.com/images/article-4x3.jpg",
    "https://www.ruihua.com/images/article-16x9.jpg"
  ],
  "datePublished": "2026-09-09T08:00:00+08:00",
  "dateModified": "2026-09-10T10:00:00+08:00",
  "author": {
    "@type": "Person",
    "name": "作者姓名",
    "url": "https://www.ruihua.com/authors/author-name"
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
  "description": "文章摘要，150-160字符",
  "articleBody": "文章完整内容..."
}
</script>
```

### 7.3 常见问题（FAQPage）

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "什么是 AI 转型？",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "<p>AI 转型是指企业通过引入人工智能技术...</p>"
    }
  }, {
    "@type": "Question",
    "name": "AI 转型需要多长时间？",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "<p>根据企业规模和业务复杂度...</p>"
    }
  }]
}
</script>
```

### 7.4 面包屑导航（BreadcrumbList）

```html
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
    "name": "服务",
    "item": "https://www.ruihua.com/services"
  }, {
    "@type": "ListItem",
    "position": 3,
    "name": "AI 转型咨询",
    "item": "https://www.ruihua.com/services/ai-consulting"
  }]
}
</script>
```

### 7.5 服务（Service）

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "AI 转型咨询",
  "description": "专业的 AI 转型咨询服务，帮助企业实现智能化升级",
  "provider": {
    "@type": "Organization",
    "name": "瑞华智策"
  },
  "serviceType": "咨询服务",
  "areaServed": {
    "@type": "Country",
    "name": "中国"
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "AI 转型服务",
    "itemListElement": [{
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "name": "AI 赋能培训"
      }
    }, {
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "name": "AI 落地陪跑"
      }
    }]
  }
}
</script>
```

---

## 8. 国际化与多语言

### 8.1 语言标记

```html
<!-- 中文页面 -->
<html lang="zh-CN">
<head>
    <link rel="alternate" hreflang="zh-CN" href="https://www.ruihua.com/cn/">
    <link rel="alternate" hreflang="en-US" href="https://www.ruihua.com/en/">
    <link rel="alternate" hreflang="x-default" href="https://www.ruihua.com/">
</head>

<!-- 英文页面 -->
<html lang="en-US">
<head>
    <link rel="alternate" hreflang="zh-CN" href="https://www.ruihua.com/cn/">
    <link rel="alternate" hreflang="en-US" href="https://www.ruihua.com/en/">
    <link rel="alternate" hreflang="x-default" href="https://www.ruihua.com/">
</head>
```

### 8.2 多语言 URL 结构

**方案一：子目录**（推荐）
```
https://www.ruihua.com/cn/      （中文）
https://www.ruihua.com/en/      （英文）
https://www.ruihua.com/ja/      （日文）
```

**方案二：子域名**
```
https://www.ruihua.com/         （默认语言）
https://en.ruihua.com/          （英文）
https://ja.ruihua.com/          （日文）
```

**方案三：参数**（不推荐）
```
https://www.ruihua.com/?lang=en
```

---

## 9. URL 结构规范

### 9.1 URL 命名规则

```
✅ 好的 URL:
https://www.ruihua.com/services/ai-consulting
https://www.ruihua.com/articles/ai-transformation-guide
https://www.ruihua.com/case-studies/manufacturing-company

❌ 坏的 URL:
https://www.ruihua.com/page.php?id=123
https://www.ruihua.com/服务/AI咨询  （中文字符）
https://www.ruihua.com/SeRvIcEs/AI_Consulting  （大小写混合）
```

**规则**：
- ✅ 使用连字符 `-` 分隔单词
- ✅ 全部小写
- ✅ 描述性强、包含关键词
- ✅ 简短明了（3-5 个单词）
- ✅ 静态 URL（避免参数）
- ❌ 避免下划线 `_`
- ❌ 避免特殊字符
- ❌ 避免中文（使用拼音或英文）

### 9.2 URL 层级结构

```
首页
└── /services/                    （服务列表）
    ├── /ai-consulting/          （AI 咨询服务详情）
    ├── /ai-training/            （AI 培训服务详情）
    └── /fde/                    （FDE 服务详情）

└── /articles/                   （文章列表）
    ├── /ai-transformation/      （文章分类）
    │   └── /guide-2026/         （具体文章）
    └── /case-studies/           （案例研究）
        └── /manufacturing/      （具体案例）

└── /about/                      （关于我们）
    ├── /team/                   （团队介绍）
    └── /contact/                （联系我们）
```

---

## 10. 站点地图与索引

### 10.1 XML Sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  
  <!-- 首页 -->
  <url>
    <loc>https://www.ruihua.com/</loc>
    <lastmod>2026-09-09</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    
    <!-- 多语言版本 -->
    <xhtml:link rel="alternate" hreflang="zh-CN" href="https://www.ruihua.com/cn/" />
    <xhtml:link rel="alternate" hreflang="en-US" href="https://www.ruihua.com/en/" />
  </url>
  
  <!-- 服务页 -->
  <url>
    <loc>https://www.ruihua.com/services/ai-consulting</loc>
    <lastmod>2026-09-08</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <!-- 文章页 -->
  <url>
    <loc>https://www.ruihua.com/articles/ai-guide</loc>
    <lastmod>2026-09-09</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
```

### 10.2 Sitemap 索引文件

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.ruihua.com/sitemap-pages.xml</loc>
    <lastmod>2026-09-09</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.ruihua.com/sitemap-articles.xml</loc>
    <lastmod>2026-09-09</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.ruihua.com/sitemap-images.xml</loc>
    <lastmod>2026-09-09</lastmod>
  </sitemap>
</sitemapindex>
```

### 10.3 图片 Sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://www.ruihua.com/articles/ai-guide</loc>
    <image:image>
      <image:loc>https://www.ruihua.com/images/ai-guide-hero.jpg</image:loc>
      <image:title>AI 转型指南首图</image:title>
      <image:caption>企业 AI 转型的完整路径</image:caption>
    </image:image>
  </url>
</urlset>
```

---

## 实施检查清单

### SEO 基础清单

- [ ] 每页有唯一的 `<title>`（50-60字符）
- [ ] 每页有唯一的 `<meta description>`（150-160字符）
- [ ] 每页只有一个 `<h1>`
- [ ] 标题层级不跳级（h1 → h2 → h3）
- [ ] 所有图片都有 `alt` 属性
- [ ] 图片指定 `width` 和 `height`
- [ ] 使用语义化 HTML5 标签
- [ ] 设置 canonical URL
- [ ] 配置 robots.txt
- [ ] 提交 XML sitemap

### 技术 SEO 清单

- [ ] HTTPS 启用
- [ ] 移动端友好（响应式设计）
- [ ] 页面加载速度 < 3秒
- [ ] Core Web Vitals 达标
- [ ] 结构化数据（Schema.org）
- [ ] Open Graph 标签
- [ ] Twitter Card 标签
- [ ] 面包屑导航
- [ ] 404 页面优化
- [ ] 301 重定向正确配置

### GEO 优化清单

- [ ] 地理元数据（geo.region, geo.position）
- [ ] LocalBusiness Schema
- [ ] 公司地址、电话清晰展示
- [ ] Google My Business 关联
- [ ] 百度地图标注
- [ ] 多地区页面（如有）
- [ ] 本地化内容

### 性能优化清单

- [ ] 图片压缩（WebP 格式）
- [ ] 懒加载（图片、iframe）
- [ ] 关键 CSS 内联
- [ ] JavaScript 延迟加载
- [ ] 字体优化（font-display: swap）
- [ ] CDN 使用
- [ ] Gzip/Brotli 压缩
- [ ] 浏览器缓存配置

### 内容优化清单

- [ ] 关键词研究并自然融入内容
- [ ] 标题包含目标关键词
- [ ] 内部链接策略
- [ ] 外部链接（权威来源）
- [ ] 内容定期更新
- [ ] 长尾内容（1500+ 字文章）
- [ ] 多媒体内容（图片、视频）
- [ ] CTA 清晰可见

---

## 推荐工具

### SEO 分析工具
- Google Search Console
- Google Analytics
- 百度站长平台
- Screaming Frog SEO Spider
- Ahrefs / SEMrush

### 技术检测工具
- Google PageSpeed Insights
- Lighthouse
- GTmetrix
- WebPageTest
- Google Mobile-Friendly Test

### 结构化数据工具
- Google Rich Results Test
- Schema.org Validator
- JSON-LD Playground

### 关键词研究工具
- Google Keyword Planner
- 百度指数
- Ahrefs Keywords Explorer
- Answer The Public

---

## 参考资源

- [Google 搜索中心](https://developers.google.com/search)
- [Schema.org](https://schema.org/)
- [Web.dev](https://web.dev/)
- [百度搜索资源平台](https://ziyuan.baidu.com/)
- [MDN Web Docs](https://developer.mozilla.org/)

---

**最后更新**: 2026-09-09
