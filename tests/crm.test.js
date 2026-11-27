const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const XLSX = require('xlsx');
const Admin = require('../models/admin');
const Role = require('../models/Role');
const Appointment = require('../models/Appointment');
const Report = require('../models/NqocReportLead');
const LegacyReport = require('../models/NqocWhitepaperRequest');
const MailContact = require('../models/ReportMailContact');
const { Lead, Contact, Company, Event, Opportunity, Activity } = require('../models/crm');
const { syncOnce, phoneKey, companyKey } = require('../utils/crmIntake');
const { createAuthMiddleware } = require('../middleware/auth');
const crm = require('../routes/api/crm');
const { readLeads } = require('../utils/crmLeadImport');

function workbook(rows) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), '线索');
    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

describe('CRM normalization', () => {
    it('normalizes country code and spacing without guessing different company names', () => {
        assert.equal(phoneKey('+86 138-0000-0000'), '13800000000');
        assert.equal(phoneKey('123'), '');
        assert.equal(companyKey(' ＡＢＣ  人力 '), 'abc人力');
    });
    it('bounds Excel rows, rejects formulas and retains physical row numbers', () => {
        const parsed = readLeads(workbook([
            ['姓名', '邮箱', '下次跟进时间'], [], ['样例', 'first@example.test', '2026-12-01 14:30'],
            [{ f: '1+1', t: 'n', v: 2 }, 'formula@example.test'], ['无效时间', 'date@example.test', '2026-02-31 10:00']
        ]));
        assert.deepEqual(parsed.map(row => row.line), [3, 4, 5]);
        assert.equal(parsed[0].data.nextAt.toISOString(), '2026-12-01T06:30:00.000Z');
        assert.match(parsed[1].issue, /公式/);
        assert.match(parsed[2].issue, /无效/);
        assert.throws(() => readLeads(workbook([['姓名', '邮箱'], ...Array.from({ length: 501 }, () => ['A', 'a@example.test'])])), /500 行/);
    });
});

const uri = process.env.CRM_TEST_MONGO;
(uri ? describe : describe.skip)('CRM authenticated workflows', function () {
    this.timeout(15000);
    let app, admin, owner, outsider;
    const key = 'isolated-crm-test-only';
    const prefix = '/api/admin/crm';
    async function actor(username, permissions) {
        const role = await Role.create({ name: username, code: username, permissions });
        const user = await Admin.create({ username, password: 'test-only', roles: [role._id] });
        return { id: user.id, token: jwt.sign({ id: user.id, username }, key) };
    }
    before(async function () {
        assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:37029\/ruihua_crm_test_[a-z0-9_]+$/);
        await mongoose.connect(uri);
        await Promise.all([Lead.init(), Contact.init(), Company.init(), Event.init(), Opportunity.init(), MailContact.init()]);
        admin = await actor('manager', ['all']);
        owner = await actor('sales', ['crm:view', 'crm:edit']);
        outsider = await actor('other', ['crm:view']);
        app = express();
        app.use(express.json());
        app.use(prefix, crm(createAuthMiddleware(key).authRequired, key));
    });
    after(async function () {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.dropDatabase();
            await mongoose.disconnect();
        }
    });
    const call = (method, path, who = admin) => request(app)[method](prefix + path).set('Authorization', 'Bearer ' + who.token);
    const contactData = { name: '测试联系人', phone: '13800000001', company: '测试企业', email: 'crm@example.test' };

    it('backfills once, attaches new submissions, and counts site opens without assuming mail clicks', async function () {
        const input = { ...contactData, position: 'HR', reportSlug: 'report-A', reportTitle: '示例报告', reportOpenCount: 1 };
        await Report.create(input);
        await Report.create(input);
        const [a, b] = await Promise.all([syncOnce(), syncOnce()]);
        assert.equal(a + b, 2);
        assert.equal(await syncOnce(), 0);
        assert.equal(await Contact.countDocuments(), 1);
        assert.equal(await Lead.countDocuments(), 1);
        assert.equal(await Event.countDocuments(), 2);
        await Appointment.create({ ...contactData, problem: '预约咨询' });
        assert.equal(await syncOnce(), 1);
        assert.equal(await Lead.countDocuments(), 2);
        const appointment = await Lead.findOne({ source: 'appointment' });
        assert.equal(appointment.qualification, 'mql');
        assert.equal(appointment.qualificationHistory[0].actor, '系统');
        assert.equal((await Lead.findOne({ source: 'report' })).qualification, 'lead');
        const contact = await Contact.findOne();
        const result = await call('get', '/contacts/' + contact.id);
        assert.equal(result.status, 200);
        assert.equal(result.body.events.length, 3);
        assert.equal(result.body.events.some(event => event.report?.opens === 1), true);
        assert.equal((await call('get', '/contacts/' + contact.id, outsider)).status, 404);
    });
    it('includes historical whitepaper applications in the report source filter and totals', async function () {
        await LegacyReport.create({ ...contactData, position: 'HR' });
        assert.equal(await syncOnce(), 1);
        const allReports = await call('get', '/leads?source=report');
        assert.equal(allReports.status, 200);
        assert.equal(allReports.body.total, 2);
        assert.deepEqual(allReports.body.rows.map(row => row.source).sort(), ['legacy-whitepaper', 'report']);
        assert.equal((await call('get', '/leads?source=legacy-whitepaper')).body.total, 1);
        const sourceTotals = (await call('get', '/dashboard')).body.sources;
        assert.equal(sourceTotals.find(row => row._id === 'report').count, 2);
        assert.equal(sourceTotals.some(row => row._id === 'legacy-whitepaper'), false);
    });
    it('routes conflicting identities to manual review without silently merging', async function () {
        await Contact.create({ name: '另一位联系人', email: 'different@example.test', emailKey: 'different@example.test' });
        await Appointment.create({ ...contactData, email: 'different@example.test' });
        assert.equal(await syncOnce(), 1);
        const lead = await Lead.findOne({ email: 'different@example.test' });
        assert.match(lead.matchIssue, /不同联系人/);
        assert.equal(lead.contactId, undefined);
        assert.equal(await Contact.countDocuments(), 2);
    });
    it('allows manual entry, assignment, follow-up, idempotent conversion and a win', async function () {
        const payload = { ...contactData, companyName: contactData.company, source: 'event', key: randomUUID() };
        const created = await call('post', '/leads').send(payload);
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const lead = created.body.row;
        assert.equal((await call('post', '/leads').send(payload)).body.row._id, lead._id);
        assert.equal((await call('post', '/leads/' + lead._id + '/assign', outsider).send({ ownerId: owner.id })).status, 403);
        assert.equal((await call('post', '/leads/' + lead._id + '/assign').send({ ownerId: owner.id })).status, 200);
        const nextAt = new Date(Date.now() - 60000).toISOString();
        assert.equal((await call('post', '/leads/' + lead._id + '/follow-up', owner).send({ channel: 'phone', summary: '对方提出组织诊断需求', nextAt })).status, 200);
        assert.equal((await call('get', '/dashboard', owner)).body.overdue, 1);
        const deal = { name: '组织诊断', contactId: lead.contactId, companyId: lead.companyId, expectedAmount: 1000, nextStep: '预约需求会' };
        const qualify = '/leads/' + lead._id + '/qualification';
        assert.equal((await call('post', '/leads/' + lead._id + '/convert', owner).send(deal)).status, 400);
        assert.equal((await call('post', qualify, owner).send({ qualification: 'sql', reason: '已有明确需求' })).status, 400);
        assert.equal((await call('post', qualify, owner).send({ qualification: 'sql', reason: '已有明确需求', nextStep: '预约需求会' })).status, 200);
        assert.equal((await call('get', '/leads?qualification=sql', owner)).body.total, 1);
        const qualified = (await call('get', '/leads/' + lead._id, owner)).body;
        assert.equal(qualified.qualificationHistory[0].from, 'lead');
        assert.equal(qualified.qualificationHistory[0].actor, 'sales');
        assert.equal(qualified.row.stage, 'working');
        const response = await call('post', '/leads/' + lead._id + '/convert', owner).send(deal);
        assert.equal(response.status, 201, JSON.stringify(response.body));
        const dealId = response.body.row._id;
        assert.equal((await call('post', '/leads/' + lead._id + '/convert', owner).send(deal)).body.row._id, dealId);
        assert.equal((await call('put', '/opportunities/' + dealId, owner).send({ ...deal, stage: 'won' })).status, 400);
        assert.equal((await call('put', '/opportunities/' + dealId, owner).send({ ...deal, stage: 'won', actualAmount: 900, wonAt: '2026-11-27' })).status, 200);
        assert.equal((await call('get', '/opportunities/' + dealId, outsider)).status, 404);
        assert.equal((await call('get', '/dashboard', owner)).body.grouped.find(row => row._id === 'won').actual, 900);
        assert.ok(await Activity.exists({ entityId: lead._id, kind: 'convert' }));
        const another = await call('post', '/opportunities', owner).send({ ...deal, name: '培训' });
        assert.equal(another.status, 201);
        assert.equal((await call('put', '/opportunities/' + another.body.row._id, owner).send({ ...deal, name: '培训', stage: 'lost' })).status, 400);
        assert.equal((await call('put', '/opportunities/' + another.body.row._id, owner).send({ ...deal, name: '培训', stage: 'lost', lossReason: '预算延后' })).status, 200);
    });
    it('counts legacy grades and isolates dashboard scopes and date ranges', async function () {
        const old = await Lead.create({ name: '过去的线索', source: 'manual', ownerId: owner.id, receivedAt: new Date(Date.now() - 14 * 86400000) });
        await Lead.collection.updateOne({ _id: old._id }, { $unset: { qualification: 1 } });
        const nurture = await call('put', '/leads/' + old.id, owner).send({ name: old.name, stage: 'nurture', closeReason: '下季度跟进' });
        assert.equal(nurture.status, 200);
        assert.equal((await call('get', '/leads?qualification=lead&stage=nurture', owner)).body.total, 1);
        const week = (await call('get', '/dashboard?days=7', owner)).body;
        const month = (await call('get', '/dashboard?days=30', owner)).body;
        const myTeamView = (await call('get', '/dashboard?days=7&scope=mine')).body;
        assert.equal(week.trend.length, 7);
        assert.equal(month.trend.length, 30);
        assert.equal(month.trend.reduce((sum, item) => sum + item.count, 0), week.trend.reduce((sum, item) => sum + item.count, 0) + 1);
        assert.ok(month.grades.some(grade => grade._id === 'lead'));
        assert.equal(week.scope, 'mine');
        assert.equal(myTeamView.scope, 'mine');
        assert.equal(myTeamView.unassigned, null);
        assert.equal((await call('get', '/dashboard?scope=team')).body.scope, 'team');
        assert.equal((await call('get', '/leads?receivedDays=7&stage=nurture', owner)).body.total, 0);
    });
    it('merges archives and stages report mail only after confirmation', async function () {
        const source = await Company.create({ name: '旧名称', nameKey: '旧名称' });
        const target = await Company.findOne({ name: contactData.company });
        assert.equal((await call('post', '/companies/' + source.id + '/merge').send({ targetId: target.id })).status, 200);
        assert.equal((await Company.findById(source.id)).mergedInto.toString(), target.id);
        const person = await Contact.findOne({ email: contactData.email });
        const path = '/contacts/' + person.id + '/marketing';
        assert.equal((await call('post', path).send({ basis: '申请报告' })).status, 400);
        assert.equal((await call('post', path).send({ basis: '申请报告', confirmed: true })).status, 201);
        const entry = await MailContact.findOne({ email: person.email });
        assert.equal(entry.mail, undefined);
        const exported = await call('get', '/leads/export');
        assert.equal(exported.status, 200);
        assert.match(exported.headers['content-disposition'], /crm-leads.xlsx/);
        assert.equal((await call('get', '/leads/export', owner)).status, 403);
    });
    it('previews and safely replays a batch, skipping duplicate, conflicting, and invalid rows', async function () {
        const label = 'CRM批量导入测试';
        const headers = ['姓名', '手机号', '邮箱', '公司', '职位', '部门', '需求摘要', '标签', '下一步', '下次跟进时间'];
        const existing = [contactData.name, contactData.phone, contactData.email, contactData.company];
        const valid = ['新增客户', '13800000022', 'new-bulk@example.test', '测试企业', '总监', '人力', '有培训需求', '活动,培训', '发方案', '2026-12-01 14:30'];
        const duplicate = ['重复记录', '', 'new-bulk@example.test'];
        const invalid = ['无联系方式'];
        const conflict = ['两人联系方式', contactData.phone, 'different@example.test'];
        const file = workbook([headers, existing, valid, duplicate, invalid, conflict]);
        const corrected = workbook([headers, existing, valid, ['修正联系方式', '13800000023']]);
        const post = (action, xlsx = file, token = '', who = admin, batch = label) => {
            const req = call('post', '/leads/import-' + action, who).field('source', 'event').field('label', batch);
            if (token) req.field('previewToken', token);
            return req.attach('file', xlsx, 'test.xlsx');
        };
        assert.equal((await call('get', '/leads/import-template')).status, 200);
        assert.equal((await post('preview', file, '', outsider)).status, 403);
        const before = await Lead.countDocuments();
        const preview = await post('preview');
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        assert.equal(preview.body.ready, 2);
        assert.deepEqual(preview.body.rows.map(row => row.status), ['linked', 'new', 'skipped', 'skipped', 'skipped']);
        assert.equal(await Lead.countDocuments(), before);
        const token = preview.body.token;
        assert.equal((await post('confirm', corrected, token)).status, 400);
        assert.equal((await post('confirm', file, token, admin, '另一个批次')).status, 400);
        assert.equal((await post('confirm', file, token, owner)).status, 400);
        const result = await post('confirm', file, token);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.imported, 2);
        assert.equal(result.body.skipped, 3);
        const added = await Lead.findOne({ email: valid[2] });
        assert.equal(added.ownerId.toString(), admin.id);
        assert.equal(added.nextAt.toISOString(), '2026-12-01T06:30:00.000Z');
        assert.deepEqual(added.tags, ['活动', '培训']);
        assert.ok(await Event.exists({ leadId: added.id, title: 'Excel 导入 · ' + label }));
        const replay = await post('confirm', file, token);
        assert.equal(replay.body.imported, 0);
        assert.equal(await Lead.countDocuments(), before + 2);
        const correctedPreview = await post('preview', corrected);
        assert.deepEqual(correctedPreview.body.rows.map(row => row.status), ['already', 'already', 'new']);
        assert.equal((await post('confirm', corrected, correctedPreview.body.token)).body.imported, 1);
        assert.equal(await Lead.countDocuments(), before + 3);
    });
});
