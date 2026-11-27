const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const Contact = require('../../models/ReportMailContact');
const Template = require('../../models/ReportMailTemplate');
const Batch = require('../../models/ReportDeliveryBatch');
const { REPORT_TITLE, REPORT_SLUG, runtimeSecret } = require('../../utils/reportMail');
const { createQuota } = require('../../utils/reportMailQuota');
const { isEmail, templateFields, renderTemplate } = require('../../utils/reportMailTemplate');
const { MAX_FILE, readContacts } = require('../../utils/reportMailImport');
const { queueManual } = require('../../utils/reportDelivery');
const reports = require('../../config/nqocReports.json');
const report = reports.find(item => item.slug === REPORT_SLUG);
const sources = {
    appointment: { model: require('../../models/Appointment'), label: '官网预约', perms: ['lead:list', 'appointment:list'], name: 'name', email: 'email' },
    survey: { model: require('../../models/NqocSurveySubmission'), label: '新质组织调研问卷', perms: ['nqoc:list', 'nqoc:manage'], name: 'respondentName', email: 'respondentEmail' },
    whitepaper: { model: require('../../models/WhitepaperSubmission'), label: '官网白皮书表单', perms: ['appointment:list'], name: 'name', email: 'email' }
};
const bad = message => Object.assign(new Error(message), { status: 400 });
const keyValid = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
const objectId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const actor = req => String(req.user.id || req.user.username || 'admin');
const who = req => req.user.username || actor(req);
function scope(req) { return actor(req) + ':' + req.body.requestKey; }
function basisFor(body) {
    const value = String(body.basis || '').trim();
    if (![true, 'true'].includes(body.confirmed) || !value || value.length > 300) throw bad('请确认名单对应的报告发放依据，并填写说明');
    return value;
}
function view(row) {
    return { id: 'contact-' + row._id, name: row.name, email: row.email, source: row.sourceLabel, importKey: row.importKey,
        status: row.mail?.status || 'none', nextAttemptAt: row.mail?.nextAttemptAt };
}
async function saveRows(req, rows, sourceLabel) {
    if (!keyValid(req.body.requestKey)) throw bad('无效的导入编号');
    if (!rows.length) throw bad('没有有效的邮箱记录');
    const basis = basisFor(req.body);
    const importKey = scope(req);
    await Contact.bulkWrite(rows.map(row => ({
        updateOne: {
            filter: { importKey, sourceId: row.sourceId },
            update: { $setOnInsert: { importKey, sourceId: row.sourceId, sourceLabel, basis, name: row.name, email: row.email, createdBy: who(req) } },
            upsert: true
        }
    })), { ordered: false });
    return (await Contact.find({ importKey }).sort({ _id: 1 }).lean()).map(view);
}
function init(authRequired, requirePerm, requireAnyPerm, csrfGuard) {
    const router = express.Router();
    const canSend = requirePerm('nqoc-report-leads:batch-send');
    const canManage = requirePerm('report-mail:manage');
    const checkSource = (req, res, next) => {
        const key = req.params.key || req.body.source;
        if (!Object.hasOwn(sources, key)) return res.status(400).json({ error: '不支持此表单来源' });
        return requireAnyPerm(sources[key].perms)(req, res, next);
    };
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE, files: 1, fields: 8 } }).single('file');
    const safe = fn => async (req, res) => {
        try { await fn(req, res); }
        catch (error) {
            if (!error.status) console.error('[ReportCampaign]', error.name, error.code || '');
            res.status(error.status || 500).json({ error: error.status ? error.message : '处理失败，请刷新后重试' });
        }
    };
    const sheet = (req, res, next) => upload(req, res, error => error ? res.status(400).json({ error: '请选择 512 KB 以内的 .xlsx 文件' }) : next());

    router.get('/report-mail/templates', authRequired, canSend, safe(async (_req, res) => {
        const templates = await Template.find().sort({ _id: -1 }).limit(500).lean();
        res.json({ templates, reportTitle: REPORT_TITLE, reportVersion: report.updatedAt || report.publishDate, sources: Object.entries(sources).map(([key, config]) => ({ key, label: config.label })) });
    }));
    router.post('/report-mail/templates', authRequired, csrfGuard, canManage, safe(async (req, res) => {
        const template = await Template.create({ ...templateFields(req.body), createdBy: who(req) });
        res.status(201).json(template);
    }));
    router.put('/report-mail/templates/:id', authRequired, csrfGuard, canManage, safe(async (req, res) => {
        if (!objectId(req.params.id)) throw bad('模板编号无效');
        const template = await Template.findOneAndUpdate({ _id: req.params.id, status: 'draft' }, templateFields(req.body), { new: true });
        if (!template) throw bad('只能编辑草稿，已发布模板请复制为新版本');
        res.json(template);
    }));
    router.post('/report-mail/templates/:id/:action', authRequired, csrfGuard, canManage, safe(async (req, res) => {
        const { id, action } = req.params;
        if (!objectId(id) || !['publish', 'archive'].includes(action)) throw bad('模板操作无效');
        const template = await Template.findOneAndUpdate({ _id: id, status: action === 'publish' ? 'draft' : { $ne: 'archived' } },
            { status: action === 'publish' ? 'published' : 'archived' }, { new: true });
        if (!template) throw bad('模板不存在或状态已变化');
        res.json(template);
    }));
    router.post('/report-mail/template-preview', authRequired, csrfGuard, canSend, safe(async (req, res) => {
        const template = templateFields(req.body);
        const { subject, text } = renderTemplate(template, { name: '示例申请人', sourceLabel: '示例活动' }, REPORT_TITLE, '（7 天有效的报告下载链接）');
        res.json({ subject, text });
    }));
    router.post('/report-mail/test', authRequired, csrfGuard, canSend, safe(async (req, res) => {
        if (process.env.REPORT_MAIL_ENABLED !== 'true' || !process.env.SMTP_PASS || !process.env.SMTP_USER) throw bad('邮件服务尚未启用');
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!isEmail(email) || req.body.confirmed !== true || !keyValid(req.body.requestKey)) throw bad('请确认试发收件邮箱');
        const template = { ...templateFields(req.body.template), version: 'test-' + req.body.requestKey };
        const contact = await Contact.findOneAndUpdate({ importKey: scope(req), sourceId: 'test' },
            { $setOnInsert: { email, name: '测试收件人', sourceLabel: '模板试发', basis: '管理员确认的试发任务', createdBy: who(req) } },
            { new: true, upsert: true });
        const job = await queueManual(Contact, contact, { requestKey: req.body.requestKey, expectedEmail: email, reportSlug: REPORT_SLUG,
            reportVersion: report.updatedAt || report.publishDate, requestedBy: who(req), requestedById: actor(req), reason: '模板试发', template });
        res.status(202).json({ id: 'contact-' + contact.id, jobId: job.id, status: job.status });
    }));
    router.get('/report-mail/quota', authRequired, canSend, safe(async (_req, res) => {
        if (!process.env.SMTP_USER) return res.json({ enabled: false });
        res.json({ enabled: process.env.REPORT_MAIL_ENABLED === 'true', ...await createQuota(mongoose.connection, process.env.SMTP_USER).summary() });
    }));
    router.get('/report-mail/batches', authRequired, canSend, safe(async (req, res) => {
        const page = Math.min(1000, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
        const scope = req.user.id ? { requestedById: String(req.user.id) } : { requestedBy: who(req), requestedById: '' };
        const rows = await Batch.aggregate([
            { $match: scope }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * 20 }, { $limit: 21 },
            { $project: { createdAt: 1, reason: 1, status: 1, templateName: '$template.name',
                count: { $size: { $ifNull: ['$items', []] } },
                queued: { $size: { $filter: { input: { $ifNull: ['$results', []] }, cond: { $eq: ['$$this.status', 'queued'] } } } }
            } }
        ]);
        res.json({ rows: rows.slice(0, 20), page, more: rows.length > 20 });
    }));
    router.get('/report-mail/contacts', authRequired, canSend, safe(async (req, res) => {
        const filter = { deletedAt: null, sourceId: { $ne: 'test' } };
        if (typeof req.query.batch === 'string' && req.query.batch.length <= 160) filter.importKey = req.query.batch;
        const labels = await Contact.aggregate([{ $match: filter }, { $sort: { _id: -1 } },
            { $group: { _id: '$importKey', source: { $first: '$sourceLabel' }, count: { $sum: 1 }, last: { $first: '$_id' } } },
            { $sort: { last: -1 } }, { $limit: 100 }]);
        const page = Math.min(1000, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
        const keyword = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
        if (keyword) {
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const match = { $regex: escaped, $options: 'i' };
            filter.$or = [{ name: match }, { email: match }];
        }
        const status = req.query.status;
        if (status === 'none') filter['mail.status'] = null;
        else if (['pending', 'sending', 'accepted', 'failed', 'uncertain', 'cancelled'].includes(status)) filter['mail.status'] = status;
        const rows = await Contact.find(filter).sort({ _id: -1 }).skip((page - 1) * 100).limit(101).lean();
        res.json({ rows: rows.slice(0, 100).map(view), batches: labels, page, more: rows.length > 100 });
    }));
    router.post('/report-mail/import-preview', authRequired, csrfGuard, canSend, sheet, safe(async (req, res) => {
        res.json({ rows: readContacts(req.file?.buffer) });
    }));
    router.post('/report-mail/import', authRequired, csrfGuard, canSend, sheet, safe(async (req, res) => {
        const name = String(req.body.label || '').trim();
        if (!name || name.length > 100) throw bad('请填写活动或导入批次名称');
        const rows = readContacts(req.file?.buffer).filter(row => !row.error);
        res.status(201).json({ rows: await saveRows(req, rows.map(row => ({ ...row, sourceId: 'row-' + row.row })), name) });
    }));
    router.get('/report-mail/source/:key', authRequired, canSend, checkSource, safe(async (req, res) => {
        const source = Object.hasOwn(sources, req.params.key) && sources[req.params.key];
        if (!source) throw bad('不支持此表单来源');
        const filter = { [source.email]: { $type: 'string', $ne: '' } };
        const keyword = String(req.query.q || '').trim().slice(0, 100);
        if (keyword) filter[source.email].$regex = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const page = Math.min(1000, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
        const rows = await source.model.find(filter).select([source.name, source.email, 'createdAt', 'submittedAt']).sort({ _id: -1 }).skip((page - 1) * 100).limit(101).lean();
        res.json({ rows: rows.slice(0, 100).map(row => ({ id: row._id, name: row[source.name], email: row[source.email], submittedAt: row.createdAt || row.submittedAt })), page, more: rows.length > 100 });
    }));
    router.post('/report-mail/stage', authRequired, csrfGuard, canSend, checkSource, safe(async (req, res) => {
        const source = Object.hasOwn(sources, req.body.source) && sources[req.body.source];
        const ids = req.body.ids;
        if (!source || !Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every(objectId)) throw bad('请选择 1–100 条表单记录');
        const rows = (await source.model.find({ _id: { $in: ids } }).select([source.name, source.email]).lean()).map(row => ({
            sourceId: source.model.modelName + ':' + row._id,
            email: String(row[source.email] || '').trim().toLowerCase(), name: String(row[source.name] || '').slice(0, 80)
        })).filter(row => isEmail(row.email));
        res.status(201).json({ rows: await saveRows(req, rows, source.label), skipped: ids.length - rows.length });
    }));
    return router;
}
module.exports = init;
