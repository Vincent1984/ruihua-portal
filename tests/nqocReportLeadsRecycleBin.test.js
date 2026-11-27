const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const routes = read('routes/api/nqoc.js');
const leadModel = read('models/NqocReportLead.js');
const legacyModel = read('models/NqocWhitepaperRequest.js');
const permissions = read('config/permissions.js');
const consoleHtml = read('admin/console.html');
const adminJs = read('admin/js/nqoc.js');
const reportMail = read('utils/reportMail.js');
const spec = read('docs/nqoc-report-leads-recycle-bin.md');

describe('报告领取记录回收站（软删 / 恢复 / 彻底删除 / TTL）', function () {
    it('两张来源表都有 deletedAt / deletedBy / purgeAt 字段与 TTL 索引', function () {
        [leadModel, legacyModel].forEach(model => {
            assert.match(model, /deletedAt:\s*\{\s*type:\s*Date,\s*default:\s*null\s*\}/);
            assert.match(model, /deletedBy:\s*\{\s*type:\s*String,\s*default:\s*''\s*\}/);
            assert.match(model, /purgeAt:\s*\{\s*type:\s*Date,\s*default:\s*null\s*\}/);
            assert.match(model, /index\(\{\s*purgeAt:\s*1\s*\},\s*\{\s*expireAfterSeconds:\s*0\s*\}\)/);
            assert.match(model, /index\(\{\s*deletedAt:\s*1,\s*createdAt:\s*-1\s*\}\)/);
        });
    });

    it('列表默认只看正常记录，bin=1 只看回收站，看板不计回收站', function () {
        const build = routes.match(/function buildLeadQuery\(req\)[\s\S]*?\n    \}/)[0];
        assert.match(build, /query\.deletedAt = inBin \? \{ \$ne: null \} : null;/);
        assert.match(routes, /countDocuments\(\{\s*deletedAt:\s*null,\s*createdAt/);
        assert.match(routes, /distinct\('company',\s*\{\s*deletedAt:\s*null\s*\}\)/);
        // 手机号聚合同时产出「含回收站」与「仅正常」两份计数
        assert.match(routes, /active:\s*\{\s*\$sum:\s*\{\s*\$cond:\s*\[\{\s*\$ifNull:\s*\['\$deletedAt',\s*false\]\s*\},\s*0,\s*1\]/);
        assert.match(routes, /const uniqueTotal = phoneStats\.active\.size;/);
        // 回收站视图按含回收站口径标重，避免删掉其中一条后标记消失
        assert.match(routes, /const dupSource = inBin \? phoneStats\.all : phoneStats\.active;/);
    });

    it('删除改为软删并写入 purgeAt；恢复与彻底删除各自校验状态', function () {
        assert.match(routes, /\$set:\s*\{\s*deletedAt:\s*now,\s*deletedBy:[^}]*purgeAt:\s*new Date/);
        assert.doesNotMatch(routes, /NqocReportLead\.findByIdAndDelete|NqocWhitepaperRequest\.findByIdAndDelete/);
        assert.match(routes, /findOneAndUpdate\(\s*\{\s*_id:\s*rawId,\s*deletedAt:\s*null\s*\}/);
        assert.match(routes, /该记录已过保留期，无法恢复/);
        assert.match(routes, /findOneAndDelete\(\{\s*_id:\s*rawId,\s*deletedAt:\s*\{\s*\$ne:\s*null\s*\}\s*\}\)/);
        assert.match(routes, /\$set:\s*\{\s*deletedAt:\s*null,\s*deletedBy:\s*'',\s*purgeAt:\s*null\s*\}/);
    });

    it('回收站记录不再发信、不再允许下载、不参与导出', function () {
        assert.match(reportMail, /'mail\.nextAttemptAt':\s*\{\s*\$lte:\s*new Date\(\)\s*\},\s*deletedAt:\s*null/);
        assert.match(reportMail, /Model\.countDocuments\(\{\s*email,\s*deletedAt:\s*null/);
        assert.match(routes, /if \(lead\.deletedAt\) return res\.redirect\(302, REPORT_EXPIRED_PATH\);/);
        assert.match(routes, /query\.deletedAt = null;/);
        assert.match(routes, /该记录在回收站中，请先恢复后再发送/);
    });

    it('保留期可通过环境变量限制在 1~180 天，默认 30 天', function () {
        const fn = routes.match(/function leadTrashRetentionDays\(\)[\s\S]*?\n    \}/)[0];
        assert.match(fn, /if \(!Number\.isFinite\(n\) \|\| n <= 0\) return 30;/);
        assert.match(fn, /Math\.min\(180,\s*Math\.max\(1,\s*Math\.floor\(n\)\)\)/);
    });

    it('新增三个权限码并接入路由', function () {
        ['nqoc-report-leads:delete', 'nqoc-report-leads:restore', 'nqoc-report-leads:purge'].forEach(code => {
            assert.ok(permissions.includes(code), `缺少权限码 ${code}`);
            assert.ok(routes.includes(`requirePerm('${code}')`), `路由未使用 ${code}`);
        });
    });

    it('后台提供正常记录 / 回收站切换、回收站列与恢复动作', function () {
        assert.match(consoleHtml, /class="segments" data-filter="bin"[\s\S]{0,200}data-value="1">回收站</);
        // 列表只留 6 列，删除人收进详情页
        assert.match(consoleHtml, /data-bin-head="1"[\s\S]{0,400}删除时间[\s\S]{0,200}剩余天数/);
        assert.doesNotMatch(consoleHtml, /data-bin-head="1"[\s\S]{0,400}删除人/);
        assert.match(adminJs, /'nqoc-report-leads':\s*\{[^}]*\bbin:\s*''/);
        assert.match(adminJs, /bin:\s*\['',\s*'1'\]/);
        assert.match(adminJs, /const bin = NQ_FILTERS\['nqoc-report-leads'\]\.bin;/);
        assert.match(adminJs, /if \(bin\) qs\.set\('bin', bin\)/);
        assert.match(adminJs, /'restore-lead':/);
        assert.match(adminJs, /'purge-lead':/);
        assert.match(adminJs, /移入回收站？30 天内可在回收站恢复/);
    });

    it('报告领取记录支持独立详情页，发送记录与删除人也收进详情', function () {
        assert.match(consoleHtml, /id="nqLeadDetail" class="lead-detail"/);
        assert.match(adminJs, /'lead-detail-back':/);
        assert.match(adminJs, /function renderLeadDetail\(/);
        assert.match(adminJs, /function reportHistoryHtml\(/);
        assert.match(routes, /router\.get\('\/admin\/nqoc\/report-leads\/:id', authRequired/);
        assert.match(read('server.js'), /app\.get\('\/admin\/nqoc-report-leads\/:id'/);
    });

    it('邮件状态改为 6 档记录级分类（含是否打开），列表 / 看板 / 导出同口径', function () {
        // 后端记录级分类：与单次投递任务状态（mail.status）区分
        assert.ok(routes.includes("const LEAD_MAIL_LABELS = { unsent: '未发送', queued: '待发送', unopened: '已发送·未打开', opened: '已发送·已打开', failed: '发送失败', uncertain: '结果待核实' };"));
        assert.ok(routes.includes("if (status === 'accepted') return Number(lead.reportOpenCount) >= 1 ? 'opened' : 'unopened';"));
        // 关键词搜索已占用 $or，邮件状态条件必须走 $and
        assert.ok(routes.includes('if (mailCond.length) query.$and = mailCond;'));
        assert.ok(routes.includes("else if (mailStatus === 'opened') mailCond.push({ 'mail.status': 'accepted' }, { reportOpenCount: { $gte: 1 } });"));
        // 看板：已送达 / 已打开
        assert.ok(routes.includes('delivered: delivered + deliveredWp,'));
        assert.ok(routes.includes('opened: openedCount + openedWp,'));
        // 导出 11 列：新增「邮件状态」「报告打开」
        assert.ok(routes.includes("'提交时间', '邮件状态', '报告打开'"));
        assert.ok(routes.includes('column: 11'));
        // 前端：白名单 / 本地过滤 / 看板 / 下拉
        assert.ok(adminJs.includes("mailStatus: ['', 'unsent', 'queued', 'unopened', 'opened', 'failed', 'uncertain']"));
        assert.ok(adminJs.includes('nqLeadMailCategory(l) === f.mailStatus'));
        assert.ok(adminJs.includes("$('nqLOpen')"), '看板缺少打开率渲染');
        assert.ok(consoleHtml.includes('id="nqLOpen"'), '看板缺少打开率卡片');
        assert.match(consoleHtml, /<option value="opened">已发送\s*·\s*已打开<\/option>/);
        assert.match(consoleHtml, /<option value="unopened">已发送\s*·\s*未打开<\/option>/);
    });

    it('规格文档已记录结论、测试用例与运维规则', function () {
        assert.match(spec, /物理删除/);
        assert.match(spec, /NQOC_LEAD_TRASH_RETENTION_DAYS/);
        assert.match(spec, /TTL/);
        assert.match(spec, /测试验证/);
        assert.match(spec, /运维/);
    });
});

// 真实 MongoDB 语义验证：设为 mongodb://127.0.0.1:37019/ruihua_lead_test_<name> 时启用
const uri = process.env.NQOC_LEAD_TEST_MONGO;
(uri ? describe : describe.skip)('回收站数据层语义（隔离 MongoDB）', function () {
    this.timeout(10000);
    let conn, Model, Legacy;
    before(async function () {
        assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:37019\/ruihua_lead_test_[a-z0-9_]+$/);
        conn = await mongoose.createConnection(uri).asPromise();
        Model = conn.model('RecycleLead', require('../models/NqocReportLead').schema.clone());
        Legacy = conn.model('RecycleLegacy', require('../models/NqocWhitepaperRequest').schema.clone());
        await Promise.all([Model.init(), Legacy.init()]);
    });
    beforeEach(async function () { await Promise.all([Model.deleteMany({}), Legacy.deleteMany({})]); });
    after(async function () { if (conn) { await conn.dropDatabase(); await conn.close(); } });

    const input = extra => Object.assign({
        name: '测试', phone: '13800000000', company: '测试公司', position: '测试', email: 'test@example.test'
    }, extra || {});

    it('新记录默认不在回收站，历史缺字段记录同样被 deletedAt: null 命中', async function () {
        await Model.create(input());
        await Model.collection.insertOne({ name: '历史', phone: '13900000000', company: '历史公司', position: '历史', email: 'old@example.test', createdAt: new Date() });
        assert.strictEqual(await Model.countDocuments({ deletedAt: null }), 2);
        assert.strictEqual(await Model.countDocuments({ deletedAt: { $ne: null } }), 0);
    });

    it('软删写入 deletedAt / purgeAt 后只在回收站可见', async function () {
        const doc = await Model.create(input());
        const days = 30, now = new Date();
        await Model.updateOne({ _id: doc._id }, { $set: { deletedAt: now, deletedBy: 'admin', purgeAt: new Date(now.getTime() + days * 86400000) } });
        assert.strictEqual(await Model.countDocuments({ deletedAt: null }), 0);
        assert.strictEqual(await Model.countDocuments({ deletedAt: { $ne: null } }), 1);
        const inBin = await Model.findById(doc._id);
        assert.strictEqual(inBin.deletedBy, 'admin');
        assert.ok(inBin.purgeAt - inBin.deletedAt === days * 86400000);
    });

    it('恢复清空三字段后重新出现在正常列表', async function () {
        const doc = await Model.create(input({ deletedAt: new Date(), deletedBy: 'admin', purgeAt: new Date(Date.now() + 86400000) }));
        await Model.updateOne({ _id: doc._id }, { $set: { deletedAt: null, deletedBy: '', purgeAt: null } });
        const restored = await Model.findById(doc._id);
        assert.strictEqual(restored.deletedAt, null);
        assert.strictEqual(restored.deletedBy, '');
        assert.strictEqual(restored.purgeAt, null);
        assert.strictEqual(await Model.countDocuments({ deletedAt: null }), 1);
    });

    it('彻底删除只对回收站内记录生效', async function () {
        const active = await Model.create(input());
        assert.strictEqual(await Model.findOneAndDelete({ _id: active._id, deletedAt: { $ne: null } }), null);
        assert.ok(await Model.findById(active._id));
        await Model.updateOne({ _id: active._id }, { $set: { deletedAt: new Date(), purgeAt: new Date(Date.now() + 86400000) } });
        assert.ok(await Model.findOneAndDelete({ _id: active._id, deletedAt: { $ne: null } }));
        assert.strictEqual(await Model.findById(active._id), null);
    });

    it('purgeAt 上的 TTL 索引已建立（expireAfterSeconds=0）', async function () {
        const [indexes, legacyIndexes] = await Promise.all([Model.collection.indexes(), Legacy.collection.indexes()]);
        [indexes, legacyIndexes].forEach(list => {
            const ttl = list.find(i => i.key && i.key.purgeAt === 1);
            assert.ok(ttl, '缺少 purgeAt 索引');
            assert.strictEqual(ttl.expireAfterSeconds, 0);
        });
    });
});
