/**
 * 分类管理 API 路由
 */

const express = require('express');
const router = express.Router();

const Category = require('../../models/Category');
const { sendInternalError } = require('../../utils/responseHelpers');
const logOp = require('../../middleware/operationLog');

/**
 * 初始化分类路由
 */
function initCategoryRoutes(authRequired, requirePerm) {

  // GET /api/categories - 获取分类列表（公开）
  router.get('/categories', async (req, res) => {
    try {
      const categories = await Category.find().sort({ order: 1 });
      res.json(categories);
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // POST /api/categories - 创建分类（需要权限）
  router.post('/categories', authRequired, requirePerm('article:create'), async (req, res) => {
    try {
      const newCat = new Category(req.body);
      await newCat.save();
      await logOp('create', 'Category', `Created category: ${newCat.name}`, req.user.username);
      res.json({ success: true, data: newCat });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // PUT /api/categories/:id - 更新分类（需要权限）
  router.put('/categories/:id', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
      const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json({ success: true, data: cat });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // DELETE /api/categories/:id - 删除分类（需要权限）
  router.delete('/categories/:id', authRequired, requirePerm('article:delete'), async (req, res) => {
    try {
      await Category.findByIdAndDelete(req.params.id);
      // Note: Should we handle articles in this category? For now, just leave them.
      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  return router;
}

module.exports = initCategoryRoutes;
