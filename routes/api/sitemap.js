/**
 * Sitemap.xml 生成路由
 * 自动生成网站地图供搜索引擎索引
 */

const express = require('express');
const router = express.Router();
const Article = require('../../models/Article');

/**
 * GET /sitemap.xml - 生成网站地图
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || 'https://www.ruihuaconsulting.com';

    // 静态页面配置
    const staticPages = [
      { url: '/', priority: 1.0, changefreq: 'daily' },
      { url: '/index.html', priority: 1.0, changefreq: 'daily' },
      { url: '/about.html', priority: 0.8, changefreq: 'monthly' },
      { url: '/solutions.html', priority: 0.9, changefreq: 'weekly' },
      { url: '/training.html', priority: 0.8, changefreq: 'weekly' },
      { url: '/diagnostic.html', priority: 0.7, changefreq: 'monthly' },
      { url: '/efficiency-diagnostic.html', priority: 0.7, changefreq: 'monthly' },
      { url: '/videos.html', priority: 0.6, changefreq: 'weekly' },
      { url: '/resources.html', priority: 0.6, changefreq: 'weekly' },
      { url: '/productivity.html', priority: 0.5, changefreq: 'monthly' },
      { url: '/event-registration.html', priority: 0.5, changefreq: 'monthly' },
      { url: '/survey.html', priority: 0.4, changefreq: 'monthly' },
      { url: '/privacy.html', priority: 0.3, changefreq: 'yearly' },
    ];

    // 获取已发布的文章
    const articles = await Article.find({
      status: 'published',
      isOnline: true
    })
      .select('slug updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    // 生成 XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // 添加静态页面
    staticPages.forEach(page => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    // 添加文章页面
    articles.forEach(article => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/insights/${article.slug}</loc>\n`;
      xml += `    <lastmod>${article.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating sitemap</error>');
  }
});

module.exports = router;
