/**
 * 系统设置 API 路由（Banner、Sidebar）
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Setting = require('../../models/Setting');
const { sendInternalError } = require('../../utils/responseHelpers');

/**
 * 初始化设置路由
 */
function initSettingsRoutes(authRequired, requirePerm) {

  // GET /api/banner - 获取 Banner 配置（公开）
  router.get('/banner', async (req, res) => {
    try {
      const setting = await Setting.findOne({ key: 'banner' });
      res.json(setting ? setting.value : {});
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // PUT /api/banner - 更新 Banner 配置
  router.put('/banner', authRequired, requirePerm('banner:manage'), async (req, res) => {
    try {
      await Setting.findOneAndUpdate(
        { key: 'banner' },
        { value: req.body, updatedAt: Date.now() },
        { upsert: true, new: true }
      );
      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // GET /api/sidebar/modules - 获取侧边栏模块（公开）
  router.get('/sidebar/modules', async (req, res) => {
    try {
      const setting = await Setting.findOne({ key: 'sidebar_modules' });
      res.json({ success: true, data: setting ? setting.value : [] });
    } catch (e) {
      res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
  });

  // POST /api/sidebar/modules - 创建侧边栏模块
  router.post('/sidebar/modules', authRequired, requirePerm('sidebar:manage'), async (req, res) => {
    try {
      const setting = await Setting.findOne({ key: 'sidebar_modules' });
      let modules = setting ? setting.value : [];
      if (!Array.isArray(modules)) modules = [];

      if (modules.length >= 5) {
        return res.status(400).json({ success: false, error: '最多只能配置5个侧边栏模块' });
      }

      const newModule = {
        _id: new mongoose.Types.ObjectId().toString(),
        ...req.body
      };

      modules.push(newModule);

      await Setting.findOneAndUpdate(
        { key: 'sidebar_modules' },
        { value: modules, updatedAt: Date.now() },
        { upsert: true, new: true }
      );

      res.json({ success: true, data: newModule });
    } catch (e) {
      res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
  });

  // PUT /api/sidebar/modules/:id - 更新侧边栏模块
  router.put('/sidebar/modules/:id', authRequired, requirePerm('sidebar:manage'), async (req, res) => {
    try {
      const setting = await Setting.findOne({ key: 'sidebar_modules' });
      let modules = setting ? setting.value : [];
      if (!Array.isArray(modules)) modules = [];

      const index = modules.findIndex(m => m._id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ success: false, error: '模块不存在' });
      }

      modules[index] = {
        ...modules[index],
        ...req.body,
        _id: req.params.id
      };

      await Setting.findOneAndUpdate(
        { key: 'sidebar_modules' },
        { value: modules, updatedAt: Date.now() },
        { upsert: true, new: true }
      );

      res.json({ success: true, data: modules[index] });
    } catch (e) {
      res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
  });

  // DELETE /api/sidebar/modules/:id - 删除侧边栏模块
  router.delete('/sidebar/modules/:id', authRequired, requirePerm('sidebar:manage'), async (req, res) => {
    try {
      const setting = await Setting.findOne({ key: 'sidebar_modules' });
      let modules = setting ? setting.value : [];
      if (!Array.isArray(modules)) modules = [];

      const filteredModules = modules.filter(m => m._id !== req.params.id);

      if (filteredModules.length === modules.length) {
        return res.status(404).json({ success: false, error: '模块不存在' });
      }

      await Setting.findOneAndUpdate(
        { key: 'sidebar_modules' },
        { value: filteredModules, updatedAt: Date.now() },
        { upsert: true, new: true }
      );

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
  });

  // PUT /api/sidebar/modules/reorder - 重排侧边栏模块顺序
  router.put('/sidebar/modules/reorder', authRequired, requirePerm('sidebar:manage'), async (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids)) {
        return res.status(400).json({ success: false, error: '无效的排序数据' });
      }

      const setting = await Setting.findOne({ key: 'sidebar_modules' });
      let modules = setting ? setting.value : [];
      if (!Array.isArray(modules)) modules = [];

      const reorderedModules = ids.map(id => {
        return modules.find(m => m._id === id);
      }).filter(Boolean);

      if (reorderedModules.length !== modules.length) {
        return res.status(400).json({ success: false, error: '排序数据不完整' });
      }

      await Setting.findOneAndUpdate(
        { key: 'sidebar_modules' },
        { value: reorderedModules, updatedAt: Date.now() },
        { upsert: true, new: true }
      );

      res.json({ success: true, data: reorderedModules });
    } catch (e) {
      res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
  });

  return router;
}

module.exports = initSettingsRoutes;
