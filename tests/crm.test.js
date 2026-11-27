const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
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

describe('CRM normalization', () => {
    it('normalizes country code and spacing without guessing different company names', () => {
        assert.equal(phoneKey('+86 138-0000-0000'), '13800000000');
        assert.equal(phoneKey('123'), '');
        assert.equal(companyKey(' ＡＢＣ  人力 '), 'abc人力');
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
        app.use(prefix, crm(createAuthMiddleware(key).authRequired));
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
        const deal = { name: '组织诊断', contactId: lead.contactId, companyId: lead.companyId, expectedAmount: 1000 };
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
});
