const Case = require('../models/Case');
const PageContent = require('../models/PageContent');
const GlobalConfig = require('../models/GlobalConfig');

// 案例 + 页面内容 路由模块
// 挂载：require('./routes/contentRoutes')(app, authRequired, requirePerm, logOp);
module.exports = function (app, authRequired, requirePerm, logOp, generateSeoSlug) {

  // ---------- 工具 ----------
  async function ensureUniqueCaseSlug(base, excludeId) {
    let slug = (base && String(base).trim()) || ('case-' + Date.now());
    slug = slug.slice(0, 80);
    let candidate = slug;
    let i = 1;
    // 循环直到无冲突
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const q = { slug: candidate };
      if (excludeId) q._id = { $ne: excludeId };
      const exists = await Case.findOne(q).lean();
      if (!exists) return candidate;
      candidate = `${slug}-${i++}`;
    }
  }

  function sanitizeCasePayload(body = {}, partial = false) {
    const payload = {
      title: body.title,
      industry: body.industry,
      client: body.client,
      cover: body.cover,
      tags: Array.isArray(body.tags) ? body.tags : [],
      background: body.background,
      problems: Array.isArray(body.problems) ? body.problems : [],
      goals: Array.isArray(body.goals) ? body.goals : [],
      solutions: Array.isArray(body.solutions) ? body.solutions : [],
      resultTags: Array.isArray(body.resultTags) ? body.resultTags : [],
      stats: Array.isArray(body.stats) ? body.stats : [],
      featured: !!body.featured,
      featuredOrder: Number(body.featuredOrder) || 0,
      order: Number(body.order) || 0,
      isOnline: body.isOnline === undefined ? undefined : !!body.isOnline,
      status: body.status,
      seo: body.seo && typeof body.seo === 'object' ? body.seo : undefined
    };
    if (partial) {
      Object.keys(payload).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(body, key)) delete payload[key];
      });
    }
    return payload;
  }

  // ========== 案例 Case ==========

  // 前台：案例列表（仅已发布，支持 industry 筛选）
  app.get('/api/cases', async (req, res) => {
    try {
      const q = { status: 'published', isOnline: { $ne: false } };
      if (req.query.industry && req.query.industry !== '全部') q.industry = req.query.industry;
      const list = await Case.find(q).sort({ order: 1, createdAt: -1 }).lean();
      res.json({ success: true, data: list });
    } catch (e) {
      console.error('List cases failed:', e);
      res.status(500).json({ error: '获取案例失败' });
    }
  });

  // 前台：首页精选案例
  app.get('/api/cases/featured', async (req, res) => {
    try {
      const list = await Case.find({ status: 'published', isOnline: { $ne: false }, featured: true })
        .sort({ featuredOrder: 1, createdAt: -1 }).limit(6).lean();
      res.json({ success: true, data: list });
    } catch (e) {
      console.error('List featured cases failed:', e);
      res.status(500).json({ error: '获取精选案例失败' });
    }
  });

  // 后台：案例列表（全部状态）
  app.get('/api/admin/cases', authRequired, requirePerm(['case:list', 'featured-case:list']), async (req, res) => {
    try {
      const list = await Case.find({}).sort({ order: 1, createdAt: -1 }).lean();
      res.json({ success: true, data: list });
    } catch (e) {
      console.error('Admin list cases failed:', e);
      res.status(500).json({ error: '获取案例失败' });
    }
  });

  // 前台：案例详情（按 slug）
  app.get('/api/cases/:slug', async (req, res) => {
    try {
      const doc = await Case.findOne({ slug: req.params.slug, status: 'published', isOnline: { $ne: false } }).lean();
      if (!doc) return res.status(404).json({ error: '案例不存在' });
      res.json({ success: true, data: doc });
    } catch (e) {
      console.error('Get case failed:', e);
      res.status(500).json({ error: '获取案例失败' });
    }
  });

  // 后台：新增案例
  app.post('/api/cases', authRequired, requirePerm('case:create'), async (req, res) => {
    try {
      const payload = sanitizeCasePayload(req.body);
      if (!payload.title) return res.status(400).json({ error: '标题不能为空' });
      // 新建时自动生成 SEO 友好 slug（AI 英文关键词优先，回退拼音）
      payload.slug = req.body.slug
        ? await ensureUniqueCaseSlug(req.body.slug)
        : await generateSeoSlug(payload.title, Case);
      const doc = new Case(payload);
      await doc.save();
      if (logOp) await logOp('create', 'Case', `Created case: ${doc.title}`, req.user?.username);
      res.json({ success: true, data: doc });
    } catch (e) {
      if (e.code === 11000) return res.status(400).json({ error: 'URL(Slug) 已存在' });
      console.error('Create case failed:', e);
      res.status(500).json({ error: '新增案例失败' });
    }
  });

  // 后台：单次批量保存首页精选及连续顺序
  app.put('/api/cases/featured/batch', authRequired, requirePerm('featured-case:edit'), async (req, res) => {
    try {
      const items = req.body.items;
      if (!Array.isArray(items)) return res.status(400).json({ error: '精选案例格式不正确' });
      if (items.length > 6) return res.status(400).json({ error: '首页精选案例最多 6 个' });
      const ids = items.map(item => String(item.id || ''));
      if (ids.some(id => !id)) return res.status(400).json({ error: '精选案例 ID 不能为空' });
      if (new Set(ids).size !== ids.length) return res.status(400).json({ error: '精选案例不能重复' });
      if (items.some((item, index) => item.order !== index + 1)) {
        return res.status(400).json({ error: '精选案例排序必须从 1 开始且连续' });
      }
      const cases = await Case.find({ _id: { $in: ids } }).lean();
      if (cases.length !== ids.length) return res.status(400).json({ error: '精选案例不存在' });
      if (cases.some(item => item.status !== 'published')) return res.status(400).json({ error: '精选案例必须已发布' });
      if (cases.some(item => item.isOnline === false)) return res.status(400).json({ error: '精选案例必须已上线' });
      await Case.bulkWrite([
        { updateMany: { filter: { featured: true }, update: { $set: { featured: false, featuredOrder: 0 } } } },
        ...items.map(item => ({
          updateOne: { filter: { _id: item.id }, update: { $set: { featured: true, featuredOrder: item.order } } }
        }))
      ]);
      res.json({ success: true });
    } catch (e) {
      console.error('Batch save featured cases failed:', e);
      res.status(500).json({ error: '保存精选案例失败' });
    }
  });

  // 后台：编辑案例
  app.put('/api/cases/:id', authRequired, requirePerm('case:edit'), async (req, res) => {
    try {
      const payload = sanitizeCasePayload(req.body, true);
      if (req.body.slug) {
        payload.slug = await ensureUniqueCaseSlug(req.body.slug, req.params.id);
      }
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
      const doc = await Case.findByIdAndUpdate(req.params.id, payload, { new: true });
      if (!doc) return res.status(404).json({ error: '案例不存在' });
      if (logOp) await logOp('update', 'Case', `Updated case: ${doc.title}`, req.user?.username);
      res.json({ success: true, data: doc });
    } catch (e) {
      if (e.code === 11000) return res.status(400).json({ error: 'URL(Slug) 已存在' });
      console.error('Update case failed:', e);
      res.status(500).json({ error: '编辑案例失败' });
    }
  });

  // 后台：设为/取消首页精选
  app.put('/api/cases/:id/featured', authRequired, requirePerm('featured-case:edit'), async (req, res) => {
    try {
      const update = { featured: !!req.body.featured };
      if (update.featured) {
        const current = await Case.findById(req.params.id).lean();
        if (!current) return res.status(404).json({ error: '案例不存在' });
        if (!current.featured) {
          const featuredCount = await Case.countDocuments({ featured: true });
          if (featuredCount >= 6) return res.status(400).json({ error: '首页精选案例最多 6 个' });
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'featuredOrder')) {
        update.featuredOrder = Number(req.body.featuredOrder) || 0;
      }
      const doc = await Case.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true }
      );
      if (!doc) return res.status(404).json({ error: '案例不存在' });
      res.json({ success: true, data: doc });
    } catch (e) {
      console.error('Set featured failed:', e);
      res.status(500).json({ error: '设置精选失败' });
    }
  });

  // 后台：删除案例
  app.delete('/api/cases/:id', authRequired, requirePerm('case:delete'), async (req, res) => {
    try {
      const doc = await Case.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ error: '案例不存在' });
      if (logOp) await logOp('delete', 'Case', `Deleted case: ${doc.title}`, req.user?.username);
      res.json({ success: true });
    } catch (e) {
      console.error('Delete case failed:', e);
      res.status(500).json({ error: '删除案例失败' });
    }
  });

  // ========== 全局配置 GlobalConfig ==========

  app.get('/api/global-config', async (req, res) => {
    try {
      const doc = await GlobalConfig.findOne({ key: 'website' })
        .select('tel mail cities icp qr oldDomain newDomain logo').lean();
      res.json({ success: true, data: doc || {} });
    } catch (e) {
      console.error('Get global config failed:', e);
      res.status(500).json({ error: '获取全局配置失败' });
    }
  });

  app.get('/api/admin/global-config', authRequired, requirePerm('global-config:list'), async (req, res) => {
    try {
      const doc = await GlobalConfig.findOne({ key: 'website' }).lean();
      res.json({ success: true, data: doc || {} });
    } catch (e) {
      console.error('Admin get global config failed:', e);
      res.status(500).json({ error: '获取全局配置失败' });
    }
  });

  app.put('/api/admin/global-config', authRequired, requirePerm('global-config:edit'), async (req, res) => {
    try {
      const allowed = ['tel', 'mail', 'cities', 'icp', 'qr', 'oldDomain', 'newDomain', 'logo',
        'notificationChannels', 'escalationHours', 'dailyDigest', 'fallbackRecipient', 'recipients'];
      const update = {};
      allowed.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) update[key] = req.body[key];
      });
      update.updatedAt = new Date();
      update.updatedBy = req.user?.username;
      const doc = await GlobalConfig.findOneAndUpdate(
        { key: 'website' },
        { $set: update, $setOnInsert: { key: 'website' } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
      if (logOp) await logOp('update', 'GlobalConfig', 'Updated website global config', req.user?.username);
      
      // Notify render2026 to reload the config cache
      try {
        const { reloadGlobalConfig } = require('../utils/render2026');
        if (typeof reloadGlobalConfig === 'function') {
          reloadGlobalConfig();
        }
      } catch (err) {
        console.error('Failed to notify render2026 of global config update:', err);
      }

      res.json({ success: true, data: doc });
    } catch (e) {
      console.error('Update global config failed:', e);
      res.status(400).json({ error: '全局配置格式不正确' });
    }
  });

  // ========== 页面内容 PageContent ==========

  // 前台：按 key 获取页面内容
  app.get('/api/pages/:key', async (req, res) => {
    try {
      const doc = await PageContent.findOne({ key: req.params.key }).lean();
      if (!doc) return res.status(404).json({ error: '页面内容不存在' });
      res.json({ success: true, data: doc });
    } catch (e) {
      console.error('Get page failed:', e);
      res.status(500).json({ error: '获取页面内容失败' });
    }
  });

  // 后台：页面内容列表
  app.get('/api/admin/pages', authRequired, requirePerm('page:list'), async (req, res) => {
    try {
      const list = await PageContent.find({}).sort({ key: 1 }).lean();
      res.json({ success: true, data: list });
    } catch (e) {
      console.error('List pages failed:', e);
      res.status(500).json({ error: '获取页面列表失败' });
    }
  });

  // 后台：编辑页面内容（不存在则创建）
  app.put('/api/admin/pages/:key', authRequired, requirePerm('page:edit'), async (req, res) => {
    try {
      const update = {
        title: req.body.title,
        sections: Array.isArray(req.body.sections) ? req.body.sections : [],
        seo: req.body.seo && typeof req.body.seo === 'object' ? req.body.seo : undefined,
        updatedBy: req.user?.username
      };
      Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);
      const doc = await PageContent.findOneAndUpdate(
        { key: req.params.key },
        { $set: update, $setOnInsert: { key: req.params.key } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      if (logOp) await logOp('update', 'PageContent', `Updated page: ${req.params.key}`, req.user?.username);
      res.json({ success: true, data: doc });
    } catch (e) {
      console.error('Update page failed:', e);
      res.status(500).json({ error: '编辑页面内容失败' });
    }
  });
};
