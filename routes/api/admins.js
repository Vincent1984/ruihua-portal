/**
 * 管理员管理 API 路由
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const Admin = require('../../models/admin');
const Role = require('../../models/Role');
const { sendInternalError } = require('../../utils/responseHelpers');
const logOp = require('../../middleware/operationLog');

/**
 * 规范化角色 ID 数组
 */
function normalizeRoleIds(roleIds) {
  if (!Array.isArray(roleIds)) return [];
  return [...new Set(roleIds.map(id => String(id || '').trim()).filter(Boolean))];
}

/**
 * 验证管理员角色 ID
 */
async function validateAdminRoleIds(roleIds) {
  const normalized = normalizeRoleIds(roleIds);
  if (normalized.length === 0) {
    return { ok: false, error: '至少需要分配一个角色' };
  }

  const invalidId = normalized.find(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidId) {
    return { ok: false, error: `无效的角色ID: ${invalidId}` };
  }

  const roles = await Role.find({ _id: { $in: normalized }, isActive: { $ne: false } });
  if (roles.length !== normalized.length) {
    return { ok: false, error: '存在不存在或已停用的角色' };
  }

  return { ok: true, roleIds: normalized, roles };
}

/**
 * 检查角色是否包含「全部」权限
 */
function rolesHaveAll(roles) {
  return Array.isArray(roles) && roles.some(role =>
    Array.isArray(role.permissions) && role.permissions.includes('all')
  );
}

/**
 * 统计活跃的超级管理员数量
 */
async function countActiveSuperAdmins(excludeAdminId = null) {
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
 * 初始化管理员路由
 */
function initAdminRoutes(authRequired, requirePerm) {

  // GET /api/admins - 获取管理员列表（需要超级管理员权限）
  router.get('/admins', authRequired, requirePerm('all'), async (req, res) => {
    try {
      const admins = await Admin.find().populate('roles');
      res.json(admins);
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // POST /api/admins - 创建管理员（需要超级管理员权限）
  router.post('/admins', authRequired, requirePerm('all'), async (req, res) => {
    try {
      const { username, password, roles, name } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Password Policy Check
      const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
      if (!pwdRegex.test(password)) {
        return res.status(400).json({ error: '密码必须包含字母和数字，且至少8位' });
      }

      const roleValidation = await validateAdminRoleIds(roles);
      if (!roleValidation.ok) {
        return res.status(400).json({ error: roleValidation.error });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdmin = new Admin({
        username,
        password: hashedPassword,
        name,
        roles: roleValidation.roleIds,
        createdBy: req.user.username,
        lastPasswordChangedAt: new Date(),
        isActive: true
      });

      await newAdmin.save();
      await logOp('create', 'Admin', `Created user: ${username}`, req.user.username);

      res.json({ success: true });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ error: '用户名已存在' });
      }
      return sendInternalError(res, null, e);
    }
  });

  // PUT /api/admins/:id - 更新管理员（需要超级管理员权限）
  router.put('/admins/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
      const { username, password, roles, name, isActive } = req.body;
      const target = await Admin.findById(req.params.id).populate('roles');

      if (!target) {
        return res.status(404).json({ error: '用户不存在' });
      }

      const isSelf = String(req.user.id) === String(req.params.id);
      const updates = { username, name, updatedBy: req.user.username };

      // Check if username exists (if changed)
      if (username) {
        const existing = await Admin.findOne({ username, _id: { $ne: req.params.id } });
        if (existing) {
          return res.status(400).json({ error: '用户名已存在' });
        }
      }

      let nextRoles = target.roles || [];
      if (roles !== undefined) {
        const roleValidation = await validateAdminRoleIds(roles);
        if (!roleValidation.ok) {
          return res.status(400).json({ error: roleValidation.error });
        }
        nextRoles = roleValidation.roles;
        updates.roles = roleValidation.roleIds;
      }

      if (isActive !== undefined) {
        const nextActive = Boolean(isActive);

        if (isSelf && !nextActive) {
          return res.status(400).json({ error: '不能禁用当前登录用户' });
        }

        if (target.isActive && !nextActive && rolesHaveAll(target.roles)) {
          const remainingSuperAdmins = await countActiveSuperAdmins(req.params.id);
          if (remainingSuperAdmins < 1) {
            return res.status(400).json({ error: '不能禁用最后一个超级管理员' });
          }
        }

        updates.isActive = nextActive;
      }

      if (isSelf && !rolesHaveAll(nextRoles)) {
        return res.status(400).json({ error: '不能移除当前用户的超级管理员权限' });
      }

      if (target.isActive && rolesHaveAll(target.roles) && !rolesHaveAll(nextRoles)) {
        const remainingSuperAdmins = await countActiveSuperAdmins(req.params.id);
        if (remainingSuperAdmins < 1) {
          return res.status(400).json({ error: '不能移除最后一个超级管理员权限' });
        }
      }

      // Handle password update
      if (password) {
        const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!pwdRegex.test(password)) {
          return res.status(400).json({ error: '密码必须包含字母和数字，且至少8位' });
        }
        updates.password = await bcrypt.hash(password, 10);
        updates.lastPasswordChangedAt = new Date();
      }

      await Admin.findByIdAndUpdate(req.params.id, updates);
      await logOp('update', 'Admin', `Updated user: ${username || req.params.id}`, req.user.username);

      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // DELETE /api/admins/:id - 删除管理员（需要超级管理员权限）
  router.delete('/admins/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
      if (String(req.user.id) === String(req.params.id)) {
        return res.status(400).json({ error: '不能删除当前登录用户' });
      }

      const target = await Admin.findById(req.params.id).populate('roles');
      if (!target) {
        return res.status(404).json({ error: '用户不存在' });
      }

      if (target.isActive && rolesHaveAll(target.roles)) {
        const remainingSuperAdmins = await countActiveSuperAdmins(req.params.id);
        if (remainingSuperAdmins < 1) {
          return res.status(400).json({ error: '不能删除最后一个超级管理员' });
        }
      }

      await Admin.findByIdAndDelete(req.params.id);
      await logOp('delete', 'Admin', `Deleted user: ${req.params.id}`, req.user.username);

      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  return router;
}

module.exports = initAdminRoutes;
