const Appointment = require('../models/Appointment');
const { generateDailyExternalId } = require('../utils/dailyExternalId');

const TRACKING_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'landing_page', 'referrer'];

function clean(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function channelOf(data) {
  if (data.utm_source) return data.utm_source.toLowerCase();
  if (!data.referrer) return 'direct';
  try {
    return new URL(data.referrer).hostname.replace(/^www\./, '') || 'referral';
  } catch {
    return 'referral';
  }
}

// 外部来源溯源：优先落地页 UTM 参数，其次前向 URL（referrer）域名，最后直接访问
function resolveExternalSource(data) {
  // 方式1：落地页参数（utm_source）
  if (data.utm_source) return data.utm_source.toLowerCase();
  // 方式2：前向 URL（referrer）域名
  if (data.referrer) {
    try {
      return new URL(data.referrer).hostname.replace(/^www\./, '') || 'referral';
    } catch {
      return 'referral';
    }
  }
  // 都无：直接访问
  return 'direct';
}

function buildAttribution(body = {}, cookies = {}) {
  const attribution = {};
  TRACKING_FIELDS.forEach(field => {
    attribution[field] = clean(body[field]) || clean(cookies[field]);
  });
  attribution.channel = channelOf(attribution);
  attribution.external_source = resolveExternalSource(attribution);
  return attribution;
}

function registerAppointmentAttributionRoutes(app, authRequired, requirePerm) {
  app.post('/api/appointments/website', async (req, res) => {
    try {
      const name = clean(req.body.name, 100);
      const phone = clean(req.body.phone, 30).replace(/[\s\-()（）]/g, '').replace(/^\+?86/, '');
      if (!name || !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: '请填写姓名和有效的11位手机号码' });
      }

      const attribution = buildAttribution(req.body, req.cookies);
      const appointment = await Appointment.create({
        externalId: await generateDailyExternalId(),
        name,
        phone,
        company: clean(req.body.company, 200),
        department: clean(req.body.department, 50),
        title: clean(req.body.title, 100),
        problem: clean(req.body.problem, 2000),
        email: clean(req.body.email, 200),
        source: clean(req.body.source, 200) || 'website-2026',
        intents: Array.isArray(req.body.intents) ? req.body.intents.map(item => clean(item, 100)).filter(Boolean) : [],
        leadPage: clean(req.body.leadPage, 500),
        trigger: clean(req.body.trigger, 200),
        device: clean(req.body.device, 200),
        trail: Array.isArray(req.body.trail) ? req.body.trail.slice(0, 100) : [],
        kb: Array.isArray(req.body.kb) ? req.body.kb.map(item => clean(item, 200)).filter(Boolean) : [],
        talk: Array.isArray(req.body.talk) ? req.body.talk.slice(0, 100) : [],
        ...attribution
      });
      res.status(201).json({ success: true, id: appointment._id, externalId: appointment.externalId });
    } catch (error) {
      console.error('Website appointment submission failed:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  });

  app.get('/api/admin/appointments/attribution', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
      const match = {};
      if (req.query.startDate || req.query.endDate) {
        match.createdAt = {};
        if (req.query.startDate) match.createdAt.$gte = new Date(req.query.startDate);
        if (req.query.endDate) {
          const end = new Date(req.query.endDate);
          end.setHours(23, 59, 59, 999);
          match.createdAt.$lte = end;
        }
      }

      const [total, tracked, sources, campaigns] = await Promise.all([
        Appointment.countDocuments(match),
        Appointment.countDocuments({ ...match, $or: [{ utm_source: { $nin: [null, ''] } }, { utm_campaign: { $nin: [null, ''] } }] }),
        Appointment.aggregate([
          { $match: match },
          { $group: { _id: { $ifNull: ['$utm_source', { $ifNull: ['$source', 'direct'] }] }, leads: { $sum: 1 }, processed: { $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] } } } },
          { $sort: { leads: -1 } }
        ]),
        Appointment.aggregate([
          { $match: match },
          { $group: { _id: { $ifNull: ['$utm_campaign', '未标记活动'] }, leads: { $sum: 1 }, processed: { $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] } } } },
          { $sort: { leads: -1 } }
        ])
      ]);

      res.json({ success: true, data: { total, tracked, sources, campaigns } });
    } catch (error) {
      console.error('Appointment attribution failed:', error);
      res.status(500).json({ success: false, error: '获取渠道溯源数据失败' });
    }
  });
}

module.exports = registerAppointmentAttributionRoutes;
module.exports.buildAttribution = buildAttribution;
module.exports.channelOf = channelOf;
