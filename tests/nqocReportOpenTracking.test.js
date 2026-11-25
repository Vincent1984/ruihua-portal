const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const reportMail = read('utils/reportMail.js');
const frontend = read('routes/nqocFrontend.js');
const routes = read('routes/api/nqoc.js');
const leadModel = read('models/NqocReportLead.js');
const legacyModel = read('models/NqocWhitepaperRequest.js');
const adminJs = read('admin/js/nqoc.js');
const docs = read('docs/DATABASE-COLLECTIONS.md');

const mail = require('../utils/reportMail');

describe('报告页面打开追踪（邮件追踪链接 + 后台展示）', function () {
    it('追踪令牌可签发、可校验，篡改 / 过期 / 换密钥一律失效', function () {
        const secret = 'unit-test-secret';
        const leadId = '64f000000000000000000001';
        const expires = Date.now() + 60000;
        const token = mail.signOpenToken(secret, leadId, expires);
        const data = mail.verifyOpenToken(secret, token);
        assert.ok(data, '正常令牌应校验通过');
        assert.strictEqual(data.i, leadId);
        assert.strictEqual(Number(data.e), expires);

        assert.strictEqual(mail.verifyOpenToken(secret, token + 'x'), null, '篡改签名应失效');
        assert.strictEqual(mail.verifyOpenToken('another-secret', token), null, '换密钥应失效');
        assert.strictEqual(mail.verifyOpenToken(secret, mail.signOpenToken(secret, leadId, Date.now() - 1000)), null, '过期令牌应失效');
        assert.strictEqual(mail.verifyOpenToken(secret, ''), null, '空令牌应失效');
        assert.strictEqual(mail.verifyOpenToken('', token), null, '缺少密钥应失效');
    });

    it('令牌校验使用常量时间比较且携带有效期', function () {
        assert.match(reportMail, /crypto\.timingSafeEqual/);
        assert.match(reportMail, /Number\(data\.e\) <= Date\.now\(\)/);
    });

    it('邮件正文链接改为追踪地址，先记打开再跳签名 PDF', function () {
        const messageFor = reportMail.match(/function messageFor\([\s\S]*?\n\}/)[0];
        assert.match(messageFor, /reportOpenLink\(secret,\s*lead\._id/);
        assert.doesNotMatch(messageFor, /reportLink\(secret/);
        assert.match(reportMail, /\/nqoc\/reports\/open\?t=\$\{encodeURIComponent\(signOpenToken/);
        assert.match(reportMail, /signOpenToken,\s*verifyOpenToken,\s*reportOpenLink/);
    });

    it('新增 /nqoc/reports/open 路由：校验令牌 → 记打开 → 302 签名 PDF', function () {
        const route = frontend.match(/app\.get\('\/nqoc\/reports\/open'[\s\S]*?\n    \}\);/)[0];
        assert.match(route, /verifyOpenToken\(reportPdfSecret,\s*req\.query\.t\)/);
        assert.match(route, /if \(lead\.deletedAt\) return expired\(\);/);
        assert.match(route, /await recordReportOpen\(NqocReportLead, lead\._id\)/);
        // 历史白皮书预约记录同样要计数，否则后台永远只显示「邮件服务已接收」
        assert.match(route, /await recordReportOpen\(NqocWhitepaperRequest, legacy\._id\)/);
        const helper = frontend.match(/async function recordReportOpen\(Model, leadId\)[\s\S]*?\n    \}/)[0];
        assert.match(helper, /\{ _id: leadId, firstReportOpenAt: null \},\s*\{ \$set: \{ firstReportOpenAt: now \} \}/);
        assert.match(helper, /\$inc: \{ reportOpenCount: 1 \},\s*\$set: \{ lastReportOpenAt: now \}/);
        assert.match(route, /\/nqoc\/report-2026\.pdf\?exp=\$\{exp\}&sig=\$\{reportPdfSignature\(exp\)\}/);
        // 原有签名 PDF 直链保持可用，旧邮件不受影响
        assert.match(frontend, /app\.get\('\/nqoc\/report-2026\.pdf'/);
    });

    it('追踪路由按 IP 限流，超限直接落失效页', function () {
        assert.match(frontend, /const rateLimit = require\('express-rate-limit'\)/);
        const limiter = frontend.match(/const reportOpenLimiter = rateLimit\(\{[\s\S]*?\n    \}\);/)[0];
        assert.match(limiter, /windowMs: 10 \* 60 \* 1000/);
        assert.match(limiter, /max: 60/);
        assert.match(limiter, /handler: \(req, res\) => res\.redirect\(302, '\/nqoc\/report-expired'\)/);
        assert.match(frontend, /app\.get\('\/nqoc\/reports\/open', reportOpenLimiter,/);
    });

    it('旧邮件 PDF 直链按 linkExpiresAt 归属补记打开，30 分钟内只记一次', function () {
        const fn = frontend.match(/async function trackLegacyReportOpen\(exp\)[\s\S]*?\n    \}/)[0];
        assert.match(fn, /'mail\.linkExpiresAt': new Date\(exp\), deletedAt: null/);
        assert.match(fn, /\$or: \[\{ lastReportOpenAt: null \}, \{ lastReportOpenAt: \{ \$lt: cutoff \} \}\]/);
        assert.match(fn, /Date\.now\(\) - 30 \* 60 \* 1000/);
        // 新报告领取记录与历史白皮书预约记录都要查、都要记
        assert.match(fn, /NqocReportLead\.findOne\(query, '_id'\)\.lean\(\)/);
        assert.match(fn, /NqocWhitepaperRequest\.findOne\(query, '_id'\)\.lean\(\)/);
        assert.match(fn, /recordReportOpen\(NqocReportLead, lead\._id\)/);
        assert.match(fn, /recordReportOpen\(NqocWhitepaperRequest, legacy\._id\)/);
        // 直链校验通过后调用，且不阻塞 PDF 流式输出
        const pdf = frontend.match(/app\.get\('\/nqoc\/report-2026\.pdf'[\s\S]*?const headers =/)[0];
        assert.match(pdf, /if \(!allowed\) return res\.redirect\(302, '\/nqoc\/whitepaper-apply'\);\s*\n\s*\/\/[^\n]*\n\s*trackLegacyReportOpen\(exp\);/);
        assert.doesNotMatch(pdf, /await trackLegacyReportOpen/);
    });

    it('站内下载同样累计打开次数与最近打开时间', function () {
        const download = routes.match(/router\.get\('\/nqoc\/reports\/download'[\s\S]*?\n    \}\);/)[0];
        assert.match(download, /\{ _id: lead\._id, firstReportOpenAt: null \},\s*\{ \$set: \{ firstReportOpenAt: now \} \}/);
        assert.match(download, /\$inc: \{ downloadCount: 1, reportOpenCount: 1 \}/);
        assert.match(download, /\$set: \{ lastDownloadedAt: now, lastReportOpenAt: now \}/);
    });

    it('两张记录表都新增三个打开追踪字段', function () {
        [leadModel, legacyModel].forEach(model => {
            assert.match(model, /reportOpenCount:\s*\{\s*type:\s*Number,\s*default:\s*0\s*\}/);
            assert.match(model, /firstReportOpenAt:\s*\{\s*type:\s*Date,\s*default:\s*null\s*\}/);
            assert.match(model, /lastReportOpenAt:\s*\{\s*type:\s*Date,\s*default:\s*null\s*\}/);
        });
    });

    it('历史白皮书仅在邮件已发出时下发打开统计', function () {
        const legacy = routes.match(/function serializeLegacyWhitepaperLead\(doc\)[\s\S]*?\n\}/)[0];
        assert.match(legacy, /const mailSent = o\.mail && o\.mail\.status === 'accepted'/);
        assert.match(legacy, /\.\.\.\(mailSent \? \{/);
        assert.match(legacy, /reportOpenCount: Number\(o\.reportOpenCount\) \|\| 0/);
    });

    it('发送历史下载链接对两张表都累计打开次数', function () {
        const download = routes.match(/router\.get\('\/nqoc\/report-deliveries\/:id\/download'[\s\S]*?\n    \}\);/)[0];
        assert.doesNotMatch(download, /if \(Model === NqocReportLead\)/);
        assert.match(download, /\$inc: \{ reportOpenCount: 1 \}, \$set: \{ lastReportOpenAt: now \}/);
    });

    it('后台邮件状态列展示打开次数与最近打开时间', function () {
        const fn = adminJs.match(/function nqMailStatus\(lead\)[\s\S]*?\n    \}/)[0];
        assert.match(fn, /Number\.isFinite\(lead\.reportOpenCount\)/);
        assert.match(fn, /报告已打开 \$\{opens\} 次/);
        assert.match(fn, /报告未打开/);
    });

    it('数据库文档记录打开追踪字段', function () {
        assert.match(docs, /reportOpenCount`\/`firstReportOpenAt`\/`lastReportOpenAt/);
    });
});
