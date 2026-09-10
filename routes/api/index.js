/**
 * API 路由总入口
 * 集中管理所有 API 路由
 */

const express = require('express');
const router = express.Router();

/**
 * 初始化所有 API 路由
 * @param {Object} dependencies - 依赖项
 * @param {string} dependencies.jwtSecret - JWT 密钥
 * @param {Function} dependencies.authRequired - 认证中间件
 * @param {Function} dependencies.requirePerm - 权限检查中间件
 * @param {Function} dependencies.checkPerm - 权限检查函数
 * @param {Function} dependencies.requireAnyPerm - 任一权限检查中间件
 */
function initApiRoutes(dependencies) {
  const { jwtSecret, authRequired, requirePerm, checkPerm, requireAnyPerm } = dependencies;

  // 认证路由
  const authRoutes = require('./auth')(jwtSecret, authRequired, requirePerm);
  router.use('/', authRoutes);

  // 文章路由
  const articleRoutes = require('./articles')(authRequired, requirePerm);
  router.use('/', articleRoutes);  // 挂载到根路径，因为文章路由内部已有 /articles 和 /admin/articles

  // FAQ 路由
  const faqRoutes = require('./faqs')(authRequired, requirePerm);
  router.use('/', faqRoutes);  // 挂载到根路径，FAQ 路由内部已有 /faqs

  // 管理员路由
  const adminRoutes = require('./admins')(authRequired, requirePerm);
  router.use('/', adminRoutes);  // 挂载到根路径，管理员路由内部已有 /admins

  // 角色路由
  const roleRoutes = require('./roles')(authRequired, requirePerm);
  router.use('/', roleRoutes);  // 挂载到根路径，角色路由内部已有 /roles

  // 分类路由
  const categoryRoutes = require('./categories')(authRequired, requirePerm);
  router.use('/', categoryRoutes);  // 挂载到根路径，分类路由内部已有 /categories

  // SEO 和 Dashboard 路由
  const seoRoutes = require('./seo')(authRequired, requirePerm);
  router.use('/', seoRoutes);  // 挂载到根路径

  // 设置路由（Banner、Sidebar）
  const settingsRoutes = require('./settings')(authRequired, requirePerm);
  router.use('/', settingsRoutes);  // 挂载到根路径

  // 作者路由
  const authorRoutes = require('./authors')(authRequired, requirePerm);
  router.use('/', authorRoutes);  // 挂载到根路径

  // 订阅路由
  const subscriptionRoutes = require('./subscriptions')();
  router.use('/', subscriptionRoutes);  // 挂载到根路径

  // Sitemap 路由
  const sitemapRoutes = require('./sitemap');
  router.use('/', sitemapRoutes);  // 挂载到根路径

  return router;
}

module.exports = initApiRoutes;
