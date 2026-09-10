/**
 * 作者/专家管理 API 路由
 */

const express = require('express');
const router = express.Router();

const Author = require('../../models/Author');
const Article = require('../../models/Article');
const ArticleHistory = require('../../models/ArticleHistory');
const { sendInternalError } = require('../../utils/responseHelpers');
const logOp = require('../../middleware/operationLog');

/**
 * 初始化作者路由
 */
function initAuthorRoutes(authRequired, requirePerm) {

  // GET /api/articles/:id/history - 获取文章历史版本
  router.get('/articles/:id/history', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
      const history = await ArticleHistory.find({ articleId: req.params.id })
        .sort({ version: -1 })
        .limit(20);
      res.json(history);
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // GET /api/authors - 获取作者列表（公开）
  router.get('/authors', async (req, res) => {
    try {
      const authors = await Author.find().sort({ order: 1, createdAt: -1 });
      res.json(authors);
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // GET /api/admin/authors - 获取作者列表（管理端）
  router.get('/admin/authors', authRequired, requirePerm('expert:list'), async (req, res) => {
    try {
      const authors = await Author.find().sort({ order: 1, createdAt: -1 });
      res.json(authors);
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // PUT /api/authors/reorder - 重排作者顺序
  router.put('/authors/reorder', authRequired, requirePerm('expert:edit'), async (req, res) => {
    try {
      const items = req.body.items;

      if (!Array.isArray(items) || items.some((item, index) => !item.id || item.order !== index + 1)) {
        return res.status(400).json({ error: '专家排序必须从 1 开始且连续' });
      }

      const ids = items.map(item => String(item.id));
      if (new Set(ids).size !== ids.length) {
        return res.status(400).json({ error: '专家不能重复' });
      }

      const existingCount = await Author.countDocuments({ _id: { $in: ids } });
      if (existingCount !== ids.length) {
        return res.status(400).json({ error: '专家不存在' });
      }

      if (items.length) {
        await Author.bulkWrite(items.map(item => ({
          updateOne: {
            filter: { _id: item.id },
            update: { $set: { order: item.order, updatedAt: new Date() } }
          }
        })));
      }

      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, 'Reorder Authors failed:', e);
    }
  });

  // POST /api/authors - 创建作者
  router.post('/authors', authRequired, requirePerm('expert:create'), async (req, res) => {
    try {
      const newAuthor = new Author(req.body);
      await newAuthor.save();
      await logOp('create', 'Author', `Created author: ${newAuthor.name}`, req.user.username);
      res.json({ success: true, data: newAuthor });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // PUT /api/authors/:id - 更新作者
  router.put('/authors/:id', authRequired, requirePerm('expert:edit'), async (req, res) => {
    try {
      const author = await Author.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: Date.now() },
        { new: true }
      );
      await logOp('update', 'Author', `Updated author: ${author.name}`, req.user.username);
      res.json({ success: true, data: author });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // DELETE /api/authors/:id - 删除作者
  router.delete('/authors/:id', authRequired, requirePerm('expert:delete'), async (req, res) => {
    try {
      const author = await Author.findById(req.params.id);
      if (!author) {
        return res.status(404).json({ error: '作者不存在' });
      }

      // Check if author is used by any articles
      const articlesCount = await Article.countDocuments({ 'author.name': author.name });
      if (articlesCount > 0) {
        return res.status(400).json({
          error: `该作者被 ${articlesCount} 篇文章使用，无法删除`
        });
      }

      await Author.findByIdAndDelete(req.params.id);
      await logOp('delete', 'Author', `Deleted author: ${author.name}`, req.user.username);
      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  return router;
}

module.exports = initAuthorRoutes;
