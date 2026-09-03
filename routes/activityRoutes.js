const crypto = require('crypto');
const path = require('path');
const XLSX = require('xlsx');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const Activity = require('../models/Activity');
const ActivityTemplate = require('../models/ActivityTemplate');
const Channel = require('../models/Channel');
const Registration = require('../models/Registration');
const VerificationCode = require('../models/VerificationCode');

function escapeRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const { maskPhone, maskEmail, validateByFormSchema } = require('../utils/activityTemplateUtils');

const DEFAULT_TEMPLATES = ['HR领袖活动模板', '城市沙龙模板', '闭门研讨会模板'];
const DEFAULT_CHANNELS = [
  { name: '第一事业群', code: 'group1', sort: 1 },
  { name: '第二事业群', code: 'group2', sort: 2 },
  { name: '第三事业群', code: 'group3', sort: 3 },
  { name: '城市协作方', code: 'city_partner', sort: 4 }
];

function randomToken() {
  return crypto.randomBytes(10).toString('hex');
}

function normalizeChannelCode(input, fallbackSeed) {
  const base = String(input || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (base) return base.slice(0, 40);
  const hash = crypto.createHash('md5').update(String(fallbackSeed || Date.now())).digest('hex').slice(0, 10);
  return 'ch_' + hash;
}

async function ensureDefaultChannels() {
  for (const c of DEFAULT_CHANNELS) {
    await Channel.updateOne({ code: c.code }, { $setOnInsert: c }, { upsert: true });
  }
}

async function verifySmsCode(phone, code) {
  const hit = await VerificationCode.findOne({
    phone,
    code,
    used: false,
    createdAt: { $gt: new Date(Date.now() - 3 * 60 * 1000) }
  });
  if (!hit) return false;
  hit.used = true;
  await hit.save();
  return true;
}

function normalizeActivityPayload(payload) {
  const channelIds = Array.isArray(payload.channels) ? payload.channels.filter(Boolean) : [];
  const styleInput = payload.styleConfig || {};
  const panelOpacityNum = Number(styleInput.panelOpacity);
  const normalized = {
    theme: String(payload.theme || '').trim(),
    city: String(payload.city || '').trim(),
    month: String(payload.month || '').trim(),
    eventTime: String(payload.eventTime || '').trim(),
    location: String(payload.location || '').trim(),
    content: String(payload.content || ''),
    organizer: String(payload.organizer || '').trim(),
    organizerContact: String(payload.organizerContact || '').trim(),
    templateName: String(payload.templateName || DEFAULT_TEMPLATES[0]).trim(),
    templateId: String(payload.templateId || '').trim(),
    activityType: String(payload.activityType || '').trim(),
    styleConfig: {
      heroImage: String(styleInput.heroImage || '').trim(),
      bgStart: String(styleInput.bgStart || '#8b5cff').trim(),
      bgEnd: String(styleInput.bgEnd || '#6f42ff').trim(),
      titleColor: String(styleInput.titleColor || '#ffffff').trim(),
      panelOpacity: Number.isFinite(panelOpacityNum) ? panelOpacityNum : 0.06,
      buttonStart: String(styleInput.buttonStart || '#8a54ff').trim(),
      buttonEnd: String(styleInput.buttonEnd || '#5a26ff').trim()
    },
    registrationDeadline: payload.registrationDeadline ? new Date(payload.registrationDeadline) : null,
    channels: channelIds
  };
  return normalized;
}

async function validateActivityPayload(payload, isEdit = false) {
  if (!payload.theme) return '请填写活动主题';
  if (!payload.city) return '请填写活动城市';
  if (!payload.month) return '请填写活动月份';
  if (!payload.eventTime) return '请填写活动时间';
  if (!payload.location) return '请填写活动地点';
  if (!payload.organizer) return '请填写筹办人';
  if (!payload.registrationDeadline || Number.isNaN(payload.registrationDeadline.getTime())) return '请填写有效的报名截止日期';
  if (payload.registrationDeadline.getTime() < Date.now() - 60 * 1000) return '报名截止日期不能早于当前时间';
  if (!payload.channels.length) return '请至少选择一个渠道';
  const channelCount = await Channel.countDocuments({ _id: { $in: payload.channels }, isActive: true });
  if (channelCount !== payload.channels.length) return '渠道配置无效，请刷新后重试';
  if (payload.templateName.length > 100) return '模板名称过长';
  if (!payload.templateId) return '请选择报名模板';
  if (payload.content.length > 10000) return '活动内容过长';
  if (!isEdit && !DEFAULT_TEMPLATES.includes(payload.templateName) && !payload.templateName) return '请选择报名模板';
  if (payload.styleConfig.panelOpacity < 0.02 || payload.styleConfig.panelOpacity > 0.6) return '毛玻璃透明度范围应在0.02-0.6';
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  if (!hex.test(payload.styleConfig.bgStart) || !hex.test(payload.styleConfig.bgEnd) || !hex.test(payload.styleConfig.titleColor) || !hex.test(payload.styleConfig.buttonStart) || !hex.test(payload.styleConfig.buttonEnd)) {
    return '样式色值格式错误，请使用HEX颜色值';
  }
  if (payload.styleConfig.heroImage && !/^https?:\/\/|^\//.test(payload.styleConfig.heroImage)) return '主视觉图片地址格式不正确';
  return null;
}

module.exports = function registerActivityRoutes(app, authRequired, requirePerm, logOp) {
  const activityRegisterLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.get('/event/register/:token', async (req, res) => {
    const exist = await Activity.findOne({ 'channelConfigs.token': req.params.token, status: 'published' }).select('_id');
    if (!exist) {
      const { render2026, loadBlock } = require('../utils/render2026');
      return res.status(404).send(render2026({
        title: '页面未找到 · 404 | 瑞华智策',
        description: '您访问的页面不存在或已被移动，返回首页继续浏览。',
        content: loadBlock('404')
      }));
    }
    res.sendFile(path.join(__dirname, '..', 'event-registration.html'));
  });

  app.get('/api/activity/templates', authRequired, requirePerm('appointment:list'), async (req, res) => {
    const list = await ActivityTemplate.find({ status: 'enabled' }).select('name');
    res.json({ success: true, data: list.map(i => i.name) });
  });

  app.get('/api/activity/channels', authRequired, requirePerm('appointment:list'), async (req, res) => {
    await ensureDefaultChannels();
    const channels = await Channel.find({ isActive: true }).sort({ sort: 1, createdAt: 1 });
    res.json({ success: true, data: channels });
  });

  app.get('/api/activity/channels/all', authRequired, requirePerm('appointment:list'), async (req, res) => {
    await ensureDefaultChannels();
    const channels = await Channel.find({}).sort({ sort: 1, createdAt: 1 });
    res.json({ success: true, data: channels });
  });

  app.post('/api/activity/channels', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const sort = Number.isFinite(Number(req.body?.sort)) ? Number(req.body.sort) : 0;
    const isActive = req.body?.isActive !== false;
    if (!name) return res.status(400).json({ success: false, error: '渠道名称不能为空' });
    const code = normalizeChannelCode(req.body?.code || name, name + Date.now());
    try {
      const item = await Channel.create({ name, code, sort, isActive });
      await logOp('create', 'ActivityChannel', `Created channel: ${name}`, req.user.username);
      res.json({ success: true, data: item });
    } catch (e) {
      if (e.code === 11000) return res.status(400).json({ success: false, error: '渠道名称或编码已存在' });
      res.status(500).json({ success: false, error: '创建渠道失败' });
    }
  });

  app.put('/api/activity/channels/:id', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const old = await Channel.findById(req.params.id);
    if (!old) return res.status(404).json({ success: false, error: '渠道不存在' });
    const name = String(req.body?.name || old.name || '').trim();
    const sort = Number.isFinite(Number(req.body?.sort)) ? Number(req.body.sort) : old.sort;
    const isActive = req.body?.isActive !== undefined ? !!req.body.isActive : old.isActive;
    const code = normalizeChannelCode(req.body?.code || old.code || name, name + req.params.id);
    if (!name) return res.status(400).json({ success: false, error: '渠道名称不能为空' });
    try {
      const item = await Channel.findByIdAndUpdate(req.params.id, { name, code, sort, isActive }, { new: true });
      await logOp('update', 'ActivityChannel', `Updated channel: ${name}`, req.user.username);
      res.json({ success: true, data: item });
    } catch (e) {
      if (e.code === 11000) return res.status(400).json({ success: false, error: '渠道名称或编码已存在' });
      res.status(500).json({ success: false, error: '更新渠道失败' });
    }
  });

  app.delete('/api/activity/channels/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
    const item = await Channel.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '渠道不存在' });
    const usedInAct = await Activity.countDocuments({ channels: req.params.id });
    const usedInReg = await Registration.countDocuments({ channelId: req.params.id });
    if (usedInAct > 0 || usedInReg > 0) {
      return res.status(400).json({ success: false, error: '渠道已被活动或报名数据使用，不能删除' });
    }
    await Channel.findByIdAndDelete(req.params.id);
    await logOp('delete', 'ActivityChannel', `Deleted channel: ${item.name}`, req.user.username);
    res.json({ success: true });
  });

  app.get('/api/activity/list', authRequired, requirePerm('appointment:list'), async (req, res) => {
    const { month, theme, city, location, organizer, page = 1, limit = 20 } = req.query;
    const query = {};
    if (month) query.month = month;
    if (theme && theme.length <= 100) query.theme = new RegExp(escapeRegex(theme), 'i');
    if (city && city.length <= 100) query.city = new RegExp(escapeRegex(city), 'i');
    if (location && location.length <= 200) query.location = new RegExp(escapeRegex(location), 'i');
    if (organizer && organizer.length <= 100) query.organizer = new RegExp(escapeRegex(organizer), 'i');

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Activity.countDocuments(query);
    const list = await Activity.find(query)
      .populate('channels', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const activityIds = list.map(i => i._id);
    const counts = await Registration.aggregate([
      { $match: { activityId: { $in: activityIds } } },
      { $group: { _id: '$activityId', cnt: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map(c => [String(c._id), c.cnt]));

    const data = list.map(item => ({
      ...item.toObject(),
      registrationCount: countMap.get(String(item._id)) || 0
    }));
    res.json({ success: true, data, pagination: { total, page: parseInt(page, 10), pages: Math.ceil(total / limit) } });
  });

  app.get('/api/activity/:id', authRequired, requirePerm('appointment:list'), async (req, res) => {
    const item = await Activity.findById(req.params.id).populate('channels', 'name code');
    if (!item) return res.status(404).json({ success: false, error: '活动不存在' });
    res.json({ success: true, data: item });
  });

  app.post('/api/activity', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const payload = normalizeActivityPayload(req.body || {});
    const errMsg = await validateActivityPayload(payload, false);
    if (errMsg) return res.status(400).json({ success: false, error: errMsg });
    const template = await ActivityTemplate.findById(payload.templateId);
    if (!template) return res.status(400).json({ success: false, error: '报名模板不存在' });
    const channelIds = payload.channels;
    const channelConfigs = channelIds.map(ch => ({ channelId: ch, token: randomToken() }));
    const activity = await Activity.create({
      theme: payload.theme,
      city: payload.city,
      month: payload.month,
      eventTime: payload.eventTime,
      location: payload.location,
      content: payload.content || '',
      registrationDeadline: payload.registrationDeadline,
      organizer: payload.organizer,
      organizerContact: payload.organizerContact || '',
      templateName: template.name || payload.templateName || DEFAULT_TEMPLATES[0],
      templateId: template._id,
      activityType: payload.activityType || template.activityType,
      styleConfig: payload.styleConfig,
      channels: channelIds,
      channelConfigs
    });
    await logOp('create', 'Activity', `Created activity: ${activity.theme}`, req.user.username);
    res.json({ success: true, data: activity });
  });


  app.put('/api/activity/:id', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    const payload = normalizeActivityPayload(req.body || {});
    const errMsg = await validateActivityPayload(payload, true);
    if (errMsg) return res.status(400).json({ success: false, error: errMsg });
    const template = await ActivityTemplate.findById(payload.templateId);
    if (!template) return res.status(400).json({ success: false, error: '报名模板不存在' });
    const old = await Activity.findById(req.params.id);
    if (!old) return res.status(404).json({ success: false, error: '活动不存在' });
    const oldTokenMap = new Map((old.channelConfigs || []).map(c => [String(c.channelId), c.token]));
    const nextChannelIds = payload.channels;
    const nextConfigs = nextChannelIds.map(ch => ({ channelId: ch, token: oldTokenMap.get(String(ch)) || randomToken() }));

    const updated = await Activity.findByIdAndUpdate(req.params.id, {
      ...payload,
      templateName: template.name || payload.templateName,
      templateId: template._id,
      activityType: payload.activityType || template.activityType,
      channels: nextChannelIds,
      channelConfigs: nextConfigs
    }, { new: true });
    await logOp('update', 'Activity', `Updated activity: ${updated.theme}`, req.user.username);
    res.json({ success: true, data: updated });
  });

  app.get('/api/activity/:id/channel-links', authRequired, requirePerm('appointment:list'), async (req, res) => {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ success: false, error: '活动不存在' });
    const channels = await Channel.find({ _id: { $in: activity.channels } });
    const channelMap = new Map(channels.map(c => [String(c._id), c]));
    const site = process.env.SITE_URL;
    if (!site) {
      return res.status(500).json({ success: false, error: '系统配置错误：未设置 SITE_URL 环境变量' });
    }

    const links = [];
    for (const cfg of activity.channelConfigs || []) {
      const channel = channelMap.get(String(cfg.channelId));
      if (!channel) continue;
      const url = `${site}/event/register/${cfg.token}`;
      const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 128 });
      links.push({
        channelId: channel._id,
        channelName: channel.name,
        url,
        qrDataUrl
      });
    }
    res.json({ success: true, data: links });
  });

  app.get('/api/activity/registrations/list', authRequired, requirePerm('appointment:list'), async (req, res) => {
    const { keyword = '', channelId = '', activityId = '', city = '', page = 1, limit = 20 } = req.query;
    const query = {};
    if (channelId) query.channelId = channelId;
    if (activityId) query.activityId = activityId;
    if (city && city.length <= 100) query.city = new RegExp(escapeRegex(city), 'i');
    if (keyword && keyword.length <= 200) {
      const regex = new RegExp(escapeRegex(keyword), 'i');
      query.$or = [{ name: regex }, { phone: regex }, { company: regex }];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Registration.countDocuments(query);
    const list = await Registration.find(query)
      .populate('activityId', 'theme city')
      .populate('channelId', 'name')
      .sort({ registerTime: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const safeData = list.map(r => ({
      ...r.toObject(),
      phone: maskPhone(r.phone),
      email: maskEmail(r.email)
    }));
    res.json({ success: true, data: safeData, pagination: { total, page: parseInt(page, 10), pages: Math.ceil(total / limit) } });
  });

  app.get('/api/activity/registrations/export', authRequired, requirePerm('appointment:export'), async (req, res) => {
    const { keyword = '', channelId = '', activityId = '', city = '' } = req.query;
    const query = {};
    if (channelId) query.channelId = channelId;
    if (activityId) query.activityId = activityId;
    if (city && city.length <= 100) query.city = new RegExp(escapeRegex(city), 'i');
    if (keyword && keyword.length <= 200) {
      const regex = new RegExp(escapeRegex(keyword), 'i');
      query.$or = [{ name: regex }, { phone: regex }, { company: regex }];
    }
    const list = await Registration.find(query)
      .populate('activityId', 'theme city')
      .populate('channelId', 'name')
      .sort({ registerTime: -1 });

    const rows = list.map(r => ({
      活动主题: r.activityId?.theme || '',
      活动城市: r.activityId?.city || r.city || '',
      渠道来源: r.channelId?.name || '',
      姓名: r.name || '',
      手机号: r.phone || '',
      企业名称: r.company || '',
      职位: r.position || '',
      邮箱: r.email || '',
      报名时间: r.registerTime ? new Date(r.registerTime).toLocaleString('zh-CN') : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'registrations');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="activity_registrations.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  });

  // Ensure /api/activity/registrations/:id comes BEFORE /api/activity/:id routes
  app.put('/api/activity/registrations/:id', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    try {
      const { name, phone, company, position, email } = req.body;
      if (!name || !phone || !company) return res.status(400).json({ success: false, error: '必填字段缺失' });
      const r = await Registration.findByIdAndUpdate(req.params.id, { name, phone, company, position, email }, { new: true });
      if (!r) return res.status(404).json({ success: false, error: '记录不存在' });
      await logOp('update', 'Registration', `Updated registration: ${name} (${phone})`, req.user.username);
      res.json({ success: true, data: r });
    } catch (e) {
      res.status(500).json({ success: false, error: '修改失败' });
    }
  });

  app.delete('/api/activity/registrations/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
    try {
      const r = await Registration.findByIdAndDelete(req.params.id);
      if (!r) return res.status(404).json({ success: false, error: '记录不存在' });
      await logOp('delete', 'Registration', `Deleted registration: ${r.name} (${r.phone})`, req.user.username);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: '删除失败' });
    }
  });



  app.get('/api/public/activity/:token', async (req, res) => {
    const activity = await Activity.findOne({ 'channelConfigs.token': req.params.token, status: 'published' })
      .populate('channels', 'name code');
    if (!activity) return res.status(404).json({ success: false, error: '活动不存在或已下线' });
    const cfg = (activity.channelConfigs || []).find(c => c.token === req.params.token);
    const channel = await Channel.findById(cfg?.channelId);
    const closed = new Date(activity.registrationDeadline).getTime() < Date.now();
    const template = activity.templateId ? await ActivityTemplate.findById(activity.templateId) : null;
    if (template) {
      template.usageStats.viewed = (template.usageStats?.viewed || 0) + 1;
      await template.save();
    }
    res.json({
      success: true,
      data: {
        activityId: activity._id,
        theme: activity.theme,
        city: activity.city,
        month: activity.month,
        eventTime: activity.eventTime,
        location: activity.location,
        content: activity.content,
        registrationDeadline: activity.registrationDeadline,
        organizer: activity.organizer,
        organizerContact: activity.organizerContact,
        templateName: activity.templateName,
        templateId: activity.templateId || null,
        activityType: activity.activityType || '',
        templateConfig: template ? {
          id: template._id,
          name: template.name,
          formSchema: template.formSchema || [],
          uiConfig: template.uiConfig || {}
        } : null,
        styleConfig: activity.styleConfig || {},
        closed,
        channelId: channel?._id || null,
        channelName: channel?.name || ''
      }
    });
  });

  app.post('/api/public/activity/register/:token', activityRegisterLimiter, async (req, res) => {
    const body = req.body || {};
    const formData = body.formData && typeof body.formData === 'object' ? body.formData : body;
    const { name, phone, company, position, email, smsCode } = formData;
    if (!name || !phone || !company || !smsCode) {
      return res.status(400).json({ success: false, error: '请填写必填项并输入验证码' });
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, error: '手机号格式不正确' });
    }
    const activity = await Activity.findOne({ 'channelConfigs.token': req.params.token, status: 'published' });
    if (!activity) return res.status(404).json({ success: false, error: '活动不存在或已下线' });
    if (new Date(activity.registrationDeadline).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: '报名已截止' });
    }
    const template = activity.templateId ? await ActivityTemplate.findById(activity.templateId) : null;
    if (template) {
      const errors = validateByFormSchema(template.formSchema || [], formData);
      if (errors.length) return res.status(400).json({ success: false, error: errors[0] });
    }
    const codeOk = await verifySmsCode(phone, smsCode);
    if (!codeOk) {
      return res.status(400).json({ success: false, error: '验证码错误或已过期' });
    }
    const cfg = (activity.channelConfigs || []).find(c => c.token === req.params.token);
    if (!cfg?.channelId) {
      return res.status(400).json({ success: false, error: '渠道信息无效' });
    }
    try {
      const item = await Registration.create({
        activityId: activity._id,
        channelId: cfg.channelId,
        name,
        phone,
        company,
        position: position || '',
        email: email || '',
        templateId: activity.templateId || null,
        formData: formData || {},
        city: activity.city,
        registerTime: new Date()
      });
      if (template) {
        template.usageStats.submitted = (template.usageStats?.submitted || 0) + 1;
        await template.save();
      }
      res.json({ success: true, message: '报名成功，后续将通过短信/邮件发放参会邀请函', data: { id: item._id } });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ success: false, error: '该手机号已报名本活动' });
      }
      res.status(500).json({ success: false, error: '报名失败，请稍后重试' });
    }
  });
};
