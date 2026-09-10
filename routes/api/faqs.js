/**
 * FAQ 管理 API 路由
 */

const express = require('express');
const router = express.Router();
const xss = require('xss');

const Faq = require('../../models/Faq');
const { sendInternalError } = require('../../utils/responseHelpers');
const logOp = require('../../middleware/operationLog');

/**
 * 初始化 FAQ 路由
 */
function initFaqRoutes(authRequired, requirePerm) {

  // GET /api/faqs - 获取 FAQ 列表（公开）
  router.get('/faqs', async (req, res) => {
    try {
      const query = {
        status: { $in: ['published', undefined] },
        isOnline: { $ne: false }
      };

      if (req.query.status) {
        query.status = req.query.status;
      }

      let faqsQuery = Faq.find(query).sort({ order: 1 });

      if (req.query.limit) {
        faqsQuery = faqsQuery.limit(parseInt(req.query.limit));
      }

      const faqs = await faqsQuery;
      res.json(faqs);
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // GET /api/faqs/:id - 获取单个 FAQ（公开）
  router.get('/faqs/:id', async (req, res) => {
    try {
      const faq = await Faq.findOne({
        _id: req.params.id,
        status: { $in: ['published', undefined] },
        isOnline: { $ne: false }
      });

      if (!faq) {
        return res.status(404).json({ error: 'FAQ not found' });
      }

      res.json(faq);
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // GET /api/home/content - 获取首页综合内容（公开）
  router.get('/home/content', async (req, res) => {
    const Article = require('../../models/Article');
    const Category = require('../../models/Category');

    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '3', 10), 1), 12);
      const faqLimit = Math.min(Math.max(parseInt(req.query.faqLimit || '5', 10), 1), 20);
      const includeFaqs = req.query.includeFaqs !== 'false';
      const skip = (page - 1) * limit;

      const [articles, total, categories, faqs] = await Promise.all([
        Article.find({ status: 'published', isOnline: { $ne: false }, isRecommended: true })
          .sort({ top: -1, publishDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Article.countDocuments({ status: 'published', isOnline: { $ne: false }, isRecommended: true }),
        Category.find({}).lean(),
        includeFaqs
          ? Faq.find({ status: { $in: ['published', undefined] }, isOnline: { $ne: false } })
              .sort({ order: 1 })
              .limit(faqLimit)
              .lean()
          : Promise.resolve([])
      ]);

      const categoryMap = {};
      categories.forEach((item) => {
        if (item?.code && item?.name) categoryMap[item.code] = item.name;
      });

      res.json({
        success: true,
        data: {
          page,
          limit,
          total,
          hasMore: skip + articles.length < total,
          articles: articles || [],
          faqs: faqs || [],
          categoryMap
        }
      });
    } catch (e) {
      console.error('/api/home/content failed:', e);
      res.status(500).json({ success: false, error: 'Failed to load homepage content' });
    }
  });

  // POST /api/faqs - 创建 FAQ（需要权限）
  router.post('/faqs', authRequired, requirePerm('faq:create'), async (req, res) => {
    try {
      // Remove category if passed (User requested removal)
      const { category, ...rest } = req.body;

      if (rest.answer) {
        rest.answer = xss(rest.answer);
      }

      const newFaq = new Faq(rest);
      await newFaq.save();
      await logOp('create', 'FAQ', `Created FAQ: ${newFaq.question}`, req.user.username);

      res.json({ success: true, data: newFaq });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // PUT /api/faqs/reorder - 重新排序 FAQ（需要权限）
  router.put('/faqs/reorder', authRequired, requirePerm('faq:edit'), async (req, res) => {
    try {
      const items = req.body.items;

      if (!Array.isArray(items) || items.some((item, index) => !item.id || item.order !== index + 1)) {
        return res.status(400).json({ error: 'FAQ 排序必须从 1 开始且连续' });
      }

      const ids = items.map(item => String(item.id));
      if (new Set(ids).size !== ids.length) {
        return res.status(400).json({ error: 'FAQ 不能重复' });
      }

      const existingCount = await Faq.countDocuments({ _id: { $in: ids } });
      if (existingCount !== ids.length) {
        return res.status(400).json({ error: 'FAQ 不存在' });
      }

      if (items.length) {
        await Faq.bulkWrite(items.map(item => ({
          updateOne: {
            filter: { _id: item.id },
            update: { $set: { order: item.order, updatedAt: new Date() } }
          }
        })));
      }

      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, 'Reorder FAQs failed:', e);
    }
  });

  // PUT /api/faqs/:id - 更新 FAQ（需要权限）
  router.put('/faqs/:id', authRequired, requirePerm('faq:edit'), async (req, res) => {
    try {
      const { category, ...rest } = req.body;

      if (rest.answer) {
        rest.answer = xss(rest.answer);
      }

      const faq = await Faq.findByIdAndUpdate(
        req.params.id,
        { ...rest, updatedAt: Date.now() },
        { new: true }
      );

      await logOp('update', 'FAQ', `Updated FAQ: ${faq.question}`, req.user.username);

      res.json({ success: true, data: faq });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // DELETE /api/faqs/:id - 删除 FAQ（需要权限）
  router.delete('/faqs/:id', authRequired, requirePerm('faq:delete'), async (req, res) => {
    try {
      await Faq.findByIdAndDelete(req.params.id);
      await logOp('delete', 'FAQ', `Deleted FAQ: ${req.params.id}`, req.user.username);

      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  return router;
}

module.exports = initFaqRoutes;
