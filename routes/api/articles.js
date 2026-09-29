/**
 * 文章管理 API 路由
 */

const express = require('express');
const router = express.Router();

const Article = require('../../models/Article');
const ArticleHistory = require('../../models/ArticleHistory');
const Category = require('../../models/Category');
const { sendInternalError } = require('../../utils/responseHelpers');
const { sanitizeArticlePayload, getResolvedArticleAuthor, escapeRegex } = require('../../utils/articleHelpers');
const logOp = require('../../middleware/operationLog');

/**
 * 初始化文章路由
 * @param {Function} authRequired 认证中间件
 * @param {Function} requirePerm 权限检查中间件
 * @param {Object} [hooks] 由 server.js 注入的副作用钩子
 * @param {Function} [hooks.generateSeoSlug] 生成 SEO 友好 slug
 * @param {Function} [hooks.syncLLMsTxt] 同步 llms.txt
 */
function initArticleRoutes(authRequired, requirePerm, hooks = {}) {
  const { generateSeoSlug, syncLLMsTxt } = hooks;

  // GET /api/articles - 获取文章列表（公开）
  router.get('/articles', async (req, res) => {
    try {
      const { keyword, category, featured, page, limit, status, tag, zone, contentStatus } = req.query;
      let query = {};

      if (keyword && keyword.length <= 200) {
        const regex = new RegExp(escapeRegex(keyword), 'i');
        query.$or = [{ title: regex }, { content: regex }, { summary: regex }];
      }

      if (category && category !== 'all') {
        query.category = category;
      }

      if (featured === 'true') {
        query.isRecommended = true;
      }

      query.status = 'published';
      query.isOnline = { $ne: false };
      if (status === 'published') query.status = 'published';
      if (zone) query.zone = zone;
      if (contentStatus) query.contentStatus = contentStatus;

      if (tag) {
        query.tags = tag;
      }

      let articles;
      if (page && limit) {
        const skip = (page - 1) * limit;
        const total = await Article.countDocuments(query);
        const data = await Article.find(query)
          .populate('authorId')
          .sort({ publishDate: -1 })
          .skip(parseInt(skip))
          .limit(parseInt(limit));
        const resolved = data.map(a => {
          const o = a.toObject ? a.toObject() : a;
          o.author = getResolvedArticleAuthor(a);
          return o;
        });
        res.json({
          data: resolved,
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
          }
        });
      } else {
        // Backward compatibility for non-paginated calls
        articles = await Article.find(query).populate('authorId').sort({ publishDate: -1 });
        const resolved = articles.map(a => {
          const o = a.toObject ? a.toObject() : a;
          o.author = getResolvedArticleAuthor(a);
          return o;
        });
        res.json(resolved);
      }
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // GET /api/admin/articles - 获取文章列表（管理员）
  router.get('/admin/articles', authRequired, requirePerm('article:list'), async (req, res) => {
    try {
      const { keyword, category, featured, page, limit, status, tag, zone, contentStatus, isOnline } = req.query;
      let query = {};

      if (keyword && keyword.length <= 200) {
        const regex = new RegExp(escapeRegex(keyword), 'i');
        query.$or = [{ title: regex }, { content: regex }, { summary: regex }];
      }

      if (category && category !== 'all') {
        query.category = category;
      }

      if (featured === 'true') {
        query.isRecommended = true;
      }

      if (status && status !== 'all') {
        query.status = status;
      }

      if (tag) {
        query.tags = tag;
      }

      if (zone) query.zone = zone;
      if (contentStatus) query.contentStatus = contentStatus;
      if (isOnline === 'true' || isOnline === 'false') query.isOnline = isOnline === 'true';

      let articles;
      if (page && limit) {
        const skip = (page - 1) * limit;
        const total = await Article.countDocuments(query);
        const data = await Article.find(query)
          .sort({ publishDate: -1 })
          .skip(parseInt(skip))
          .limit(parseInt(limit));
        return res.json({
          data,
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
          }
        });
      }

      articles = await Article.find(query).sort({ publishDate: -1 });
      res.json(articles);
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // POST /api/articles - 创建文章（需要权限）
  router.post('/articles', authRequired, requirePerm('article:create'), async (req, res) => {
    try {
      const payload = sanitizeArticlePayload(req.body);
      const { slug } = payload;

      // Check uniqueness when slug is provided
      if (slug) {
        const existing = await Article.findOne({ slug });
        if (existing) {
          return res.status(400).json({ error: 'URL (Slug) 已存在，请更换' });
        }
      }

      const newArticle = new Article(payload);

      // Ensure publishDate and updatedAt
      const now = new Date();
      if (!newArticle.publishDate) newArticle.publishDate = now;
      if (!newArticle.updatedAt) newArticle.updatedAt = now;

      // Handle slug if not provided: 自动生成 SEO 友好 slug（AI 英文关键词优先，回退拼音）
      if (!newArticle.slug && typeof generateSeoSlug === 'function') {
        newArticle.slug = await generateSeoSlug(newArticle.title, Article);
      }

      await newArticle.save();

      // Update category count
      if (payload.category) {
        await Category.updateOne({ code: payload.category }, { $inc: { articleCount: 1 } });
      }

      // Trigger llms.txt sync
      if (typeof syncLLMsTxt === 'function') await syncLLMsTxt(newArticle);

      await logOp('create', 'Article', `Created article: ${newArticle.title}`, req.user.username);

      res.json({ success: true, data: newArticle });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ error: 'URL (Slug) 已存在' });
      }
      return sendInternalError(res, 'Create article failed:', e);
    }
  });

  // PUT /api/articles/:id - 更新文章（需要权限）
  router.put('/articles/:id', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
      const payload = sanitizeArticlePayload(req.body);
      const { slug } = payload;

      // Check uniqueness for update
      if (slug) {
        const existing = await Article.findOne({ slug, _id: { $ne: req.params.id } });
        if (existing) {
          return res.status(400).json({ error: 'URL (Slug) 已存在，请更换' });
        }
      }

      const oldArt = await Article.findById(req.params.id);

      // Save History
      if (oldArt) {
        const historyCount = await ArticleHistory.countDocuments({ articleId: oldArt._id });
        await ArticleHistory.create({
          articleId: oldArt._id,
          title: oldArt.title,
          content: oldArt.content,
          summary: oldArt.summary,
          seoTitle: oldArt.seoTitle,
          seoDescription: oldArt.seoDescription,
          seoKeywords: oldArt.seoKeywords,
          qa: oldArt.qa,
          coverImage: oldArt.coverImage,
          tags: oldArt.tags,
          status: oldArt.status,
          editor: req.user.username,
          version: historyCount + 1
        });
      }

      payload.updatedAt = Date.now();

      const article = await Article.findByIdAndUpdate(req.params.id, payload, { new: true });
      if (!article) {
        return res.status(404).json({ error: '文章不存在' });
      }

      // Handle category count update if changed
      if (oldArt && Object.prototype.hasOwnProperty.call(payload, 'category') && oldArt.category !== payload.category) {
        if (oldArt.category) await Category.updateOne({ code: oldArt.category }, { $inc: { articleCount: -1 } });
        if (payload.category) await Category.updateOne({ code: payload.category }, { $inc: { articleCount: 1 } });
      }

      await logOp('update', 'Article', `Updated article: ${article.title}`, req.user.username);

      // Trigger llms.txt sync if published
      if (typeof syncLLMsTxt === 'function') await syncLLMsTxt(article);

      res.json({ success: true, data: article });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ error: 'URL (Slug) 已存在' });
      }
      return sendInternalError(res, 'Update article failed:', e);
    }
  });

  // DELETE /api/articles/:id - 删除文章（需要权限）
  router.delete('/articles/:id', authRequired, requirePerm('article:delete'), async (req, res) => {
    try {
      const article = await Article.findById(req.params.id);
      if (!article) {
        return res.status(404).json({ error: '文章不存在' });
      }

      await Article.findByIdAndDelete(req.params.id);
      await ArticleHistory.deleteMany({ articleId: req.params.id });

      // Update category count
      if (article.category) {
        await Category.updateOne({ code: article.category }, { $inc: { articleCount: -1 } });
      }

      await logOp('delete', 'Article', `Deleted article: ${article.title}`, req.user.username);

      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, 'Delete article failed:', e);
    }
  });

  return router;
}

module.exports = initArticleRoutes;

