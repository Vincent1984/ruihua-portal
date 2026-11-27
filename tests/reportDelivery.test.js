const assert = require('assert');
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const Lead = require('../models/NqocReportLead');
const Legacy = require('../models/NqocWhitepaperRequest');
const { Delivery, queueManual, historyFor, migrateHistory } = require('../utils/reportDelivery');
const { pendingReportMail, createReportMailer, REPORT_SLUG, deliveryLink } = require('../utils/reportMail');
const { Batch, previewBatch, submitBatch, batchResult } = require('../utils/reportDeliveryBatch');
const uri = process.env.REPORT_MAIL_TEST_MONGO;
(uri ? describe : describe.skip)('Report delivery history and APIs (isolated MongoDB)', function () {
    this.timeout(15000);
    let app, oldEnv;
    before(async function () {
        assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:37019\/ruihua_mail_test_[a-z0-9_]+$/);
        await mongoose.connect(uri + '_delivery');
        await Promise.all([Lead.init(), Legacy.init(), Delivery.init(), Batch.init()]);
        oldEnv = { enabled: process.env.REPORT_MAIL_ENABLED, pass: process.env.SMTP_PASS, key: process.env.JWT_SECRET };
        process.env.REPORT_MAIL_ENABLED = 'true'; process.env.SMTP_PASS = 'test-only'; process.env.JWT_SECRET = 'test-key';
        const auth = (req, res, next) => { if (!req.get('x-test-user')) return res.sendStatus(401); req.user = { username: req.get('x-test-user') }; next(); };
        const permission = code => (req, res, next) => (req.get('x-test-permissions') || '').split(',').includes(code) ? next() : res.sendStatus(403);
        const any = codes => (req, res, next) => codes.some(c => (req.get('x-test-permissions') || '').split(',').includes(c)) ? next() : res.sendStatus(403);
        app = express(); app.use(express.json()); app.use('/api', require('../routes/api/nqoc')(auth, permission, any));
    });
    beforeEach(async function () { await Promise.all([Lead.deleteMany({}), Legacy.deleteMany({}), Delivery.deleteMany({}), Batch.deleteMany({})]); });
    after(async function () {
        for (const [key, value] of Object.entries({ REPORT_MAIL_ENABLED: oldEnv?.enabled, SMTP_PASS: oldEnv?.pass, JWT_SECRET: oldEnv?.key })) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        await mongoose.connection.dropDatabase(); await mongoose.disconnect();
    });
    const input = extra => ({ name: 'Test', email: 'recipient@example.test', phone: 'test-only', company: 'Test', position: 'Test', reportSlug: REPORT_SLUG, ...extra });
    const command = (key = 'request_history_0001') => ({ requestKey: key, expectedEmail: 'recipient@example.test', reportSlug: REPORT_SLUG, reportVersion: '2026-11-20', requestedBy: 'operator', reason: '' });
    const perms = 'nqoc-report-leads:send,nqoc-report-leads:resend,nqoc-report-leads:list,nqoc-report-leads:delete,nqoc-report-leads:restore,nqoc-report-leads:batch-send';
    const send = (method, url, body, allowed = perms) => request(app)[method](url).set('x-test-user', 'operator').set('x-test-permissions', allowed).send(body);
    const transport = { async sendMail(message) { return { accepted: [message.to], messageId: 'message-history-test' }; }, close() {} };
    it('allows the marketing permission to read imported contact history only', async function () {
        const Contact = require('../models/ReportMailContact');
        const contact = await Contact.create({ name: 'Imported', email: 'imported@example.test', sourceLabel: 'Test',
            basis: 'Test report delivery', importKey: 'test', sourceId: 'row-1' });
        const lead = await Lead.create(input());
        const path = '/api/admin/nqoc/report-leads';
        const batch = 'nqoc-report-leads:batch-send';
        assert.strictEqual((await send('get', `${path}/contact-${contact.id}/email-history`, undefined, batch)).status, 200);
        assert.strictEqual((await send('get', `${path}/${lead.id}/email-history`, undefined, batch)).status, 403);
        assert.strictEqual((await send('get', `${path}/${lead.id}/email-history`, undefined, 'nqoc-report-leads:list')).status, 200);
    });
    it('persists an immutable first job and accepts duplicate request keys only once', async function () {
        const lead = await Lead.create(input());
        const [a, b] = await Promise.all([queueManual(Lead, lead, command()), queueManual(Lead, lead, command())]);
        assert.strictEqual(String(a._id), String(b._id)); assert.strictEqual(await Delivery.countDocuments(), 1);
        assert.strictEqual(a.recipient, lead.email); assert.strictEqual(a.requestedBy, 'operator');
    });
    it('preserves an accepted job and every SMTP attempt when sending again', async function () {
        let lead = await Lead.create(input());
        const first = await queueManual(Lead, lead, command());
        await createReportMailer({ models: [Lead, Legacy], secret: 'test-key', transport }).tick();
        await Lead.updateOne({ _id: lead._id }, { $set: { 'mail.requestedAt': new Date(Date.now() - 120000) } });
        lead = await Lead.findById(lead._id);
        await assert.rejects(queueManual(Lead, lead, command('request_history_0002')), /需要填写原因/);
        await queueManual(Lead, lead, { ...command('request_history_0002'), reason: '收件人请求补发' });
        const history = await historyFor(Lead, await Lead.findById(lead._id));
        assert.strictEqual(history.total, 2); assert.strictEqual(history.acceptedCount, 1);
        const old = await Delivery.findById(first._id);
        assert.strictEqual(old.status, 'accepted'); assert.strictEqual(old.attempts.length, 1);
        assert.strictEqual(old.attempts[0].status, 'accepted'); assert.ok(old.attempts[0].endedAt);
        assert.strictEqual(history.jobs[0].reason, '收件人请求补发');
    });
    it('keeps each automatic retry in the same job with separate attempt results', async function () {
        const lead = await Lead.create(input({ mail: pendingReportMail() })); let sends = 0;
        const w = createReportMailer({ models: [Lead, Legacy], secret: 'test-key', transport: { async sendMail() {
            if (++sends === 1) throw Object.assign(new Error('temporary'), { responseCode: 451 });
            return { accepted: ['recipient@example.test'], messageId: 'retry-accepted' };
        }, close() {} } });
        await w.tick(); await Lead.updateOne({ _id: lead.id }, { $set: { 'mail.nextAttemptAt': new Date(0) } }); await w.tick();
        const history = await historyFor(Lead, await Lead.findById(lead.id));
        assert.strictEqual(history.total, 1); assert.strictEqual(history.jobs[0].attempts.length, 2);
        assert.deepStrictEqual(history.jobs[0].attempts.map(a => a.status), ['pending', 'accepted']);
    });
    it('recovers a persisted SMTP result if the lead summary update was interrupted', async function () {
        const lead = await Lead.create(input({ mail: pendingReportMail() }));
        await createReportMailer({ models: [Lead, Legacy], secret: 'test-key', transport }).tick();
        await Lead.updateOne({ _id: lead.id }, { $set: { 'mail.status': 'sending', 'mail.lockedAt': new Date(0) } });
        let sends = 0;
        await createReportMailer({ models: [Lead, Legacy], secret: 'test-key', transport: { async sendMail() { sends++; }, close() {} } }).tick();
        assert.strictEqual(sends, 0); assert.strictEqual((await Lead.findById(lead.id)).mail.status, 'accepted');
    });
    it('never resends a terminal job even if its old outbox is accidentally pending', async function () {
        const lead = await Lead.create(input({ mail: pendingReportMail() }));
        await createReportMailer({ models: [Lead, Legacy], secret: 'test-key', transport }).tick();
        await Lead.updateOne({ _id: lead.id }, { $set: { 'mail.status': 'pending', 'mail.nextAttemptAt': new Date(0) } });
        let sends = 0;
        await createReportMailer({ models: [Lead, Legacy], secret: 'test-key', transport: { async sendMail() { sends++; }, close() {} } }).tick();
        assert.strictEqual(sends, 0); assert.strictEqual((await Delivery.findOne()).status, 'accepted');
        assert.strictEqual((await Lead.findById(lead.id)).mail.status, 'accepted');
    });
    it('imports old snapshots without sending or inventing actor and request time', async function () {
        const lead = await Lead.create(input({ mail: { status: 'accepted', reportSlug: REPORT_SLUG, attempts: 2, messageId: 'legacy' } }));
        await migrateHistory([Lead, Legacy]); await migrateHistory([Lead, Legacy]);
        const history = await historyFor(Lead, await Lead.findById(lead._id));
        assert.strictEqual(history.total, 1); assert.strictEqual(history.jobs[0].origin, 'legacy');
        assert.strictEqual(history.jobs[0].requestedAt, null); assert.strictEqual(history.jobs[0].requestedBy, '');
        assert.strictEqual(history.jobs[0].attempts.length, 0); assert.strictEqual(history.acceptedCount, 1);
    });
    it('rejects stale recipients/report versions and concurrent different requests', async function () {
        const lead = await Lead.create(input());
        await assert.rejects(queueManual(Lead, lead, { ...command(), expectedEmail: 'other@example.test' }), /已变化/);
        await assert.rejects(queueManual(Lead, lead, { ...command(), reportVersion: 'old' }), /已变化/);
        const results = await Promise.allSettled([queueManual(Lead, lead, command()), queueManual(Lead, lead, command('request_history_0003'))]);
        assert.strictEqual(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.strictEqual(await Delivery.countDocuments(), 1);
    });
    it('checks login, dedicated send permission, reason and idempotent API replay', async function () {
        const lead = await Lead.create(input()); const path = `/api/admin/nqoc/report-leads/${lead.id}`;
        assert.strictEqual((await request(app).post(path + '/send-email').send(command())).status, 401);
        assert.strictEqual((await send('post', path + '/send-email', command(), 'nqoc-report-leads:list')).status, 403);
        const preview = await send('get', path + '/email-preview'); assert.strictEqual(preview.status, 200);
        assert.strictEqual(preview.body.hasPrevious, false); assert.ok(!preview.body.text.includes('sig='));
        const a = await send('post', path + '/send-email', command()); assert.strictEqual(a.status, 202);
        const b = await send('post', path + '/send-email', command()); assert.strictEqual(b.body.jobId, a.body.jobId);
        const history = await send('get', path + '/email-history'); assert.strictEqual(history.body.jobs.length, 1);
        assert.strictEqual(history.body.jobs[0].requestedBy, 'operator');
    });
    it('cancels pending mail on soft delete and does not send after restoring', async function () {
        const lead = await Legacy.create(input({ mail: pendingReportMail() }));
        const path = `/api/admin/nqoc/report-leads/whitepaper-${lead.id}`;
        const deleted = await send('delete', path); assert.strictEqual(deleted.status, 200);
        assert.strictEqual((await Legacy.findById(lead.id)).mail.status, 'cancelled');
        assert.strictEqual((await send('post', path + '/restore')).status, 200);
        let sends = 0;
        await createReportMailer({ models: [Lead, Legacy], secret: 'test-key', transport: { async sendMail() { sends++; }, close() {} } }).tick();
        assert.strictEqual(sends, 0);
        assert.strictEqual((await Delivery.findOne()).status, 'cancelled');
    });
    it('binds download links to their job and active application record', async function () {
        const lead = await Lead.create(input()); const job = await queueManual(Lead, lead, command());
        await createReportMailer({ models: [Lead, Legacy], secret: 'test-key', transport }).tick();
        const sent = await Delivery.findById(job.id); const url = new URL(deliveryLink('test-key', sent.id, sent.linkExpiresAt.getTime()));
        assert.ok((await request(app).get(url.pathname + url.search)).headers.location.includes('/nqoc/report-2026.pdf'));
        assert.strictEqual((await Lead.findById(lead.id)).reportOpenCount, 1);
        await Lead.updateOne({ _id: lead.id }, { $set: { deletedAt: new Date() } });
        assert.strictEqual((await request(app).get(url.pathname + url.search)).headers.location, '/nqoc/report-expired');
    });
    it('batch preview excludes accepted, uncertain, deleted and duplicate recipients', async function () {
        const a = await Lead.create(input());
        const duplicate = await Lead.create(input());
        const accepted = await Lead.create(input({ email: 'accepted@example.test', mail: { status: 'accepted', reportSlug: REPORT_SLUG } }));
        const deleted = await Lead.create(input({ email: 'deleted@example.test', deletedAt: new Date() }));
        const uncertain = await Lead.create(input({ email: 'uncertain@example.test', mail: { status: 'uncertain', reportSlug: REPORT_SLUG } }));
        const preview = await previewBatch([a.id, duplicate.id, accepted.id, deleted.id, uncertain.id], 'operator');
        assert.strictEqual(preview.eligibleCount, 1); assert.strictEqual(preview.excludedCount, 4);
        assert.ok(preview.rows.some(r => /重复/.test(r.message || '')));
        assert.strictEqual(await Delivery.countDocuments(), 0);
    });
    it('batch submission is permission protected, sealed to the preview and idempotent', async function () {
        const a = await Lead.create(input());
        const b = await Legacy.create(input({ email: 'second@example.test' }));
        const ids = [a.id, 'whitepaper-' + b.id];
        assert.strictEqual((await send('post', '/api/admin/nqoc/report-leads/email-batch-preview', { ids }, 'nqoc-report-leads:send')).status, 403);
        const preview = (await send('post', '/api/admin/nqoc/report-leads/email-batch-preview', { ids })).body;
        const payload = { requestKey: 'batch_test_request_001', previewToken: preview.previewToken, reason: '历史申请补发', acknowledged: true };
        const forged = await send('post', '/api/admin/nqoc/report-leads/email-batches', { ...payload, previewToken: preview.previewToken + 'bad' });
        assert.strictEqual(forged.status, 400);
        await Promise.all([send('post', '/api/admin/nqoc/report-leads/email-batches', payload), send('post', '/api/admin/nqoc/report-leads/email-batches', payload)]);
        const result = await batchResult(payload.requestKey);
        assert.strictEqual(result.status, 'completed'); assert.strictEqual(result.queuedCount, 2, JSON.stringify(result.results));
        assert.strictEqual(await Delivery.countDocuments(), 2);
        const jobs = await Delivery.find(); assert.ok(jobs.every(j => j.origin === 'batch' && j.batchId === payload.requestKey && j.requestedBy === 'operator'));
    });
    it('revalidates a batch recipient against the confirmed snapshot before queueing', async function () {
        const lead = await Lead.create(input()); const preview = await previewBatch([lead.id], 'operator');
        await Lead.updateOne({ _id: lead.id }, { $set: { email: 'changed@example.test' } });
        const result = await submitBatch({ requestKey: 'batch_test_request_002', previewToken: preview.previewToken, reason: '历史补发', acknowledged: true }, 'operator');
        assert.strictEqual(result.queuedCount, 0); assert.strictEqual(result.results[0].status, 'skipped');
        assert.strictEqual(await Delivery.countDocuments(), 0);
    });
    it('resumes an interrupted batch without duplicating a task already created', async function () {
        const lead = await Lead.create(input()); const batchId = 'batch_test_request_003';
        const item = { id: lead.id, ...command() }; delete item.requestKey;
        const key = require('crypto').createHash('sha256').update(`${batchId}:${lead.id}`).digest('hex');
        await queueManual(Lead, lead, { ...item, requestKey: key, reason: '补发', origin: 'batch', batchId, requestedBy: 'operator' });
        await Batch.create({ _id: batchId, requestedBy: 'operator', reason: '补发', status: 'interrupted', items: [item], results: [] });
        const result = await submitBatch({ requestKey: batchId, acknowledged: true }, 'operator');
        assert.strictEqual(result.queuedCount, 1); assert.strictEqual(await Delivery.countDocuments(), 1);
    });
    it('limits batch selection to fifty records and binds confirmation to the operator', async function () {
        await assert.rejects(previewBatch(Array(51).fill('bad'), 'operator'), /1–50/);
        const lead = await Lead.create(input()); const preview = await previewBatch([lead.id], 'operator');
        await assert.rejects(submitBatch({ requestKey: 'batch_test_request_004', previewToken: preview.previewToken, reason: '补发', acknowledged: true }, 'another'), /操作人/);
        assert.strictEqual(await Delivery.countDocuments(), 0);
    });
    it('keeps older tracked links working for applications stored in the legacy source', async function () {
        const fs = require('fs'), vm = require('vm'), path = require('path');
        const source = fs.readFileSync(path.join(__dirname, '..', 'routes/nqocFrontend.js'), 'utf8');
        const start = source.indexOf("app.get('/nqoc/reports/open'");
        let handler, location;
        vm.runInNewContext(source.slice(start, source.indexOf("    app.get('/nqoc/report-2026.pdf'", start)), {
            app: { get: (p, limiter, fn) => { handler = fn; } }, reportOpenLimiter: () => {}, recordReportOpen: async () => {},
            verifyOpenToken: () => ({ i: '64f000000000000000000001' }), reportPdfSecret: 'test-key', reportPdfSignature: () => 'test-signature',
            NqocReportLead: { findById: () => ({ lean: async () => null }) },
            NqocWhitepaperRequest: { findById: () => ({ lean: async () => ({ deletedAt: null }) }) }, console
        });
        await handler({ query: { t: 'test-token' } }, { redirect: (code, url) => { location = url; } });
        assert.ok(location.startsWith('/nqoc/report-2026.pdf?exp='));
    });

});
