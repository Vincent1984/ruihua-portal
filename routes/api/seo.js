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

const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * 将外部传入的 pagePath 解析为项目内的静态 HTML 文件路径。
 * 仅允许项目根目录下的 .html/.htm 文件，拒绝路径遍历与绝对路径逃逸，防止任意文件读取。
 * @returns {string|null} 安全的绝对路径；非法输入返回 null
 */
function resolveSafePagePath(pagePath) {
  if (typeof pagePath !== 'string' || !pagePath) return null;
  // 去除查询串与哈希，统一分隔符
  const cleaned = pagePath.split('#')[0].split('?')[0].replace(/\\/g, '/');
  if (!cleaned || cleaned.includes('\0')) return null;
  // 仅允许静态 HTML 页面
  if (!/\.html?$/i.test(cleaned)) return null;
  const relative = cleaned.replace(/^\/+/, '');
  if (!relative || relative.split('/').includes('..')) return null;
  const absolute = path.resolve(PROJECT_ROOT, relative);
  if (!absolute.startsWith(PROJECT_ROOT + path.sep)) return null;
  return absolute;
}

/**
 * 初始化 SEO 路由
 */
function initSeoRoutes(authRequired, requirePerm) {

  // GET /api/admin/seo - 获取 SEO 配置
  router.get('/admin/seo', authRequired, requirePerm('system:manage'), async (req, res) => {
    try {
      const { pagePath } = req.query;
      if (typeof pagePath !== 'string' || !pagePath) {
        return res.status(400).json({ success: false, error: 'pagePath is required' });
      }

      const config = await SeoConfig.findOne({ pagePath });

      let defaultTitle = '';
      let defaultKeywords = '';
      let defaultDescription = '';

      try {
        const filePath = resolveSafePagePath(pagePath);
        if (filePath && fs.existsSync(filePath)) {
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
      if (typeof pagePath !== 'string' || !pagePath) {
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
