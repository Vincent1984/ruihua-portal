/**
 * 动态 Sitemap 生成
 */

const express = require('express');
const router = express.Router();
const Article = require('../models/Article');

const baseUrl = 'https://www.ruihua.com';

// 静态页面配置
const staticPages = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/solutions', changefreq: 'weekly', priority: '0.8' },
  { path: '/training', changefreq: 'weekly', priority: '0.8' },
  { path: '/article', changefreq: 'daily', priority: '0.9' },
  { path: '/resources', changefreq: 'weekly', priority: '0.7' },
  { path: '/videos', changefreq: 'weekly', priority: '0.7' },
  { path: '/productivity', changefreq: 'monthly', priority: '0.6' },
  { path: '/diagnostic', changefreq: 'monthly', priority: '0.6' }
];

/**
 * 主 Sitemap
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const now = new Date().toISOString();

    // 获取所有在线文章
    const articles = await Article.find({ isOnline: true })
      .select('slug updatedAt')
      .sort({ updatedAt: -1 })
      .limit(1000)
      .lean();

    // 生成 XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

    // 静态页面
    staticPages.forEach(page => {
      xml += `
  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    });

    // 动态文章页面
    articles.forEach(article => {
      xml += `
  <url>
    <loc>${baseUrl}/article.html?id=${article.slug || article._id}</loc>
    <lastmod>${article.updatedAt.toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    xml += '\n</urlset>';

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=3600'); // 缓存 1 小时
    res.send(xml);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * Robots.txt
 */
router.get('/robots.txt', (req, res) => {
  const robotsTxt = `# robots.txt for www.ruihua.com

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /private/

# 百度爬虫
User-agent: Baiduspider
Allow: /
Crawl-delay: 1

# Google 爬虫
User-agent: Googlebot
Allow: /

# 站点地图
Sitemap: ${baseUrl}/sitemap.xml
`;

  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.header('Cache-Control', 'public, max-age=86400'); // 缓存 24 小时
  res.send(robotsTxt);
});

module.exports = router;
