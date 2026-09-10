/**
 * 认证相关 API 路由
 * POST /api/login - 登录
 * POST /api/logout - 登出
 * PUT /api/auth/password - 修改密码
 * GET /api/auth/verify - 验证 Token
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const Admin = require('../../models/admin');
const Role = require('../../models/Role');
const { ADMIN_AUTH_COOKIE_OPTIONS, clearAdminAuthCookie } = require('../../config/auth');
const { sendInternalError } = require('../../utils/responseHelpers');
const { gatherPermissions } = require('../../middleware/adminPageAuth');
const logOp = require('../../middleware/operationLog');
const { PERMISSION_GROUPS, PERMISSION_CODES } = require('../../config/permissions');

// 登录限流
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 分钟
  max: 30, // 最多 30 次请求
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 统计有「全部权限」的管理员数量
 */
async function countSuperAdmins(excludeAdminId = null) {
  const allRoles = await Role.find({ permissions: 'all', isActive: { $ne: false } }).select('_id');
  if (allRoles.length === 0) return 0;
  const query = {
    isActive: { $ne: false },
    roles: { $in: allRoles.map(role => role._id) }
  };
  if (excludeAdminId) query._id = { $ne: excludeAdminId };
  return Admin.countDocuments(query);
}

/**
 * 初始化路由（需要传入 JWT secret 和 authRequired 中间件）
 */
function initAuthRoutes(jwtSecret, authRequired, requirePerm) {
  // POST /api/login - 登录
  router.post('/login', loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      const admin = await Admin.findOne({ username }).populate('roles');

      if (!admin) {
        return res.status(401).json({ success: false, message: '用户不存在' });
      }

      // 检查密码（只支持 bcrypt 加密）
      let isMatch = false;
      if (admin.password.startsWith('$')) {
        isMatch = await bcrypt.compare(password, admin.password);
      } else {
        console.warn(`User ${username} has a plaintext password. Please reset it.`);
        return res.status(401).json({
          success: false,
          message: 'Password security upgrade required. Please contact admin.'
        });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, message: '密码错误' });
      }

      if (!admin.isActive) {
        return res.status(403).json({ success: false, message: '账号已禁用' });
      }

      // 更新最后登录时间
      admin.lastLogin = new Date();
      await admin.save();

      // 生成 JWT Token
      const token = jwt.sign(
        { id: admin._id, username: admin.username, roles: admin.roles },
        jwtSecret,
        { expiresIn: '24h' }
      );

      // 收集权限
      const permissionSet = gatherPermissions(admin);
      const permissions = Array.from(permissionSet);

      // 设置 Cookie
      res.cookie('admin_token', token, {
        ...ADMIN_AUTH_COOKIE_OPTIONS,
        maxAge: 24 * 60 * 60 * 1000 // 24 小时
      });

      // 记录操作日志
      await logOp('login', 'Auth', `User ${username} logged in`, username);

      res.json({
        success: true,
        token,
        admin: {
          id: admin._id,
          name: admin.name,
          roles: admin.roles,
          permissions
        }
      });
    } catch (e) {
      console.error('Login Error:', e);
      res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
    }
  });

  // POST /api/logout - 登出
  router.post('/logout', (req, res) => {
    clearAdminAuthCookie(res);
    res.json({ success: true });
  });

  // PUT /api/auth/password - 修改密码
  router.put('/auth/password', authRequired, async (req, res) => {
    try {
      const currentPassword = String(req.body.currentPassword || '');
      const newPassword = String(req.body.newPassword || '');

      // 验证新密码格式
      if (!currentPassword || newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          error: '新密码至少 8 位且需包含字母和数字'
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          error: '新密码不能与当前密码相同'
        });
      }

      // 查询管理员
      const admin = await Admin.findById(req.user.id);
      if (!admin || !admin.isActive) {
        return res.status(403).json({ success: false, error: '账号已禁用或不存在' });
      }

      // 验证当前密码
      const currentPasswordMatches = admin.password.startsWith('$') &&
        await bcrypt.compare(currentPassword, admin.password);

      if (!currentPasswordMatches) {
        return res.status(400).json({ success: false, error: '当前密码不正确' });
      }

      // 更新密码
      const passwordHash = await bcrypt.hash(newPassword, 12);
      admin.password = passwordHash;
      admin.lastPasswordChangedAt = new Date();
      admin.failedLoginCount = 0;
      admin.lockedUntil = null;
      await admin.save();

      // 清除 Cookie
      clearAdminAuthCookie(res);

      // 记录操作日志
      await logOp('change_password', 'Auth', `User ${admin.username} changed password`, admin.username);

      res.json({ success: true, message: '密码已修改，请重新登录' });
    } catch (e) {
      sendInternalError(res, 'Change Password Error:', e);
    }
  });

  // GET /api/auth/verify - 验证 Token
  router.get('/auth/verify', authRequired, async (req, res) => {
    const admin = await Admin.findById(req.user.id).populate('roles');
    if (!admin || !admin.isActive) {
      return res.status(403).json({ error: 'Account disabled or not found' });
    }

    const permissionSet = gatherPermissions(admin);
    res.json({
      success: true,
      user: {
        ...req.user,
        permissions: Array.from(permissionSet)
      }
    });
  });

  // GET /api/permissions/dictionary - 获取权限字典
  router.get('/permissions/dictionary', authRequired, requirePerm('all'), (req, res) => {
    res.json({
      success: true,
      groups: PERMISSION_GROUPS,
      permissions: PERMISSION_CODES
    });
  });

  return router;
}

module.exports = initAuthRoutes;
