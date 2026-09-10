/**
 * SEO 配置和 Dashboard 统计 API 路由
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SeoConfig = require('../../models/SeoConfig');
const Article = require('../../models/Article');
const MaturitySubmission = require('../../models/MaturitySubmission');
const EfficiencySubmission = require('../../models/EfficiencySubmission');
const Appointment = require('../../models/Appointment');
const { sendInternalError } = require('../../utils/responseHelpers');

/**
 * 初始化 SEO 路由
 */
function initSeoRoutes(authRequired, requirePerm) {

  // GET /api/admin/seo - 获取 SEO 配置
  router.get('/admin/seo', authRequired, requirePerm('system:manage'), async (req, res) => {
    try {
      const { pagePath } = req.query;
      if (!pagePath) {
        return res.status(400).json({ success: false, error: 'pagePath is required' });
      }

      const config = await SeoConfig.findOne({ pagePath });

      let defaultTitle = '';
      let defaultKeywords = '';
      let defaultDescription = '';

      try {
        const filePath = path.join(__dirname, '../../', pagePath.startsWith('/') ? pagePath.substring(1) : pagePath);
        if (fs.existsSync(filePath)) {
          const html = await fs.promises.readFile(filePath, 'utf8');
          const dom = new JSDOM(html);
          const doc = dom.window.document;

          defaultTitle = doc.title || '';
          const kwMeta = doc.querySelector('meta[name="keywords"]');
          if (kwMeta) defaultKeywords = kwMeta.content || '';

          const descMeta = doc.querySelector('meta[name="description"]');
          if (descMeta) defaultDescription = descMeta.content || '';
        }
      } catch (fileErr) {
        console.warn(`Could not read default SEO from ${pagePath}:`, fileErr);
      }

      const data = {
        title: config && config.title ? config.title : defaultTitle,
        keywords: config && config.keywords ? config.keywords : defaultKeywords,
        description: config && config.description ? config.description : defaultDescription
      };

      res.json({ success: true, data });
    } catch (e) {
      console.error('SEO Get Error:', e);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // POST /api/admin/seo - 更新 SEO 配置
  router.post('/admin/seo', authRequired, requirePerm('system:manage'), async (req, res) => {
    try {
      const { pagePath, title, keywords, description } = req.body;
      if (!pagePath) {
        return res.status(400).json({ success: false, error: 'pagePath is required' });
      }

      let config = await SeoConfig.findOne({ pagePath });
      if (config) {
        config.title = title;
        config.keywords = keywords;
        config.description = description;
      } else {
        config = new SeoConfig({ pagePath, title, keywords, description });
      }

      await config.save();
      res.json({ success: true, data: config });
    } catch (e) {
      console.error('SEO Post Error:', e);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  return router;
}

module.exports = initSeoRoutes;
