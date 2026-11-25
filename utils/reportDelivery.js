const crypto = require('crypto');
const Delivery = require('../models/ReportDelivery');
const reports = require('../config/nqocReports.json');
const DEFAULT_SLUG = 'china-new-quality-organization-report-2026';
const active = ['pending', 'sending'];
function deliveryModel(Model) { return Model.db.models.ReportDelivery || Model.db.model('ReportDelivery', Delivery.schema); }
function reportFor(Model, lead) {
    const slug = Model.modelName === 'NqocWhitepaperRequest' ? DEFAULT_SLUG : lead.reportSlug;
    const report = reports.find(r => r.slug === slug && r.status === 'published' && r.fileUrl);
    if (!report || slug !== DEFAULT_SLUG) throw Object.assign(new Error('该报告尚未配置邮件发送'), { status: 400 });
    return report;
}
function legacyJobId(Model, lead) { return crypto.createHash('sha256').update(`report-mail:${Model.modelName}:${lead._id}:legacy`).digest('hex').slice(0, 24); }
async function ensureDelivery(Model, lead) {
    const Delivery = deliveryModel(Model);
    if (!lead?.mail) return null;
    const mail = lead.mail.toObject ? lead.mail.toObject() : lead.mail;
    const report = reportFor(Model, lead);
    const id = mail.jobId || legacyJobId(Model, lead);
    if (!mail.jobId) await Model.updateOne({ _id: lead._id, 'mail.jobId': { $exists: false } }, { $set: { 'mail.jobId': id } });
    await Delivery.updateOne({ _id: id }, { $setOnInsert: {
        source: Model.modelName, leadId: String(lead._id), requestKey: mail.requestKey,
        recipient: mail.recipient || lead.email, reportSlug: report.slug, reportTitle: report.title,
        reportVersion: mail.reportVersion || '',
        templateVersion: mail.templateVersion || '', origin: mail.origin || 'legacy',
        batchId: mail.batchId, requestedBy: mail.requestedBy || '', requestedById: mail.requestedById || '', requestedAt: mail.requestedAt || null, reason: mail.reason || '',
        purgeAt: lead.purgeAt || null, imported: !mail.origin, status: mail.status, attemptCount: mail.attempts || 0,
        acceptedAt: mail.acceptedAt, linkExpiresAt: mail.linkExpiresAt, messageId: mail.messageId, lastError: mail.lastError
    } }, { upsert: true });
    // 兼容滚动发布中的旧 worker：只将活动任务推进到终态，不能把终态回退成发送中。
    if (!active.includes(mail.status)) await Delivery.updateOne({ _id: id, status: { $in: active } }, { $set: {
        status: mail.status, attemptCount: mail.attempts || 0, acceptedAt: mail.acceptedAt,
        linkExpiresAt: mail.linkExpiresAt, messageId: mail.messageId, lastError: mail.lastError,
        'attempts.$[attempt].status': mail.status, 'attempts.$[attempt].endedAt': new Date(), 'attempts.$[attempt].error': mail.lastError || ''
    } }, { arrayFilters: [{ 'attempt.status': 'sending' }] });
    const job = await Delivery.findById(id);
    // 已写入的 SMTP 结果优先于旧发件箱状态，修复在结果落库两步之间崩溃的情况。
    if (['accepted', 'failed', 'cancelled', 'uncertain'].includes(job.status) && ['sending', 'uncertain'].includes(mail.status)) {
        await Model.updateOne({ _id: lead._id, 'mail.jobId': id, 'mail.status': { $in: ['sending', 'uncertain'] } }, { $set: {
            'mail.status': job.status, 'mail.acceptedAt': job.acceptedAt, 'mail.messageId': job.messageId, 'mail.lastError': job.lastError || '', 'mail.historySynced': true
        } });
    }
    return job;
}
async function migrateHistory(models) {
    await deliveryModel(models[0]).init();
    for (const Model of models) {
        const cursor = Model.find({ 'mail.status': { $exists: true }, 'mail.jobId': { $exists: false } }).cursor();
        for await (const lead of cursor) { try { await ensureDelivery(Model, lead); } catch (e) { if (e.status !== 400) throw e; } }
    }
}
async function queueManual(Model, lead, { requestKey, expectedEmail, reportSlug, reportVersion, reason, requestedBy, requestedById, origin = 'manual', batchId }) {
    const Delivery = deliveryModel(Model);
    if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey)) throw Object.assign(new Error('发送请求编号无效，请重新打开确认窗口'), { status: 400 });
    const existing = await Delivery.findOne({ source: Model.modelName, leadId: String(lead._id), requestKey });
    if (existing) return existing;
    if (lead.mail?.requestKey === requestKey) return ensureDelivery(Model, lead);
    if (lead.deletedAt) throw Object.assign(new Error('该记录在回收站中，请先恢复后再发送'), { status: 400 });
    const report = reportFor(Model, lead);
    const recipient = String(lead.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw Object.assign(new Error('收件邮箱格式不正确'), { status: 400 });
    if (expectedEmail !== recipient || reportSlug !== report.slug || reportVersion !== (report.updatedAt || report.publishDate)) {
        throw Object.assign(new Error('收件邮箱或报告已变化，请重新确认'), { status: 409 });
    }
    const previous = await ensureDelivery(Model, lead);
    if (active.includes(lead.mail?.status)) throw Object.assign(new Error('邮件已在发送队列中'), { status: 409 });
    if (previous && !String(reason || '').trim()) throw Object.assign(new Error('再次发送需要填写原因'), { status: 400 });
    if (String(reason || '').length > 300) throw Object.assign(new Error('发送原因最多 300 字'), { status: 400 });
    const last = lead.mail?.requestedAt || lead.mail?.acceptedAt;
    if (last && Date.now() - new Date(last).getTime() < 60000) throw Object.assign(new Error('发送操作过于频繁，请一分钟后再试'), { status: 429 });
    const mail = require('./reportMail').pendingReportMail(report.slug, { recipient, origin, batchId, requestedBy, requestedById,
        reason: String(reason || '').trim(), requestKey, reportVersion: report.updatedAt || report.publishDate });
    const filter = { _id: lead._id, deletedAt: null, email: lead.email, 'mail.status': { $nin: active } };
    if (lead.mail) filter['mail.jobId'] = previous._id.toString();
    else filter.mail = null;
    const updated = await Model.findOneAndUpdate(filter, { $set: { mail } }, { new: true });
    if (!updated) {
        const current = await Model.findById(lead._id);
        if (current?.mail?.requestKey === requestKey) return ensureDelivery(Model, current);
        throw Object.assign(new Error('记录状态已变化，请刷新后重试'), { status: 409 });
    }
    return ensureDelivery(Model, updated);
}
async function historyFor(Model, lead, page = 1) {
    const Delivery = deliveryModel(Model);
    await ensureDelivery(Model, lead);
    const filter = { source: Model.modelName, leadId: String(lead._id) };
    const [jobs, total, stats] = await Promise.all([
        Delivery.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 30).limit(30).lean(),
        Delivery.countDocuments(filter),
        Delivery.aggregate([{ $match: filter }, { $group: { _id: null, acceptedCount: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } }, lastAcceptedAt: { $max: '$acceptedAt' } } }])
    ]);
    return { jobs, total, page, hasMore: page * 30 < total, acceptedCount: stats[0]?.acceptedCount || 0, lastAcceptedAt: stats[0]?.lastAcceptedAt || null };
}
async function summariesFor(rows) {
    const ids = rows.map(r => String(r.id).replace(/^whitepaper-/, ''));
    const data = await Delivery.aggregate([{ $match: { leadId: { $in: ids } } }, { $group: { _id: { source: '$source', leadId: '$leadId' }, acceptedCount: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } }, lastAcceptedAt: { $max: '$acceptedAt' } } }]);
    const map = new Map(data.map(x => [(x._id.source === 'NqocWhitepaperRequest' ? 'whitepaper-' : '') + x._id.leadId, x]));
    for (const row of rows) row.mailSummary = map.get(row.id) || { acceptedCount: 0, lastAcceptedAt: null };
}
module.exports = { Delivery, deliveryModel, reportFor, ensureDelivery, migrateHistory, queueManual, historyFor, summariesFor };
