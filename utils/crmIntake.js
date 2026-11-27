const { randomUUID } = require('crypto');
const { Company, Contact, Lead, Event, Sync } = require('../models/crm');

const text = (value, size = 200) => typeof value === 'string' ? value.trim().slice(0, size) : '';
const phoneKey = value => {
    const number = text(value).replace(/[\s()+-]/g, '');
    if (/^861\d{10}$/.test(number)) return number.slice(2);
    return /^\d{7,15}$/.test(number) ? number : '';
};
const emailKey = value => {
    const email = text(value, 254).toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
};
const companyKey = value => text(value, 160).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
const SOURCES = [
    { model: require('../models/Appointment'), key: 'appointment', title: '官网预约', fields: 'name phone email company title department problem intents source leadPage createdAt',
        map: row => ({ ...row, position: row.title, summary: row.problem, sourcePage: row.leadPage || row.source }) },
    { model: require('../models/NqocReportLead'), key: 'report', title: '报告领取', fields: 'name phone email company position reportSlug reportTitle sourcePage createdAt',
        filter: { deletedAt: null }, map: row => ({ ...row, title: row.reportTitle, group: row.reportSlug || row.reportTitle }) },
    { model: require('../models/NqocWhitepaperRequest'), key: 'legacy-whitepaper', title: '新质组织白皮书', fields: 'name phone email company position createdAt',
        filter: { deletedAt: null }, map: row => ({ ...row, group: 'nqoc-whitepaper' }) },
    { model: require('../models/WhitepaperSubmission'), key: 'whitepaper', title: '官网白皮书', fields: 'name phone email company position whitepaperName source submittedAt',
        map: row => ({ ...row, title: row.whitepaperName, group: row.whitepaperName, sourcePage: row.source, createdAt: row.submittedAt }) },
    { model: require('../models/NqocSurveySubmission'), key: 'survey', title: '新质组织调研问卷', fields: 'respondentName respondentContact respondentEmail orgName respondentTitle respondentTitle_other createdAt',
        map: row => ({ name: row.respondentName, phone: row.respondentContact, email: row.respondentEmail,
            company: row.orgName, position: row.respondentTitle_other || row.respondentTitle, createdAt: row.createdAt }) }
];

async function getCompany(name) {
    const nameKey = companyKey(name);
    if (!nameKey) return null;
    let row;
    try {
        row = await Company.findOneAndUpdate({ nameKey }, { $setOnInsert: { name, nameKey } }, { upsert: true, new: true });
    } catch (error) {
        if (error.code !== 11000) throw error;
        row = await Company.findOne({ nameKey });
    }
    if (row?.mergedInto) return Company.findOne({ _id: row.mergedInto, archivedAt: null });
    return row?.archivedAt ? null : row;
}
async function getContact(data, ownerId = null, canLink) {
    const phone = phoneKey(data.phone), email = emailKey(data.email);
    if (!phone && !email) return { conflict: '缺少可匹配的手机号或邮箱' };
    const match = [...(phone ? [{ phoneKey: phone }] : []), ...(email ? [{ emailKey: email }] : [])];
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const found = await Contact.find({ $or: match }).limit(2);
        const canonical = await Promise.all(found.map(row => row.mergedInto ? Contact.findById(row.mergedInto) : row));
        const matches = [...new Map(canonical.filter(Boolean).map(row => [row.id, row])).values()];
        if (matches.length > 1) return { conflict: '手机号和邮箱对应不同联系人' };
        const record = matches[0];
        if (record && canLink && !canLink(record)) return { conflict: '已匹配已有档案，请管理员确认归属' };
        if (record?.archivedAt) return { conflict: '联系方式对应已归档联系人' };
        const company = data.companyId ? { _id: data.companyId } : record?.companyId ? null : await getCompany(text(data.company, 160));
        const values = {
            name: text(data.name, 100) || '未留姓名', phone, email, phoneKey: phone, emailKey: email,
            position: text(data.position, 100), department: text(data.department, 100), companyId: company?._id
        };
        const filled = Object.fromEntries(Object.entries(values).filter(([key, value]) => value && !record?.[key] &&
            !(key.startsWith('phone') && found.some(row => row.mergedInto && row.phoneKey === phone)) &&
            !(key.startsWith('email') && found.some(row => row.mergedInto && row.emailKey === email))));
        try {
            if (!record) return { contact: await Contact.create({ ...filled, ownerId }) };
            const fieldConflict = ['phoneKey', 'emailKey', 'name', 'position'].some(key => record[key] && values[key] &&
                !(key === 'name' && !text(data.name)) && record[key] !== values[key]) ||
                (record.companyId && data.company && companyKey(data.company) !== (await Company.findById(record.companyId).select('nameKey').lean())?.nameKey) ||
                (record.companyId && data.companyId && String(record.companyId) !== String(data.companyId));
            if (Object.keys(filled).length) {
                const conditions = Object.fromEntries(Object.keys(filled).map(key => [key, { $in: key === 'companyId' ? [null] : [null, ''] }]));
                const updated = await Contact.findOneAndUpdate({ _id: record._id, archivedAt: null, ...conditions }, { $set: filled }, { new: true });
                if (!updated) continue;
                return { contact: updated, conflict: fieldConflict ? '提交资料与已有联系人档案不同' : '' };
            }
            return { contact: record, conflict: fieldConflict ? '提交资料与已有联系人档案不同' : '' };
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
    }
    throw new Error('CRM contact match is busy');
}

async function ingest(source, row, options = {}) {
    const key = source.key + ':' + row._id;
    const existing = await Event.findById(key).select('leadId').lean();
    if (existing) return Lead.findById(existing.leadId);
    const data = source.map(row);
    if (!phoneKey(data.phone) && !emailKey(data.email) && !options.manual) return null;
    const { contact, conflict } = options.contact ? { contact: options.contact } : await getContact(data, options.ownerId, options.canLink);
    if (options.requireContact && !contact) throw Object.assign(new Error(conflict || '无法关联联系人'), { status: 409 });
    const visibleContact = !options.canLink || !contact || options.canLink(contact) ? contact : null;
    const reportGroup = text(data.group, 160);
    const receivedAt = data.createdAt || new Date();
    const appointmentQualified = !options.manual && source.key === 'appointment' && Boolean(text(data.company))
        && Boolean(text(data.summary) || data.intents?.some(value => text(value)));
    const qualification = data.qualification || (appointmentQualified ? 'mql' : 'lead');
    const qualificationHistory = data.qualificationHistory || (appointmentQualified ? [{
        from: 'lead', to: 'mql', at: receivedAt, actor: '系统',
        reason: '官网预约提供了公司和咨询需求，待负责人核实'
    }] : []);
    const previous = reportGroup && visibleContact && await Lead.findOne({
        source: source.key, contactId: visibleContact._id, reportGroup, archivedAt: null
    }).sort({ receivedAt: 1, _id: 1 });
    const dedupKey = reportGroup && contact ? `${source.key}:${contact.id}:${reportGroup}` : key;
    const leadFields = {
        name: text(data.name, 100) || '未留姓名', source: source.key, receivedAt, reportGroup, qualification, qualificationHistory, phone: phoneKey(data.phone), email: emailKey(data.email),
        companyName: text(data.company, 160), summary: text(data.summary || data.title, 2000), contactId: visibleContact?._id,
        companyId: visibleContact?.companyId, ownerId: options.manual ? options.ownerId : (contact?.ownerId || null),
        matchIssue: conflict || (contact && !visibleContact ? '已匹配已有档案，请管理员确认归属' : ''), dedupKey,
        ...(options.manual ? { tags: data.tags, nextAt: data.nextAt, nextStep: data.nextStep } : {})
    };
    let lead = previous;
    if (!lead) {
        try {
            lead = await Lead.findOneAndUpdate({ dedupKey }, { $setOnInsert: leadFields }, { new: true, upsert: true });
        } catch (error) {
            if (error.code !== 11000) throw error;
            lead = await Lead.findOne({ dedupKey });
            if (!lead) throw error;
        }
    }
    await Event.updateOne({ _id: key }, { $setOnInsert: {
        source: source.key, sourceId: String(row._id), leadId: lead._id, contactId: visibleContact?._id,
        title: text(data.title, 200) || source.title, sourcePage: text(data.sourcePage), at: receivedAt
    } }, { upsert: true });
    return lead;
}

async function syncOnce() {
    const token = randomUUID();
    const now = new Date();
    await Sync.updateOne({ _id: 'website' }, { $setOnInsert: { leaseUntil: new Date(0) } }, { upsert: true });
    if (!await Sync.findOneAndUpdate({ _id: 'website', leaseUntil: { $lte: now } }, {
        leaseToken: token, leaseUntil: new Date(now.getTime() + 60000)
    })) return 0;
    let processed = 0, failed = false;
    try {
        for (const source of SOURCES) {
            const rows = await source.model.find({
                ...source.filter, crmImportedAt: null,
                $or: [{ crmRetryAfter: null }, { crmRetryAfter: { $lte: now } }]
            }).setOptions({ strictQuery: false }).sort({ _id: 1 }).limit(40).select(source.fields).lean();
            for (const row of rows) {
                if (!(await Sync.updateOne({ _id: 'website', leaseToken: token }, { leaseUntil: new Date(Date.now() + 60000) })).matchedCount) return processed;
                try {
                    await ingest(source, row);
                    await source.model.collection.updateOne({ _id: row._id }, { $set: { crmImportedAt: new Date() }, $unset: { crmRetryAfter: 1 } });
                    processed += 1;
                } catch (error) {
                    failed = true;
                    await source.model.collection.updateOne({ _id: row._id }, { $set: { crmRetryAfter: new Date(Date.now() + 60000) } });
                    console.error('[CRM sync]', source.key, error.code || error.name);
                }
            }
        }
        return processed;
    } finally {
        await Sync.updateOne({ _id: 'website', leaseToken: token }, {
            leaseUntil: new Date(0), completedAt: new Date(), ...(failed ? { errorAt: new Date() } : {})
        });
    }
}
function startCrmSync() {
    let busy = false, initialized = false;
    const run = async () => {
        if (busy) return;
        busy = true;
        try {
            if (!initialized) {
                await Promise.all([Company.init(), Contact.init(), Lead.init(), Event.init()]);
                for (const source of SOURCES) await source.model.collection.createIndex({ crmImportedAt: 1, _id: 1 }, { background: true });
                initialized = true;
            }
            await syncOnce();
        }
        catch (error) { console.error('[CRM sync]', error.code || error.name); }
        finally { busy = false; }
    };
    setInterval(run, 10000).unref();
    void run();
}
module.exports = { text, phoneKey, emailKey, companyKey, SOURCES, ingest, syncOnce, startCrmSync };
