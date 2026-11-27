const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const XLSX = require('xlsx');
const Contact = require('../models/ReportMailContact');
const Template = require('../models/ReportMailTemplate');
const Lead = require('../models/NqocReportLead');
const { readContacts } = require('../utils/reportMailImport');
const { templateFields, renderTemplate } = require('../utils/reportMailTemplate');
const { createQuota, dayWindow } = require('../utils/reportMailQuota');
const { previewBatch, submitBatch } = require('../utils/reportDeliveryBatch');

const draft = {
    name: '活动版', subject: '{{姓名}}，您的{{报告名称}}', button: '下载',
    body: '{{活动名称}}\n{{下载链接}}\n有效期 {{有效期}}', signature: '瑞华智策',
    replyTo: 'reports@example.test'
};
function workbook(rows) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), '名单');
    return XLSX.write(book, { bookType: 'xlsx', type: 'buffer', compression: true });
}
describe('Report campaign templates and imports', function () {
    it('validates spreadsheet addresses, accepts .xlsx, and rejects oversized rosters', function () {
        const rows = readContacts(workbook([['姓名', '邮箱'], ['张三', 'User@example.test'], ['重复', 'user@example.test'], ['无效', 'a,b@example.test']]));
        assert.deepEqual(rows.map(row => row.error), ['', '文件中邮箱重复', '邮箱格式不正确']);
        assert.equal(rows[0].email, 'user@example.test');
        assert.throws(() => readContacts(workbook([['email'], ...Array.from({ length: 501 }, (_, n) => [n + '@example.test'])])), /500/);
        assert.throws(() => readContacts(Buffer.alloc(64)), /xlsx/);
    });
    it('renders only declared variables and escapes HTML and button attributes', function () {
        const output = renderTemplate(templateFields(draft), { name: '<张三>', sourceLabel: '<活动>' }, '报告', 'https://example.test/?a=1&b=2');
        assert.equal(output.subject, '<张三>，您的报告');
        assert.match(output.html, /&lt;活动&gt;/);
        assert.match(output.html, /a=1&amp;b=2/);
        assert.equal(output.replyTo, 'reports@example.test');
        assert.throws(() => templateFields({ ...draft, body: '{{不存在}} {{下载链接}}' }), /变量/);
        assert.throws(() => templateFields({ ...draft, subject: '{{下载链接}}' }), /下载链接/);
    });
    it('resets daily quotas at midnight in Shanghai', function () {
        assert.equal(dayWindow(Date.parse('2026-11-25T15:59:59Z')).toISOString(), '2026-11-25T16:00:00.000Z');
        assert.equal(dayWindow(Date.parse('2026-11-25T16:00:00Z')).toISOString(), '2026-11-26T16:00:00.000Z');
    });
});

const uri = process.env.REPORT_MAIL_TEST_MONGO;
(uri ? describe : describe.skip)('Report campaign integration', function () {
    this.timeout(15000);
    let app;
    before(async function () {
        assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:37019\/ruihua_mail_test_[a-z0-9_]+$/);
        await mongoose.connect(uri + '_campaign');
        await Promise.all([Contact.init(), Template.init(), Lead.init(), require('../models/ReportDelivery').init()]);
        app = express();
        app.use(express.json());
        const auth = (req, res, next) => {
            if (!req.get('x-operator')) return res.sendStatus(401);
            req.user = { id: 'operator', username: 'operator' };
            next();
        };
        const permission = code => (req, res, next) => req.get('x-scope') === 'limited' && code !== 'nqoc-report-leads:batch-send' ? res.sendStatus(403) : next();
        const any = codes => permission(codes[0]);
        app.use(require('../routes/api/reportMailCampaign')(auth, permission, any, (_req, _res, next) => next()));
    });
    after(async function () {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.dropDatabase();
            await mongoose.disconnect();
        }
    });
    const authorized = (method, path) => request(app)[method](path).set('x-operator', 'operator');

    it('rejects unauthorized template changes and source access, preserves sending basis and sends nothing on import', async function () {
        assert.equal((await request(app).get('/report-mail/templates')).status, 401);
        assert.equal((await authorized('post', '/report-mail/templates').set('x-scope', 'limited').send(draft)).status, 403);
        assert.equal((await authorized('get', '/report-mail/source/appointment').set('x-scope', 'limited')).status, 403);
        const file = workbook([['姓名', '邮箱'], ['活动访客', 'visitor@example.test']]);
        const imported = () => authorized('post', '/report-mail/import')
            .field('confirmed', 'true').field('basis', '会后提供报告').field('label', '论坛')
            .field('requestKey', 'test-campaign-import-key').attach('file', file, 'contacts.xlsx');
        const first = await imported(); const replay = await imported();
        assert.equal(first.status, 201, JSON.stringify(first.body));
        assert.equal(replay.body.rows[0].id, first.body.rows[0].id);
        const contact = await Contact.findById(first.body.rows[0].id.slice(8));
        assert.equal(contact.basis, '会后提供报告');
        assert.equal(contact.mail, undefined);
    });

    it('locks the published template, seals the confirmation and deduplicates mixed sources', async function () {
        const saved = await authorized('post', '/report-mail/templates').send(draft);
        assert.equal(saved.status, 201);
        const id = saved.body._id;
        assert.equal((await authorized('post', '/report-mail/templates/' + id + '/publish').send({})).status, 200);
        assert.equal((await authorized('put', '/report-mail/templates/' + id).send(draft)).status, 400);
        const imported = await Contact.findOne({ email: 'visitor@example.test' });
        const online = await Lead.create({ name: '线上访客', email: imported.email, phone: 'test-only', company: '测试', position: '测试',
            reportSlug: require('../utils/reportMail').REPORT_SLUG });
        const preview = await previewBatch(['contact-' + imported.id, online.id], 'operator', 'operator', id);
        assert.equal(preview.eligibleCount, 1);
        assert.equal(preview.excludedCount, 1);
        assert.ok(preview.sample.subject.startsWith(imported.name + '，您的'));
        assert.equal(preview.sample.button, draft.button);
        assert.match(preview.sample.text, /发送时生成的专属报告链接/);
        assert.doesNotMatch(preview.sample.text, /https?:/);
        const body = { previewToken: preview.previewToken, reason: '报告交付', acknowledged: true };
        await assert.rejects(submitBatch({ ...body, requestKey: 'wrong-request-key-123' }, 'operator', 'operator'), /编号/);
        await authorized('post', '/report-mail/templates/' + id + '/archive').send({});
        const result = await submitBatch({ ...body, requestKey: preview.requestKey }, 'operator', 'operator');
        assert.equal(result.queuedCount, 1);
        const contact = await Contact.findById(imported.id);
        assert.equal(contact.mail.template.version, id);
        assert.equal(contact.mail.template.subject, draft.subject);
    });

    it('sends a staged custom template through the shared limiter and honors an SMTP pause', async function () {
        const quota = createQuota(mongoose.connection, 'worker@example.test');
        const mailer = require('../utils/reportMail');
        const contact = await Contact.findOne({ email: 'visitor@example.test' });
        const auto = await Lead.findOne({ email: 'visitor@example.test' });
        await Lead.updateOne({ _id: auto.id }, { mail: mailer.pendingReportMail(mailer.REPORT_SLUG, { recipient: auto.email }) });
        const sends = [];
        const worker = mailer.createReportMailer({ models: [Lead, Contact], secret: 'test-key', quota, transport: {
            async sendMail(message) {
                sends.push(message);
                if (sends.length === 1) throw Object.assign(new Error('temporary SMTP restriction'), { responseCode: 421 });
                return { accepted: [message.to], messageId: 'campaign-test' };
            }, close() {}
        } });
        try {
            await worker.tick();
            assert.equal(sends.length, 1);
            assert.match(sends[0].subject, /已准备好/);
            assert.ok((await quota.summary()).pausedUntil > new Date());
            await worker.tick();
            assert.equal(sends.length, 1);
            await mongoose.connection.collection('report_mail_quotas').updateMany({}, { $unset: { pausedUntil: 1 } });
            await worker.tick();
            assert.equal(sends.length, 2);
            assert.match(sends[1].subject, /活动访客/);
            assert.match(sends[1].text, new RegExp('/report-deliveries/' + contact.mail.jobId + '/download'));
            assert.equal((await Contact.findById(contact.id)).mail.status, 'accepted');
        } finally { worker.stop(); }
    });

    it('uses a single account lease across workers and reserves daily capacity for new applications', async function () {
        const quotaA = createQuota(mongoose.connection, 'sender@example.test');
        const quotaB = createQuota(mongoose.connection, 'SENDER@example.test');
        const old = process.env.REPORT_SMTP_PER_DAY;
        process.env.REPORT_SMTP_PER_DAY = '2';
        try {
            const now = Date.now();
            const acquired = (await Promise.all([quotaA.acquire(now, false), quotaB.acquire(now, false)])).filter(result => result.lease);
            assert.equal(acquired.length, 1);
            await quotaA.release(acquired[0].lease);
            assert.ok((await quotaB.acquire(now, false)).waitUntil);
            const auto = await quotaB.acquire(now, true);
            assert.ok(auto.lease);
            await quotaB.release(auto.lease, 10000);
            assert.ok((await quotaA.acquire(now, true)).waitUntil);
            assert.equal((await quotaA.summary()).remainingToday, 0);
        } finally {
            if (old === undefined) delete process.env.REPORT_SMTP_PER_DAY;
            else process.env.REPORT_SMTP_PER_DAY = old;
        }
    });
});
