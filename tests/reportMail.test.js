const assert = require('assert');
const mongoose = require('mongoose');
const { pendingReportMail, messageFor, failureState, createReportMailer, reportMailAllowed, verifyOpenToken, REPORT_SLUG } = require('../utils/reportMail');

describe('Report email content and failures', function () {
    it('builds a trackable seven-day link without exposing SMTP credentials', function () {
        const before = Date.now();
        const leadId = '64f000000000000000000001';
        const mail = messageFor({ _id: leadId, email: 'recipient@example.test' }, 'test-key');
        // 邮件链接先落到打开追踪页，再 302 到签名 PDF；令牌里带记录 id 与有效期
        const link = mail.text.match(/https:\/\/www\.ruihuaconsulting\.com\/nqoc\/reports\/open\?t=[^\s]+/)[0];
        const url = new URL(link);
        const data = verifyOpenToken('test-key', url.searchParams.get('t'));
        assert.ok(data, '追踪令牌应可用同一密钥校验');
        assert.strictEqual(data.i, leadId);
        const exp = Number(data.e);
        assert.ok(exp >= before + 7 * 86400000 && exp <= Date.now() + 7 * 86400000);
        assert.strictEqual(mail.to, 'recipient@example.test');
        assert.ok(mail.html.includes('查看 / 下载报告'));
        assert.ok(!`${mail.text}${mail.html}`.includes('test-key'));
    });
    it('does not enqueue unsupported reports', function () { assert.strictEqual(pendingReportMail('other'), undefined); });
    it('retries transient failures but distinguishes permanent and ambiguous SMTP failures', function () {
        assert.strictEqual(failureState({ responseCode: 451 }, 1), 'pending');
        assert.strictEqual(failureState({ responseCode: 550 }, 1), 'failed');
        assert.strictEqual(failureState({ code: 'EAUTH' }, 1), 'failed');
        assert.strictEqual(failureState({ code: 'EDNS' }, 1), 'pending');
        assert.strictEqual(failureState({ code: 'ECONNECTION', command: 'CONN' }, 1), 'uncertain');
        assert.strictEqual(failureState({ code: 'ECONNECTION' }, 3), 'failed');
        assert.strictEqual(failureState({ command: 'DATA', code: 'ETIMEDOUT' }, 1), 'uncertain');
    });
});

const uri = process.env.REPORT_MAIL_TEST_MONGO;
(uri ? describe : describe.skip)('Report email durable queue (isolated MongoDB)', function () {
    this.timeout(10000);
    let conn, Model, Other;
    const workers = [];
    before(async function () {
        assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:37019\/ruihua_mail_test_[a-z0-9_]+$/);
        conn = await mongoose.createConnection(uri).asPromise();
        Model = conn.model('NqocReportLead', require('../models/NqocReportLead').schema.clone());
        Other = conn.model('NqocWhitepaperRequest', require('../models/NqocWhitepaperRequest').schema.clone());
        await Promise.all([Model.init(), Other.init()]);
    });
    beforeEach(async function () { await Promise.all([Model.deleteMany({}), Other.deleteMany({})]); });
    afterEach(function () { for (const worker of workers.splice(0)) worker.stop(); });
    after(async function () { if (conn) { await conn.dropDatabase(); await conn.close(); } });
    const input = () => ({ name: 'Test', phone: 'test-only', company: 'Test', position: 'Test', reportSlug: REPORT_SLUG, email: 'recipient@example.test', mail: pendingReportMail() });
    function worker(transport) {
        const w = createReportMailer({ models: [Model, Other], secret: 'test-key', transport: { close() {}, ...transport } });
        workers.push(w); return w;
    }
    it('two workers atomically claim one task and send it once', async function () {
        await Model.create(input());
        let sends = 0;
        const transport = { async sendMail() { sends++; await new Promise(r => setTimeout(r, 30)); return { accepted: ['recipient@example.test'], messageId: 'test-message' }; } };
        await Promise.all([worker(transport).tick(), worker(transport).tick()]);
        assert.strictEqual(sends, 1);
        const lead = await Model.findOne();
        assert.strictEqual(lead.mail.status, 'accepted');
        assert.strictEqual(lead.mail.messageId, 'test-message');
        assert.strictEqual(lead.mail.attempts, 1);
        assert.ok(lead.mail.linkExpiresAt > new Date());
    });
    it('a new worker resumes a persisted pending task after restart; historical records stay untouched', async function () {
        const historical = input(); delete historical.mail;
        await Model.create(historical); await Other.create(input());
        let sends = 0;
        await worker({ async sendMail() { sends++; return { accepted: ['recipient@example.test'] }; } }).tick();
        assert.strictEqual(sends, 1);
        assert.strictEqual((await Model.findOne()).mail, undefined);
        assert.strictEqual((await Other.findOne()).mail.status, 'accepted');
    });
    it('reschedules a known temporary SMTP rejection without immediate duplicate sends', async function () {
        await Model.create(input());
        let sends = 0;
        const w = worker({ async sendMail() { sends++; throw Object.assign(new Error('temporary'), { responseCode: 451 }); } });
        await w.tick(); await w.tick();
        const lead = await Model.findOne();
        assert.strictEqual(sends, 1); assert.strictEqual(lead.mail.status, 'pending');
        assert.ok(lead.mail.nextAttemptAt > new Date());
    });
    it('does not automatically resend a task with an expired delivery lock', async function () {
        const lead = input(); lead.mail.status = 'sending'; lead.mail.lockedAt = new Date(Date.now() - 240000);
        await Model.create(lead);
        let sends = 0;
        await worker({ async sendMail() { sends++; } }).tick();
        assert.strictEqual(sends, 0); assert.strictEqual((await Model.findOne()).mail.status, 'uncertain');
    });
    it('enforces the per-recipient daily limit across both sources', async function () {
        await Model.create(input()); await Other.create([input(), input()]);
        assert.strictEqual(await reportMailAllowed('recipient@example.test', [Model, Other]), false);
        assert.strictEqual(await reportMailAllowed('another@example.test', [Model, Other]), true);
    });
    it('stores both lead and pending mail in the same insert', async function () {
        const lead = await Model.create(input());
        const raw = await Model.collection.findOne({ _id: lead._id });
        assert.strictEqual(raw.mail.status, 'pending'); assert.strictEqual(raw.mail.reportSlug, REPORT_SLUG);
    });
});
