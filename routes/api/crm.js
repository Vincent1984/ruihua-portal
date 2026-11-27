const { Router } = require('express');
const { randomUUID, createHash } = require('crypto');
const { Types } = require('mongoose');
const ExcelJS = require('exceljs');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const { lookupCompany } = require('../../utils/crmCompanyLookup');
const bulkImport = require('../../utils/crmLeadImport');
const logOp = require('../../middleware/operationLog');
const Admin = require('../../models/admin');
const SkillToken = require('../../models/CrmSkillToken');
const { authWithSkillToken, issue: issueSkillToken } = require('../../utils/crmSkillAccess');
const MailContact = require('../../models/ReportMailContact');
const Report = require('../../models/NqocReportLead');
const Whitepaper = require('../../models/NqocWhitepaperRequest');
const { gatherPermissions } = require('../../middleware/adminPageAuth');
const { QUALIFICATIONS, Company, Contact, Lead, Opportunity, Event, Activity, Sync } = require('../../models/crm');
const { text, phoneKey, emailKey, companyKey, SOURCES, ingest } = require('../../utils/crmIntake');

const MODELS = { companies: Company, contacts: Contact, leads: Lead, opportunities: Opportunity };
const LEAD_STAGES = ['new', 'working', 'nurture', 'converted', 'closed'];
const OPEN_LEAD_STAGES = ['new', 'working', 'nurture'];
const DAY = 86400000;
const SHANGHAI = 8 * 3600000;
const shanghaiStart = now => Math.floor((now + SHANGHAI) / DAY) * DAY - SHANGHAI;
const dateKey = now => new Date(now + SHANGHAI).toISOString().slice(0, 10);
const OPPORTUNITY_STAGES = ['demand', 'proposal', 'quote', 'won', 'lost'];
const TERMINAL = ['converted', 'closed', 'won', 'lost'];
const CHANNELS = ['phone', 'wechat', 'email', 'meeting', 'other'];
const MANUAL_SOURCES = Object.keys(bulkImport.SOURCES);
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const UUID = /^[0-9a-f-]{36}$/i;
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const id = value => typeof value === 'string' && OBJECT_ID.test(value) ? value : null;
const same = (a, b) => String(a || '') === String(b || '');
const can = (req, perm) => req.crm.has('all') || req.crm.has(perm);
const all = req => can(req, 'crm:all');
const scope = req => all(req) ? {} : { ownerId: req.user.id };
const active = req => ({ archivedAt: null, ...scope(req) });
const canSee = (req, row) => row && (all(req) || same(row.ownerId, req.user.id));

function date(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (typeof value !== 'string' || !Number.isFinite(parsed.getTime())) throw bad('日期格式不正确');
    return parsed;
}
function amount(value) {
    if (value === '' || value == null) return null;
    if (!['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e12) throw bad('金额无效');
    return Number(value);
}
function requireCrm(perm) {
    return (req, _res, next) => next(can(req, perm) ? undefined : bad('当前账号没有该操作权限', 403));
}
async function record(req, kind, recordId) {
    const model = Object.hasOwn(MODELS, kind) && MODELS[kind];
    const row = model && id(recordId) && await model.findOne({ _id: recordId, ...active(req) });
    if (!row) throw bad('记录不存在或无权访问', 404);
    return row;
}
async function links(req, body, previous = {}) {
    const contact = body.contactId ? (same(body.contactId, previous.contactId)
        ? await Contact.findById(body.contactId) : await record(req, 'contacts', body.contactId)) : null;
    const company = body.companyId ? (same(body.companyId, previous.companyId)
        ? { _id: previous.companyId } : await record(req, 'companies', body.companyId)) : null;
    if (company && contact?.companyId && !same(company._id, contact.companyId)) throw bad('联系人与所选公司不一致');
    return { contactId: contact?._id || null, companyId: company?._id || contact?.companyId || null };
}
function note(req, kind, row, action, summary) {
    return Activity.create({ entity: kind, entityId: row._id, kind: action, summary, actorId: req.user.id, actor: req.user.username });
}
function filterFor(req, kind) {
    const filter = active(req);
    const keyword = text(req.query.q, 100);
    if (keyword) {
        const regex = { $regex: escapeRegex(keyword), $options: 'i' };
        const fields = { contacts: ['name', 'phone', 'email', 'position', 'department'], companies: ['name', 'alias', 'industry', 'region'],
            leads: ['name', 'phone', 'email', 'companyName', 'companyAlias', 'summary'], opportunities: ['name', 'direction', 'summary'] }[kind];
        filter.$or = fields.map(field => ({ [field]: regex }));
    }
    if (kind === 'leads') {
        if (LEAD_STAGES.includes(req.query.stage)) filter.stage = req.query.stage;
        else if (req.query.pool === 'open') filter.stage = { $in: OPEN_LEAD_STAGES };
        else if (req.query.pool === 'assignedWork') filter.stage = { $in: ['new', 'working'] };
        if (QUALIFICATIONS.includes(req.query.qualification)) {
            filter.qualification = req.query.qualification === 'lead' ? { $in: ['lead', null] } : req.query.qualification;
        }
        const days = Number(req.query.receivedDays);
        if ([7, 30, 90].includes(days)) {
            const today = shanghaiStart(Date.now());
            filter.receivedAt = { $gte: new Date(today - (days - 1) * DAY), $lt: new Date(today + DAY) };
        }
    }
    if (kind === 'opportunities') {
        if (OPPORTUNITY_STAGES.includes(req.query.stage)) filter.stage = req.query.stage;
        else if (req.query.pool === 'open') filter.stage = { $in: ['demand', 'proposal', 'quote'] };
    }
    if (kind === 'leads' && [...SOURCES.map(source => source.key), ...MANUAL_SOURCES].includes(req.query.source)) {
        filter.source = req.query.source === 'report' ? { $in: ['report', 'legacy-whitepaper'] } : req.query.source;
    }
    if (all(req) && req.query.owner === 'unassigned') filter.ownerId = null;
    if (all(req) && id(req.query.owner)) filter.ownerId = req.query.owner;
    if (kind !== 'companies' && text(req.query.tag, 32)) filter.tags = text(req.query.tag, 32);
    if (['leads', 'opportunities'].includes(kind)) {
        if (id(req.query.company)) filter.companyId = req.query.company;
        if (id(req.query.contact)) filter.contactId = req.query.contact;
        if (req.query.due === 'overdue') { filter.nextAt = { $ne: null, $lt: new Date() }; filter.stage ||= { $nin: TERMINAL }; }
        if (req.query.due === 'today') {
            filter.nextAt = { $gte: new Date(shanghaiStart(Date.now())), $lt: new Date(shanghaiStart(Date.now()) + DAY) };
            filter.stage ||= { $nin: TERMINAL };
        }
        if (req.query.due === 'scheduled') filter.nextAt = { $ne: null };
        if (req.query.due === 'none') filter.nextAt = null;
    }
    return filter;
}
function tags(value) {
    const list = typeof value === 'string' ? value.split(/[,，]/) : Array.isArray(value) ? value : [];
    return [...new Set(list.map(item => text(item, 32)).filter(Boolean))].slice(0, 15);
}
function leadValues(body) {
    return { name: text(body.name, 100), phone: phoneKey(body.phone), email: emailKey(body.email),
        companyName: text(body.companyName, 160), companyAlias: text(body.companyAlias, 160), summary: text(body.summary, 2000), tags: tags(body.tags),
        nextStep: text(body.nextStep, 500), nextAt: date(body.nextAt) };
}
async function entityValues(req, kind, body, previous) {
    const name = text(body.name, 160);
    if (!name) throw bad('请填写名称或姓名');
    if (kind === 'companies') {
        const website = text(body.website, 300);
        if (website && !/^https?:\/\/[^\s]+$/i.test(website)) throw bad('网站请使用 http:// 或 https:// 地址');
        return { name, nameKey: companyKey(name), alias: text(body.alias), industry: text(body.industry),
            region: text(body.region), website, notes: text(body.notes, 2000) };
    }
    const relations = await links(req, body, previous);
    if (kind === 'contacts') {
        const phone = phoneKey(body.phone), email = emailKey(body.email);
        if ((!phone && !email) || (body.phone && !phone) || (body.email && !email)) throw bad('请填写有效手机号或邮箱，至少一项');
        return { name, phone, email, phoneKey: phone || undefined, emailKey: email || undefined, companyId: relations.companyId,
            position: text(body.position), department: text(body.department), notes: text(body.notes, 2000), tags: tags(body.tags) };
    }
    if (!relations.companyId && !relations.contactId) throw bad('请关联一个已有公司或联系人');
    return { name, ...relations, direction: text(body.direction), summary: text(body.summary, 2000), tags: tags(body.tags),
        expectedAmount: amount(body.expectedAmount), expectedAt: date(body.expectedAt),
        nextStep: text(body.nextStep, 500), nextAt: date(body.nextAt) };
}
function qualificationChange(req, row, body) {
    const from = row?.qualification || 'lead';
    const to = body.qualification === undefined ? from : body.qualification;
    if (!QUALIFICATIONS.includes(to)) throw bad('线索等级无效');
    if (to === from) return null;
    const reason = text(body.reason || body.qualificationReason, 1000);
    const nextStep = text(body.nextStep, 500);
    if (!reason) throw bad('请填写等级调整依据');
    if (to === 'sql' && !nextStep) throw bad('设为 SQL 时请填写双方约定的下一步');
    return { from, to, reason, nextStep, at: new Date(), actorId: req.user.id, actor: req.user.username || '管理员' };
}
function stages(row, kind, body) {
    const options = kind === 'leads' ? LEAD_STAGES : OPPORTUNITY_STAGES;
    const stage = text(body.stage) || row.stage;
    if (!options.includes(stage) || (kind === 'leads' && stage === 'converted' && row.stage !== 'converted')) throw bad('请使用线索转化操作');
    if (row.stage === 'converted' && stage !== 'converted') throw bad('已转化的线索不能退回阶段');
    const updates = { stage };
    if (stage === 'closed' || stage === 'nurture') {
        updates.closeReason = text(body.closeReason, 500);
        if (!updates.closeReason) throw bad(stage === 'closed' ? '请填写关闭原因' : '请填写待培育原因');
    } else if (kind === 'leads' && ['new', 'working'].includes(stage)) {
        updates.closeReason = '';
    }
    if (stage === 'lost') {
        updates.lossReason = text(body.lossReason, 500);
        if (!updates.lossReason) throw bad('请填写输单原因');
    }
    if (stage === 'won') {
        updates.actualAmount = amount(body.actualAmount);
        updates.wonAt = date(body.wonAt);
        if (updates.actualAmount == null || !updates.wonAt) throw bad('请填写实际成交金额和日期');
    }
    if (TERMINAL.includes(stage)) updates.nextAt = null;
    return updates;
}

async function details(req, kind, row) {
    const related = { ...active(req) };
    const activity = Activity.find({ entity: kind, entityId: row._id }).select('-skillWrite').sort({ createdAt: -1 }).limit(50).lean();
    const associations = kind === 'companies' ? { companyId: row._id } : kind === 'contacts' ? { contactId: row._id } : null;
    const eventsQuery = kind === 'contacts' ? { contactId: row._id } : kind === 'leads' ? { leadId: row._id } : null;
    const [activities, leads, contacts, opportunities, events] = await Promise.all([
        activity, associations ? Lead.find({ ...related, ...associations }).select('name source stage').limit(30).lean() : [],
        kind === 'companies' ? Contact.find({ ...related, companyId: row._id }).select('name position').limit(30).lean() : [],
        associations ? Opportunity.find({ ...related, ...associations }).select('name stage').limit(30).lean() : [],
        eventsQuery ? Event.find(eventsQuery).sort({ at: -1 }).limit(50).lean() : []
    ]);
    const reportEvents = events.filter(event => ['report', 'legacy-whitepaper'].includes(event.source) && id(event.sourceId));
    const reportState = await Promise.all([['report', Report], ['legacy-whitepaper', Whitepaper]].map(async ([source, Model]) => ({
        source, rows: await Model.find({ _id: { $in: reportEvents.filter(event => event.source === source).map(event => event.sourceId) }, deletedAt: null })
            .select('mail.status mail.acceptedAt reportOpenCount lastReportOpenAt').lean()
    })));
    const map = new Map(reportState.flatMap(({ source, rows }) => rows.map(item => [source + ':' + item._id, item])));
    for (const event of events) {
        const report = map.get(event.source + ':' + event.sourceId);
        if (report) {
            event.report = { status: report.mail?.status, acceptedAt: report.mail?.acceptedAt,
                opens: report.reportOpenCount || 0, lastOpenedAt: report.lastReportOpenAt };
            if (can(req, 'nqoc-report-leads:list')) event.url = '/admin/nqoc-report-leads/' + (event.source === 'legacy-whitepaper' ? 'whitepaper-' : '') + event.sourceId;
        }
        if (event.source === 'appointment' && (can(req, 'lead:list') || can(req, 'appointment:list'))) event.url = '/admin/leads?q=' + encodeURIComponent(row.phone || row.email || row.name);
        if (event.source === 'survey' && can(req, 'nqoc:list')) event.url = '/admin/nqoc-survey.html';
    }
    const qualificationHistory = kind === 'leads' ? [...row.qualificationHistory].reverse() : [];
    return { row, activities, leads, contacts, opportunities, events, qualificationHistory };
}

async function recordSkillFollowUp(req, row, channel, summary) {
    const requestKey = req.body.key;
    if (typeof requestKey !== 'string' || !UUID.test(requestKey)) throw bad('跟进请求编号无效');
    const nextAt = Object.hasOwn(req.body, 'nextAt') ? date(req.body.nextAt) : undefined;
    const nextStep = Object.hasOwn(req.body, 'nextStep') ? text(req.body.nextStep, 500) : undefined;
    const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const activityId = new Types.ObjectId(hash([req.user.id, row.id, requestKey]).slice(0, 24));
    const digest = hash({ channel, summary, nextAt, nextStep });
    const scheduled = nextAt !== undefined || nextStep !== undefined;
    const needsUpdate = !TERMINAL.includes(row.stage) && (scheduled || row.stage === 'new');
    const initial = needsUpdate ? 'pending' : scheduled ? 'not_applicable' : 'unchanged';
    const entry = await Activity.findOneAndUpdate({ _id: activityId }, { $setOnInsert: {
        entity: 'leads', entityId: row._id, kind: channel, summary, nextAt, nextStep,
        actorId: req.user.id, actor: req.user.username,
        skillWrite: { digest, leadVersion: row.__v || 0, status: initial }
    } }, { upsert: true, new: true });
    if (entry.skillWrite?.digest !== digest) throw bad('该跟进编号已用于其他内容，请勿重复使用', 409);
    let status = entry.skillWrite.status;
    if (status === 'pending') {
        const fields = { lastSkillActivityId: entry._id };
        if (row.stage === 'new') fields.stage = 'working';
        if (nextAt !== undefined) fields.nextAt = nextAt;
        if (nextStep !== undefined) fields.nextStep = nextStep;
        const version = entry.skillWrite.leadVersion;
        const change = await Lead.updateOne({
            _id: row._id, ...active(req), stage: { $nin: TERMINAL },
            __v: version === 0 ? { $in: [0, null] } : version
        }, { $set: fields, $inc: { __v: 1 } });
        status = (change.matchedCount || await Lead.exists({ _id: row._id, ...active(req), lastSkillActivityId: entry._id }))
            ? 'applied' : 'conflict';
        await Activity.updateOne({ _id: entry._id, 'skillWrite.status': 'pending' }, { $set: { 'skillWrite.status': status } });
        status = (await Activity.findById(entry._id).select('skillWrite.status').lean()).skillWrite.status;
    }
    const current = await Lead.findOne({ _id: row._id, ...active(req) }).select('name stage nextAt nextStep').lean();
    return { row: current, activityId: entry.id, schedule: status };
}

function init(authRequired, jwtSecret) {
    const router = Router();
    const wrap = handler => async (req, res, next) => {
        try { await handler(req, res); } catch (error) { next(error); }
    };
    router.use(authWithSkillToken(authRequired), (req, res, next) => {
        void (async () => {
            res.set('Cache-Control', 'no-store');
            const admin = id(req.user?.id) && await Admin.findById(req.user.id).populate('roles').lean();
            req.crm = gatherPermissions(admin);
            if (!admin?.isActive || !can(req, 'crm:view')) throw bad('当前账号没有 CRM 查看权限', 403);
            if (req.crmSkill) {
                req.user.username = admin.username;
                req.user.name = admin.name;
            }
            if (!['GET', 'HEAD'].includes(req.method) && req.get('sec-fetch-site') === 'cross-site') throw bad('请求来源校验失败', 403);
            next();
        })().catch(next);
    });
    router.get('/skill-connection', wrap(async (req, res) => {
        if (!req.crmSkill) throw bad('请使用 CRM 技能令牌连接', 400);
        res.json({ connected: true, account: req.user.name || req.user.username, writeAllowed: can(req, 'crm:edit'),
            expiresAt: req.crmSkill.expiresAt });
    }));
    router.get('/skill-tokens', wrap(async (req, res) => {
        const rows = await SkillToken.find({ ownerId: req.user.id, expiresAt: { $gt: new Date() }, revokedAt: null })
            .select('label createdAt expiresAt').sort({ createdAt: -1 }).lean();
        res.json({ rows });
    }));
    router.post('/skill-tokens', requireCrm('crm:edit'), wrap(async (req, res) => {
        const label = text(req.body?.label, 80) || 'Codex CRM 技能';
        const entry = await issueSkillToken(req.user.id, label);
        await logOp('创建技能令牌', 'CRM', label, req.user.username);
        res.status(201).json(entry);
    }));
    router.delete('/skill-tokens/:id', wrap(async (req, res) => {
        if (!id(req.params.id)) throw bad('令牌编号无效');
        const token = await SkillToken.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id, revokedAt: null },
            { revokedAt: new Date() }).select('label').lean();
        if (!token) throw bad('令牌不存在或已撤销', 404);
        await logOp('撤销技能令牌', 'CRM', token.label, req.user.username);
        res.json({ ok: true });
    }));
    router.get('/meta', wrap(async (req, res) => {
        const admins = can(req, 'crm:assign') || all(req) ? await Admin.find({ isActive: true }).select('name username roles').populate('roles', 'permissions').lean() : [];
        res.json({ owners: admins.filter(admin => ['all', 'crm:view'].some(perm => gatherPermissions(admin).has(perm)))
            .map(({ _id, name, username }) => ({ _id, name: name || username })),
            companyLookup: can(req, 'crm:edit') && !!process.env.BOCHA_API_KEY,
            sync: all(req) ? await Sync.findById('website').select('completedAt errorAt').lean() : null });
    }));
    const companyLookupLimit = rateLimit({
        windowMs: 60000, limit: 12, keyGenerator: req => req.user.id,
        standardHeaders: 'draft-8', legacyHeaders: false,
        message: { error: '查询过于频繁，请稍候再试' }
    });
    router.post('/companies/lookup-name', requireCrm('crm:edit'), companyLookupLimit, wrap(async (req, res) => {
        const result = await lookupCompany(req.body.name);
        const names = result.candidates.map(candidate => companyKey(candidate.name));
        const existing = names.length ? await Company.find({ ...active(req), nameKey: { $in: names } }).select('name nameKey').lean() : [];
        const byName = new Map(existing.map(company => [company.nameKey, company]));
        res.json({
            candidates: result.candidates.map(candidate => ({
                ...candidate, companyId: byName.get(companyKey(candidate.name))?._id || null
            })),
            references: result.references
        });
    }));
    router.post('/matches', requireCrm('crm:edit'), wrap(async (req, res) => {
        const phone = phoneKey(req.body.phone), email = emailKey(req.body.email), exclude = id(req.body.id);
        const selectors = [...(phone ? [{ phoneKey: phone }] : []), ...(email ? [{ emailKey: email }] : [])];
        const contacts = selectors.length ? await Contact.find({ ...active(req), _id: { $ne: exclude }, $or: selectors }).select('name').limit(2).lean() : [];
        const name = companyKey(req.body.companyName);
        const company = name ? await Company.findOne({ ...active(req), _id: { $ne: exclude }, nameKey: name }).select('name').lean() : null;
        res.json({ contacts, company });
    }));
    router.get('/dashboard', wrap(async (req, res) => {
        const now = new Date(), today = shanghaiStart(now.getTime());
        const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
        const start = new Date(today - (days - 1) * DAY), end = new Date(today + DAY);
        const team = all(req) && req.query.scope !== 'mine';
        const base = { archivedAt: null, ...(team ? {} : { ownerId: new Types.ObjectId(req.user.id) }) };
        const follow = { ...base, stage: { $nin: TERMINAL }, nextAt: { $ne: null, $lt: end } };
        const openLeads = { ...base, stage: { $in: ['new', 'working'] } };
        const period = { receivedAt: { $gte: start, $lt: end } };
        const [leads, opportunities, expected, pending, overdueLeads, overdueOpportunities, todayLeads, todayOpportunities, unassigned, grouped, metrics] = await Promise.all([
            Lead.find(follow).select('name stage qualification nextAt nextStep').sort('nextAt').limit(30).lean(),
            Opportunity.find(follow).select('name stage nextAt nextStep').sort('nextAt').limit(30).lean(),
            Opportunity.find({ ...base, stage: follow.stage, expectedAt: { $gte: now, $lte: new Date(now.getTime() + 30 * DAY) } })
                .select('name expectedAt expectedAmount').sort('expectedAt').limit(30).lean(),
            Lead.countDocuments({ ...openLeads, stage: 'new' }),
            Lead.countDocuments({ ...follow, nextAt: { $ne: null, $lt: now } }),
            Opportunity.countDocuments({ ...follow, nextAt: { $ne: null, $lt: now } }),
            Lead.countDocuments({ ...follow, nextAt: { $gte: new Date(today), $lt: end } }),
            Opportunity.countDocuments({ ...follow, nextAt: { $gte: new Date(today), $lt: end } }),
            team ? Lead.countDocuments({ ...openLeads, ownerId: null }) : null,
            Opportunity.aggregate([{ $match: base },
                { $group: { _id: '$stage', count: { $sum: 1 }, expected: { $sum: '$expectedAmount' }, actual: { $sum: '$actualAmount' } } }]),
            Lead.aggregate([{ $match: base }, { $facet: {
                grades: [{ $match: { stage: { $in: OPEN_LEAD_STAGES } } },
                    { $group: { _id: { $ifNull: ['$qualification', 'lead'] }, count: { $sum: 1 } } }],
                sources: [{ $match: period }, { $group: { _id: { $cond: [{ $eq: ['$source', 'legacy-whitepaper'] }, 'report', '$source'] },
                    count: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] } } } }, { $sort: { count: -1, _id: 1 } }],
                trend: [{ $match: period }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$receivedAt', timezone: 'Asia/Shanghai' } }, count: { $sum: 1 } } }]
            } }])
        ]);
        const { grades = [], sources = [], trend: daily = [] } = metrics[0] || {};
        const dates = new Map(daily.map(row => [row._id, row.count]));
        const trend = Array.from({ length: days }, (_, index) => {
            const date = dateKey(start.getTime() + index * DAY);
            return { date, count: dates.get(date) || 0 };
        });
        res.json({ leads, opportunities, expected, received: trend.at(-1).count, pending,
            overdue: overdueLeads + overdueOpportunities, todayFollow: todayLeads + todayOpportunities,
            unassigned, grouped, grades, sources, trend, days, scope: team ? 'team' : 'mine', end });
    }));
    const excel = multer({ storage: multer.memoryStorage(), limits: { fileSize: bulkImport.MAX_FILE, files: 1, fields: 4, fieldSize: 16384 } }).single('file');
    const uploadExcel = (req, res, next) => excel(req, res, err => next(err ? bad('请选择 512 KB 以内的 .xlsx 文件') : undefined));
    const importOptions = req => ({ actorId: req.user.id, canLink: row => canSee(req, row), secret: jwtSecret });
    router.get('/leads/import-template', requireCrm('crm:edit'), wrap(async (_req, res) => {
        res.attachment('crm-leads-template.xlsx').send(Buffer.from(await bulkImport.template()));
    }));
    router.post('/leads/import-preview', requireCrm('crm:edit'), uploadExcel, wrap(async (req, res) => {
        res.json(await bulkImport.preview(req.file?.buffer, req.body, importOptions(req)));
    }));
    router.post('/leads/import-confirm', requireCrm('crm:edit'), uploadExcel, wrap(async (req, res) => {
        const result = await bulkImport.confirm(req.file?.buffer, req.body, importOptions(req));
        if (result.imported) {
            await logOp('批量导入线索', 'CRM', `${result.label}，导入 ${result.imported} 条，跳过 ${result.skipped} 条，失败 ${result.failed} 条`, req.user.username);
        }
        res.json(result);
    }));
    router.get('/:kind/export', requireCrm('crm:export'), wrap(async (req, res) => {
        const { kind } = req.params;
        if (!Object.hasOwn(MODELS, kind)) throw bad('类型不支持', 404);
        const filter = filterFor(req, kind);
        const rows = await MODELS[kind].find(filter).sort({ updatedAt: -1 }).limit(10001).lean();
        if (rows.length > 10000) throw bad('请缩小筛选范围后导出，单次最多 10000 条');
        const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('CRM');
        const columns = {
            leads: { name: '姓名', companyName: '公司', companyAlias: '公司简称', phone: '电话', email: '邮箱', source: '来源', qualification: '线索等级', stage: '跟进状态', nextAt: '下次跟进' },
            contacts: { name: '姓名', phone: '电话', email: '邮箱', position: '职位', department: '部门' },
            companies: { name: '公司', alias: '简称', industry: '行业', region: '地区', website: '网站' },
            opportunities: { name: '商机', direction: '服务方向', stage: '阶段', expectedAmount: '预计金额', expectedAt: '预计成交', actualAmount: '实际金额' }
        }[kind];
        sheet.columns = Object.entries(columns).map(([key, header]) => ({ key, header, width: 24 }));
        rows.forEach(row => sheet.addRow(Object.fromEntries(Object.keys(columns).map(key => [key, key === 'qualification' ? (row[key] || 'lead').toUpperCase() : row[key] ?? '']))));
        await Activity.create({ entity: kind, kind: 'export', summary: '导出 ' + rows.length + ' 条', actorId: req.user.id, actor: req.user.username });
        res.attachment('crm-' + kind + '.xlsx').send(Buffer.from(await book.xlsx.writeBuffer()));
    }));
    router.get('/:kind', wrap(async (req, res) => {
        const { kind } = req.params;
        if (!Object.hasOwn(MODELS, kind)) throw bad('类型不支持', 404);
        const page = Math.min(1000, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
        const query = filterFor(req, kind);
        const [rows, total] = await Promise.all([
            MODELS[kind].find(query).select('-qualificationHistory -lastSkillActivityId').sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * 30).limit(30).lean(),
            MODELS[kind].countDocuments(query)
        ]);
        const companyIds = rows.map(row => row.companyId).filter(Boolean);
        const companies = await Company.find({ ...active(req), _id: { $in: companyIds } }).select('name').lean();
        const names = new Map(companies.map(company => [String(company._id), company.name]));
        rows.forEach(row => { row.company = names.get(String(row.companyId)) || row.companyName; });
        res.json({ rows, total, page });
    }));
    router.get('/:kind/:id', wrap(async (req, res) => {
        res.json(await details(req, req.params.kind, await record(req, req.params.kind, req.params.id)));
    }));
    router.post('/leads', requireCrm('crm:edit'), wrap(async (req, res) => {
        const body = req.body, data = leadValues(body);
        if (!data.name || (!data.phone && !data.email) || (body.phone && !data.phone) || (body.email && !data.email) || !MANUAL_SOURCES.includes(body.source)) {
            throw bad('请填写姓名、来源和有效手机号或邮箱');
        }
        if (typeof body.key !== 'string' || !UUID.test(body.key)) throw bad('录入编号无效');
        const change = qualificationChange(req, null, body);
        if (change) Object.assign(data, { qualification: change.to, qualificationHistory: [change] });
        const { companyId, contactId } = await links(req, body);
        const contact = contactId ? await record(req, 'contacts', contactId) : null;
        if (contact && !((data.phone && data.phone === contact.phoneKey) || (data.email && data.email === contact.emailKey))) throw bad('请核对所选联系人与联系方式');
        const lead = await ingest({ key: body.source, title: '人工录入', map: value => value },
            { ...data, _id: req.user.id + ':' + body.key, company: data.companyName, companyId },
            { manual: true, ownerId: req.user.id, contact, canLink: selected => canSee(req, selected) });
        if (!canSee(req, lead)) throw bad('该线索已转交其他负责人', 409);
        res.status(201).json({ row: lead });
    }));
    router.post('/:kind', requireCrm('crm:edit'), wrap(async (req, res) => {
        const { kind } = req.params;
        if (!Object.hasOwn(MODELS, kind) || kind === 'leads') throw bad('类型不支持', 404);
        const row = await MODELS[kind].create({ ...await entityValues(req, kind, req.body), ownerId: req.user.id });
        await note(req, kind, row, 'create', '新建记录');
        res.status(201).json({ row });
    }));
    router.put('/:kind/:id', requireCrm('crm:edit'), wrap(async (req, res) => {
        const { kind } = req.params, row = await record(req, kind, req.params.id);
        const data = kind === 'leads' ? leadValues(req.body) : await entityValues(req, kind, req.body, row);
        if (kind === 'leads') {
            if (!data.name || (req.body.phone && !data.phone) || (req.body.email && !data.email)) throw bad('请核对姓名和联系方式');
            if (req.body.contactId || req.body.companyId) {
                Object.assign(data, await links(req, req.body, row));
                if (data.contactId) data.matchIssue = '';
            }
        }
        if (['leads', 'opportunities'].includes(kind)) Object.assign(data, stages(row, kind, req.body));
        const previous = row.stage;
        const previousContact = row.contactId;
        row.set(data);
        await row.save();
        if (kind === 'leads' && row.contactId && !same(previousContact, row.contactId)) {
            await Event.updateMany({ leadId: row._id }, { contactId: row.contactId });
        }
        if (previous && previous !== row.stage) await note(req, kind, row, 'stage', previous + ' → ' + row.stage);
        res.json({ row });
    }));
    router.post('/:kind/:id/assign', requireCrm('crm:assign'), wrap(async (req, res) => {
        const { kind } = req.params, row = await record(req, kind, req.params.id);
        const ownerId = req.body.ownerId || null;
        const admin = id(ownerId) && await Admin.findById(ownerId).populate('roles').lean();
        const permissions = gatherPermissions(admin);
        if (ownerId && (!admin?.isActive || !['all', 'crm:view'].some(perm => permissions.has(perm)))) throw bad('请选择可访问 CRM 的负责人');
        row.ownerId = ownerId;
        await row.save();
        if (kind === 'leads' && ownerId) {
            if (row.contactId) await Contact.updateOne({ _id: row.contactId, ownerId: null, archivedAt: null }, { ownerId });
            if (row.companyId) await Company.updateOne({ _id: row.companyId, ownerId: null, archivedAt: null }, { ownerId });
        }
        await note(req, kind, row, 'assign', ownerId ? '分配给 ' + (admin.name || admin.username) : '取消分配');
        res.json({ row });
    }));
    router.post('/:kind/:id/follow-up', requireCrm('crm:edit'), wrap(async (req, res) => {
        const { kind } = req.params, row = await record(req, kind, req.params.id);
        const channel = text(req.body.channel), summary = text(req.body.summary, 2000);
        if (!CHANNELS.includes(channel) || !summary) throw bad('请选择沟通方式并填写结果');
        if (req.crmSkill) return res.json(await recordSkillFollowUp(req, row, channel, summary));
        const nextStep = text(req.body.nextStep, 500), nextAt = date(req.body.nextAt);
        if (['leads', 'opportunities'].includes(kind) && !TERMINAL.includes(row.stage)) {
            row.set({ nextAt, nextStep, ...(kind === 'leads' && row.stage === 'new' ? { stage: 'working' } : {}) });
            await row.save();
        }
        await Activity.create({ entity: kind, entityId: row._id, kind: channel, summary, nextAt, nextStep, actorId: req.user.id, actor: req.user.username });
        res.json({ row });
    }));
    router.post('/leads/:id/qualification', requireCrm('crm:edit'), wrap(async (req, res) => {
        const row = await record(req, 'leads', req.params.id);
        if (!OPEN_LEAD_STAGES.includes(row.stage)) throw bad('请先恢复线索跟进，已转商机的线索保留原等级');
        const change = qualificationChange(req, row, req.body);
        if (change) {
            row.qualification = change.to;
            if (change.nextStep) row.nextStep = change.nextStep;
            row.qualificationHistory.push(change);
            await row.save();
        }
        res.json({ row });
    }));
    router.post('/leads/:id/convert', requireCrm('crm:edit'), wrap(async (req, res) => {
        const lead = await record(req, 'leads', req.params.id);
        const existing = await Opportunity.findOne({ leadId: lead._id });
        if (existing && !canSee(req, existing)) throw bad('商机已由其他负责人管理', 409);
        if (!lead.opportunityId && !OPEN_LEAD_STAGES.includes(lead.stage)) throw bad('请先恢复线索跟进');
        if (!lead.opportunityId && lead.qualification !== 'sql') throw bad('请确认具体需求和下一步，将线索设为 SQL 后再转商机');
        const values = existing ? null : await entityValues(req, 'opportunities', req.body, lead);
        if (values && (!values.contactId || !values.nextStep)) throw bad('转为商机需关联关键联系人并填写下一步');
        const row = existing || await Opportunity.findOneAndUpdate({ leadId: lead._id }, {
            $setOnInsert: { ...values, leadId: lead._id, ownerId: lead.ownerId || req.user.id, stage: 'demand' }
        }, { upsert: true, new: true });
        const result = await Lead.updateOne({ _id: lead._id, ...active(req), opportunityId: null, qualification: 'sql', stage: { $in: OPEN_LEAD_STAGES } }, { stage: 'converted', opportunityId: row._id, nextAt: null });
        if (result.modifiedCount) await note(req, 'leads', lead, 'convert', '转为商机：' + row.name);
        if (!result.matchedCount && !await Lead.exists({ _id: lead._id, ...active(req), opportunityId: row._id })) {
            throw bad('线索归属或状态有变化，请刷新后核对', 409);
        }
        res.status(201).json({ row });
    }));
    router.post('/:kind/:id/archive', requireCrm('crm:edit'), wrap(async (req, res) => {
        const { kind } = req.params;
        if (!['companies', 'contacts'].includes(kind)) throw bad('该类型请使用阶段管理');
        const row = await record(req, kind, req.params.id);
        row.archivedAt = new Date();
        await row.save();
        await note(req, kind, row, 'archive', '归档');
        res.json({ ok: true });
    }));
    router.post('/:kind/:id/merge', requireCrm('crm:merge'), wrap(async (req, res) => {
        const { kind } = req.params;
        if (!all(req) || !['companies', 'contacts'].includes(kind)) throw bad('合并需要跨负责人管理权限', 403);
        if (same(req.params.id, req.body.targetId) || !id(req.body.targetId)) throw bad('请选择另一条保留记录');
        const token = randomUUID();
        const lockId = 'merge';
        await Sync.updateOne({ _id: lockId }, { $setOnInsert: { leaseUntil: new Date(0) } }, { upsert: true });
        if (!await Sync.findOneAndUpdate({ _id: lockId, leaseUntil: { $lte: new Date() } },
            { leaseUntil: new Date(Date.now() + 120000), leaseToken: token })) throw bad('当前有其他档案正在合并，请稍后重试', 409);
        try {
            const Model = MODELS[kind];
            const source = id(req.params.id) && await Model.findById(req.params.id);
            const target = await record(req, kind, req.body.targetId);
            if (!source || (source.archivedAt && !same(source.mergedInto, target._id))) throw bad('原记录无法合并');
            const field = kind === 'contacts' ? 'contactId' : 'companyId';
            const result = await Model.updateOne({ _id: source._id, $or: [{ archivedAt: null }, { mergedInto: target._id }] },
                { archivedAt: source.archivedAt || new Date(), mergedInto: target._id });
            if (!result.matchedCount) throw bad('原记录已被合并，请刷新', 409);
            await Promise.all([Model.updateMany({ mergedInto: source._id }, { mergedInto: target._id }), Lead.updateMany({ [field]: source._id }, { [field]: target._id }), Opportunity.updateMany({ [field]: source._id }, { [field]: target._id }),
                kind === 'contacts' ? Event.updateMany({ contactId: source._id }, { contactId: target._id }) : Contact.updateMany({ companyId: source._id }, { companyId: target._id }),
                Activity.updateMany({ entity: kind, entityId: source._id }, { entityId: target._id })]);
            await note(req, kind, target, 'merge', '合并 ' + source.name + ' 到当前档案');
            res.json({ row: target });
        } finally {
            await Sync.updateOne({ _id: lockId, leaseToken: token }, { leaseUntil: new Date(0) });
        }
    }));
    router.post('/contacts/:id/marketing', requireCrm('nqoc-report-leads:batch-send'), wrap(async (req, res) => {
        const contact = await record(req, 'contacts', req.params.id);
        const basis = text(req.body.basis, 300);
        if (!contact.email || !basis || req.body.confirmed !== true) throw bad('请填写报告发放依据并确认，联系人需有邮箱');
        const importKey = 'crm:' + req.user.id;
        const row = await MailContact.findOneAndUpdate({ importKey, sourceId: String(contact._id) }, { $setOnInsert: {
            importKey, sourceId: String(contact._id), email: contact.email, name: contact.name, sourceLabel: 'CRM 联系人',
            basis, createdBy: req.user.username || req.user.id
        } }, { new: true, upsert: true });
        if (row.email !== contact.email) throw bad('该联系人已加入旧邮箱名单，请在邮件营销中核对');
        res.status(201).json({ ok: true });
    }));
    router.use((error, _req, res, _next) => {
        if (error.name === 'VersionError') return res.status(409).json({ error: '记录已被更新，请刷新再试' });
        if (error.code === 11000) return res.status(409).json({ error: '已有相同公司或联系方式，请先查找并关联已有档案' });
        if (!error.status) console.error('[CRM API]', error.code || error.name);
        return res.status(error.status || 500).json({ error: error.status ? error.message : 'CRM 请求失败，请稍后重试' });
    });
    return router;
}
module.exports = init;
