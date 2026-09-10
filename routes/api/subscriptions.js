/**
 * 订阅 API 路由
 */

const express = require('express');
const router = express.Router();

const Subscription = require('../../models/Subscription');
const logOp = require('../../middleware/operationLog');

/**
 * 初始化订阅路由
 */
function initSubscriptionRoutes() {

  // POST /api/subscribe - 邮箱订阅（公开）
  router.post('/subscribe', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: '邮箱地址不能为空' });
      }

      // Basic email validation
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: '请输入有效的邮箱地址' });
      }

      // Check existing
      const existing = await Subscription.findOne({ email });
      if (existing) {
        if (existing.status === 'unsubscribed') {
          existing.status = 'active';
          await existing.save();
          return res.json({ success: true, message: '重新订阅成功' });
        }
        return res.status(400).json({ error: '该邮箱已订阅' });
      }

      const newSub = new Subscription({ email });
      await newSub.save();

      await logOp('create', 'Subscription', `New subscription: ${email}`);

      res.json({ success: true, message: '订阅成功' });
    } catch (e) {
      console.error('Subscription Error:', e);
      res.status(500).json({ error: '服务器内部错误' });
    }
  });

  return router;
}

module.exports = initSubscriptionRoutes;
