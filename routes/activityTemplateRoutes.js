const XLSX = require('xlsx');
const ActivityTemplate = require('../models/ActivityTemplate');
const Activity = require('../models/Activity');
const Registration = require('../models/Registration');
const { defaultTemplateByType } = require('../utils/activityTemplateUtils');

const TYPES = ['hr_forum', 'city_salon', 'closed_door'];

function escapeRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureBuiltinTemplates() {
  for (const t of TYPES) {
    const preset = defaultTemplateByType(t);
    await ActivityTemplate.updateOne(
      { code: preset.code },
      { $setOnInsert: preset },
      { upsert: true }
    );
  }
}

function buildSnapshot(doc) {
  return {
    name: doc.name,
    code: doc.code,
    activityType: doc.activityType,
    sceneDescription: doc.sceneDescription,
    status: doc.status,
    formSchema: doc.formSchema,
    uiConfig: doc.uiConfig,
    usageStats: doc.usageStats,
    draftData: doc.draftData
  };
}

module.exports = function registerActivityTemplateRoutes(app, authRequired, requirePerm, logOp) {
  app.get('/api/activity-template/options', authRequired, requirePerm('appointment:list'), async (req, res) => {
    await ensureBuiltinTemplates();
    const { type = '' } = req.query;
    const query = { status: 'enabled' };
    if (type) query.activityType = type;
    const data = await ActivityTemplate.find(query).select('name code activityType').sort({ updatedAt: -1 });
    res.json({ success: true, data });
  });

  app.get('/api/activity-template/list', authRequired, requirePerm('appointment:list'), async (req, res) => {
    await ensureBuiltinTemplates();
    const { keyword = '', activityType = '', status = '', page = 1, limit = 20 } = req.query;
    const query = {};
    if (keyword && keyword.length <= 100) query.name = new RegExp(escapeRegex(keyword), 'i');
    if (activityType) query.activityType = activityType;
    if (status) query.status = status;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await ActivityTemplate.countDocuments(query);
    const data = await ActivityTemplate.find(query).sort({ updatedAt: -1 }).skip(skip).limit(parseInt(limit, 10));
    res.json({ success: true, data, pagination: { total, page: parseInt(page, 10), pages: Math.ceil(total / limit) } });
  });

  app.get('/api/activity-template/:id', authRequired, requirePerm('appointment:list'), async (req, res) => {
    const item = await ActivityTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '模板不存在' });
    res.json({ success: true, data: item });
  });

  app.post('/api/activity-template', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const payload = req.body || {};
    if (!payload.name || !payload.activityType) return res.status(400).json({ success: false, error: '模板名称和活动类型必填' });
    const code = String(payload.code || `${payload.activityType}_${Date.now()}`).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const item = await ActivityTemplate.create({
      ...payload,
      code,
      version: 1,
      createdBy: req.user?.username || '',
      updatedBy: req.user?.username || ''
    });
    await logOp('create', 'ActivityTemplate', `Created template: ${item.name}`, req.user?.username);
    res.json({ success: true, data: item });
  });

  app.put('/api/activity-template/:id', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const old = await ActivityTemplate.findById(req.params.id);
    if (!old) return res.status(404).json({ success: false, error: '模板不存在' });
    const oldVersion = old.version || 1;
    old.versions.push({ version: oldVersion, snapshot: buildSnapshot(old), operator: req.user?.username || '' });
    
    const body = req.body || {};
    
    // Safely update nested uiConfig properties
    if (body.uiConfig) {
      // Deep merge the existing uiConfig with the new one
      const currentUiConfig = old.uiConfig ? old.uiConfig.toObject ? old.uiConfig.toObject() : old.uiConfig : {};
      
      // Handle nested 'seo' and 'colors' properly without losing old keys
      const mergedUiConfig = { ...currentUiConfig, ...body.uiConfig };
      if (body.uiConfig.seo) {
        mergedUiConfig.seo = { ...(currentUiConfig.seo || {}), ...body.uiConfig.seo };
      }
      if (body.uiConfig.colors) {
        mergedUiConfig.colors = { ...(currentUiConfig.colors || {}), ...body.uiConfig.colors };
      }
      
      old.uiConfig = mergedUiConfig;
      old.markModified('uiConfig');
      delete body.uiConfig;
    }
    
    Object.assign(old, body);
    old.version = oldVersion + 1;
    old.updatedBy = req.user?.username || '';
    await old.save();
    await logOp('update', 'ActivityTemplate', `Updated template: ${old.name}`, req.user?.username);
    res.json({ success: true, data: old });
  });

  app.put('/api/activity-template/:id/autosave', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const item = await ActivityTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '模板不存在' });
    item.draftData = req.body || {};
    item.updatedBy = req.user?.username || '';
    await item.save();
    res.json({ success: true });
  });

  app.post('/api/activity-template/:id/clone', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const src = await ActivityTemplate.findById(req.params.id);
    if (!src) return res.status(404).json({ success: false, error: '模板不存在' });
    const item = await ActivityTemplate.create({
      ...buildSnapshot(src),
      name: `${src.name}-副本`,
      code: `${src.code}_${Date.now()}`,
      version: 1,
      createdBy: req.user?.username || '',
      updatedBy: req.user?.username || ''
    });
    await logOp('create', 'ActivityTemplate', `Cloned template: ${src.name}`, req.user?.username);
    res.json({ success: true, data: item });
  });

  app.get('/api/activity-template/:id/versions', authRequired, requirePerm('appointment:list'), async (req, res) => {
    const item = await ActivityTemplate.findById(req.params.id).select('version versions');
    if (!item) return res.status(404).json({ success: false, error: '模板不存在' });
    res.json({ success: true, data: item.versions || [], currentVersion: item.version || 1 });
  });

  app.post('/api/activity-template/:id/rollback/:version', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const item = await ActivityTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '模板不存在' });
    const target = (item.versions || []).find(v => String(v.version) === String(req.params.version));
    if (!target) return res.status(404).json({ success: false, error: '版本不存在' });
    item.versions.push({ version: item.version || 1, snapshot: buildSnapshot(item), operator: req.user?.username || '' });
    Object.assign(item, target.snapshot || {});
    item.version = (item.version || 1) + 1;
    item.updatedBy = req.user?.username || '';
    await item.save();
    await logOp('update', 'ActivityTemplate', `Rollback template: ${item.name}`, req.user?.username);
    res.json({ success: true, data: item });
  });

  app.patch('/api/activity-template/:id/status', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const status = req.body?.status;
    if (!['enabled', 'disabled'].includes(status)) return res.status(400).json({ success: false, error: '状态无效' });
    const item = await ActivityTemplate.findByIdAndUpdate(req.params.id, { status, updatedBy: req.user?.username || '' }, { new: true });
    if (!item) return res.status(404).json({ success: false, error: '模板不存在' });
    res.json({ success: true, data: item });
  });

  app.delete('/api/activity-template/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
    const item = await ActivityTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '模板不存在' });
    const used = await Activity.countDocuments({ templateId: item._id });
    if (used > 0) return res.status(400).json({ success: false, error: '模板已被活动使用，不能删除' });
    await ActivityTemplate.findByIdAndDelete(item._id);
    res.json({ success: true });
  });

  app.get('/api/activity-template/:id/stats', authRequired, requirePerm('appointment:list'), async (req, res) => {
    const item = await ActivityTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '模板不存在' });
    const activities = await Activity.find({ templateId: item._id }).select('_id');
    const activityIds = activities.map(a => a._id);
    const submitted = activityIds.length ? await Registration.countDocuments({ activityId: { $in: activityIds } }) : 0;
    const viewed = item.usageStats?.viewed || 0;
    const conversionRate = viewed > 0 ? Number(((submitted / viewed) * 100).toFixed(2)) : 0;
    res.json({ success: true, data: { viewed, submitted, conversionRate, activityCount: activities.length } });
  });

  app.get('/api/activity-template/:id/export', authRequired, requirePerm('appointment:export'), async (req, res) => {
    const { format = 'xlsx' } = req.query;
    const item = await ActivityTemplate.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '模板不存在' });
    const activities = await Activity.find({ templateId: item._id }).select('_id theme city');
    const actMap = new Map(activities.map(a => [String(a._id), a]));
    const rows = await Registration.find({ activityId: { $in: activities.map(a => a._id) } }).sort({ registerTime: -1 });
    const data = rows.map(r => ({
      活动主题: actMap.get(String(r.activityId))?.theme || '',
      活动城市: actMap.get(String(r.activityId))?.city || '',
      姓名: r.name || '',
      手机号: r.phone || '',
      企业: r.company || '',
      职位: r.position || '',
      邮箱: r.email || '',
      报名时间: r.registerTime ? new Date(r.registerTime).toLocaleString('zh-CN') : ''
    }));
    if (format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Disposition', 'attachment; filename="activity_template_stats.csv"');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send('\uFEFF' + csv);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'stats');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="activity_template_stats.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  });
};
