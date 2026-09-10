/**
 * 角色管理 API 路由
 */

const express = require('express');
const router = express.Router();
const { slugify } = require('transliteration');

const Role = require('../../models/Role');
const Admin = require('../../models/admin');
const { sendInternalError } = require('../../utils/responseHelpers');
const { validatePermissions } = require('../../config/permissions');
const logOp = require('../../middleware/operationLog');

/**
 * 初始化角色路由
 */
function initRoleRoutes(authRequired, requirePerm) {

  // GET /api/roles - 获取角色列表（需要超级管理员权限）
  router.get('/roles', authRequired, requirePerm('all'), async (req, res) => {
    try {
      const roles = await Role.find();
      res.json(roles);
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // POST /api/roles - 创建角色（需要超级管理员权限）
  router.post('/roles', authRequired, requirePerm('all'), async (req, res) => {
    try {
      const { name, code, permissions, description } = req.body;

      // Required fields
      if (!name) {
        return res.status(400).json({ error: '角色名称为必填项' });
      }

      // Unique checks
      const existing = await Role.findOne({ name });
      if (existing) {
        return res.status(400).json({ error: '角色名称已存在' });
      }

      let roleCode = code;
      if (!roleCode) {
        // Auto-generate code
        roleCode = slugify(name, { separator: '_' });
        // Ensure unique
        let counter = 1;
        let tempCode = roleCode;
        while (await Role.findOne({ code: tempCode })) {
          tempCode = `${roleCode}_${counter}`;
          counter++;
        }
        roleCode = tempCode;
      } else {
        const existingCode = await Role.findOne({ code: roleCode });
        if (existingCode) {
          return res.status(400).json({ error: '角色代码已存在' });
        }
      }

      // Permissions validation
      const { permissions: perms, invalid } = validatePermissions(permissions);
      if (invalid.length > 0) {
        return res.status(400).json({ error: '无效的权限项: ' + invalid.join(', ') });
      }

      const newRole = new Role({
        name,
        code: roleCode,
        permissions: perms,
        description,
        createdBy: req.user.username
      });

      await newRole.save();
      await logOp('create', 'Role', `Created role: ${name}`, req.user.username);

      res.json({ success: true, data: newRole });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // PUT /api/roles/:id - 更新角色（需要超级管理员权限）
  router.put('/roles/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
      const { name, code, permissions, description } = req.body;
      const roleBefore = await Role.findById(req.params.id);

      if (!roleBefore) {
        return res.status(404).json({ error: '角色不存在' });
      }

      if (roleBefore.isSystem && permissions !== undefined) {
        return res.status(400).json({ error: '系统角色的权限不能直接修改' });
      }

      if (name) {
        const existing = await Role.findOne({ name, _id: { $ne: req.params.id } });
        if (existing) {
          return res.status(400).json({ error: '角色名称已存在' });
        }
      }

      if (code) {
        const existingCode = await Role.findOne({ code, _id: { $ne: req.params.id } });
        if (existingCode) {
          return res.status(400).json({ error: '角色代码已存在' });
        }
      }

      const updates = { name, code, description, updatedBy: req.user.username };

      if (permissions !== undefined) {
        const { permissions: perms, invalid } = validatePermissions(permissions);
        if (invalid.length > 0) {
          return res.status(400).json({ error: '无效的权限项: ' + invalid.join(', ') });
        }

        const oldPerms = Array.isArray(roleBefore.permissions) ? roleBefore.permissions : [];
        if (oldPerms.includes('all') && !perms.includes('all')) {
          const otherAllRoles = await Role.find({
            _id: { $ne: roleBefore._id },
            permissions: 'all',
            isActive: { $ne: false }
          }).select('_id');

          const adminsWithOtherAllRole = otherAllRoles.length
            ? await Admin.countDocuments({
                isActive: { $ne: false },
                roles: { $in: otherAllRoles.map(role => role._id) }
              })
            : 0;

          if (adminsWithOtherAllRole < 1) {
            return res.status(400).json({ error: '不能移除最后一个超级角色的全部权限' });
          }
        }

        updates.permissions = perms;
      }

      await Role.findByIdAndUpdate(req.params.id, updates);
      await logOp('update', 'Role', `Updated role: ${name || req.params.id}`, req.user.username);

      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  // DELETE /api/roles/:id - 删除角色（需要超级管理员权限）
  router.delete('/roles/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) {
        return res.status(404).json({ error: '角色不存在' });
      }

      if (role.isSystem) {
        return res.status(400).json({ error: '系统角色不能删除' });
      }

      // Check if role is in use
      const adminsWithThisRole = await Admin.countDocuments({ roles: req.params.id, isActive: { $ne: false } });
      if (adminsWithThisRole > 0) {
        return res.status(400).json({ error: '角色正在使用中，无法删除' });
      }

      await Role.findByIdAndDelete(req.params.id);
      await logOp('delete', 'Role', `Deleted role: ${role.name}`, req.user.username);

      res.json({ success: true });
    } catch (e) {
      return sendInternalError(res, null, e);
    }
  });

  return router;
}

module.exports = initRoleRoutes;
