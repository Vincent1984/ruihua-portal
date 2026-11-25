const crypto = require('crypto');
const Batch = require('../models/ReportDeliveryBatch');
const Lead = require('../models/NqocReportLead');
const Legacy = require('../models/NqocWhitepaperRequest');
const { Delivery, reportFor, queueManual } = require('./reportDelivery');
const { runtimeSecret } = require('./reportMail');
const error = (message, status = 400) => Object.assign(new Error(message), { status });
async function resolve(id) {
    if (typeof id !== 'string' || !/^(whitepaper-)?[a-f0-9]{24}$/i.test(id)) throw error('记录编号无效');
    const Model = id.startsWith('whitepaper-') ? Legacy : Lead;
    const lead = await Model.findById(id.replace(/^whitepaper-/, ''));
    if (!lead) throw error('记录不存在', 404);
    return { Model, lead };
}
async function eligible(Model, lead) {
    if (lead.deletedAt) throw error('记录在回收站中');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email || '')) throw error('邮箱格式不正确');
    if (['pending', 'sending'].includes(lead.mail?.status)) throw error('已有待发或发送中任务');
    if (lead.mail?.status === 'accepted') throw error('邮件服务已接收，批量默认不重复发送');
    if (lead.mail?.status === 'uncertain') throw error('发送结果待核实，请使用单条操作');
    const report = reportFor(Model, lead);
    const previous = await Delivery.exists({ source: Model.modelName, leadId: String(lead._id), status: { $in: ['accepted', 'uncertain'] } });
    if (previous) throw error('有已接收或待核实的历史发送，请使用单条操作');
    return report;
}
function sign(payload) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${crypto.createHmac('sha256', runtimeSecret()).update(encoded).digest('hex')}`;
}
function verify(token, actor, actorId = '') {
    if (typeof token !== 'string' || token.length > 50000) throw error('请重新预览批量名单');
    const [encoded, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', runtimeSecret()).update(encoded || '').digest('hex');
    if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw error('批量预览凭证无效');
    let payload; try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()); } catch (_) { throw error('批量预览凭证无效'); }
    if (payload.actor !== actor || (payload.actorId || '') !== actorId || !Number.isFinite(payload.expires) || payload.expires < Date.now() || !Array.isArray(payload.items) || payload.items.length > 50) throw error('预览已过期或操作人变化，请重新预览');
    return payload;
}
async function previewBatch(ids, actor, actorId = '') {
    if (!Array.isArray(ids) || !ids.length || ids.length > 50) throw error('每批请选择 1–50 条记录');
    const rows = [], items = [], emails = new Set();
    for (const id of [...new Set(ids)]) {
        let row = { id, eligible: false };
        try {
            const { Model, lead } = await resolve(id); row.name = lead.name; row.email = lead.email;
            const report = await eligible(Model, lead);
            const key = `${lead.email.toLowerCase()}:${report.slug}`;
            if (emails.has(key)) throw error('与本批其他记录的邮箱和报告重复');
            emails.add(key);
            const item = { id, expectedEmail: lead.email, reportSlug: report.slug, reportVersion: report.updatedAt || report.publishDate };
            items.push(item); Object.assign(row, { eligible: true, reportTitle: report.title, reportVersion: item.reportVersion });
        } catch (e) { if (!e.status) throw e; row.message = e.message; }
        rows.push(row);
    }
    return { rows, eligibleCount: items.length, excludedCount: rows.length - items.length,
        previewToken: sign({ actor, actorId, expires: Date.now() + 10 * 60 * 1000, items }) };
}
async function batchResult(id) {
    const batch = await Batch.findById(id).lean();
    if (!batch) throw error('批次不存在', 404);
    const jobs = await Delivery.find({ _id: { $in: batch.results.filter(r => r.jobId).map(r => r.jobId) } }).lean();
    const map = new Map(jobs.map(j => [String(j._id), j]));
    return { ...batch, results: batch.results.map(r => ({ ...r, deliveryStatus: map.get(r.jobId)?.status || null })),
        queuedCount: batch.results.filter(r => r.status === 'queued').length,
        acceptedCount: jobs.filter(j => j.status === 'accepted').length };
}
async function submitBatch({ requestKey, previewToken, reason, acknowledged }, actor, actorId = '') {
    if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey) || acknowledged !== true) throw error('请核对名单并勾选发送确认');
    let batch = await Batch.findById(requestKey);
    if (batch && (batch.requestedBy !== actor || (batch.requestedById || '') !== actorId)) throw error('只能继续自己创建的批次', 403);
    if (!batch) {
        if (!String(reason || '').trim() || String(reason).length > 300) throw error('请填写 1–300 字的批量发送原因');
        const preview = verify(previewToken, actor, actorId);
        if (!preview.items.length) throw error('本批没有可发送的记录');
        await Batch.updateOne({ _id: requestKey }, { $setOnInsert: { requestedBy: actor, requestedById: actorId, reason: String(reason).trim(), items: preview.items, status: 'pending', results: [] } }, { upsert: true });
    }
    batch = await Batch.findOneAndUpdate({ _id: requestKey, requestedBy: actor, requestedById: actorId, status: { $ne: 'completed' },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lt: new Date() } }] },
        { $set: { status: 'processing', lockedUntil: new Date(Date.now() + 120000) } }, { new: true });
    if (!batch) return batchResult(requestKey);
    try {
        for (const itemDoc of batch.items) {
            const item = itemDoc.toObject ? itemDoc.toObject() : itemDoc;
            if (batch.results.some(r => r.id === item.id)) continue;
            const perRecordKey = crypto.createHash('sha256').update(`${requestKey}:${item.id}`).digest('hex');
            let result;
            try {
                const { Model, lead } = await resolve(item.id);
                let job = await Delivery.findOne({ source: Model.modelName, leadId: String(lead._id), requestKey: perRecordKey });
                if (!job) {
                    if (lead.mail?.requestKey !== perRecordKey) await eligible(Model, lead);
                    job = await queueManual(Model, lead, { ...item, requestKey: perRecordKey, reason: batch.reason, requestedBy: actor, requestedById: actorId, origin: 'batch', batchId: requestKey });
                }
                result = { id: item.id, status: 'queued', jobId: String(job._id), message: '已加入队列' };
            } catch (e) {
                if (!e.status) throw e;
                result = { id: item.id, status: 'skipped', message: e.message };
            }
            await Batch.updateOne({ _id: requestKey, 'results.id': { $ne: item.id } }, { $push: { results: result } });
        }
        await Batch.updateOne({ _id: requestKey }, { $set: { status: 'completed', lockedUntil: null } });
    } catch (_) {
        await Batch.updateOne({ _id: requestKey, status: { $ne: 'completed' } }, { $set: { status: 'interrupted', lockedUntil: null } });
    }
    return batchResult(requestKey);
}
module.exports = { Batch, previewBatch, submitBatch, batchResult };
