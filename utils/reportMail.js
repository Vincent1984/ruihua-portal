const crypto = require('crypto');
const nodemailer = require('nodemailer');
const REPORT_SLUG = 'china-new-quality-organization-report-2026';
const REPORT_TITLE = '2026 中国企业新质组织成熟度研究报告';
const SITE = 'https://www.ruihuaconsulting.com';
const LINK_TTL = 7 * 24 * 60 * 60 * 1000;

function pendingReportMail(slug = REPORT_SLUG) {
    if (slug !== REPORT_SLUG) return undefined;
    return { status: 'pending', reportSlug: slug, attempts: 0, nextAttemptAt: new Date() };
}
async function reportMailAllowed(email, models) {
    const counts = await Promise.all(models.map(Model => Model.countDocuments({ email, deletedAt: null,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, 'mail.status': { $exists: true } })));
    return counts.reduce((a, b) => a + b, 0) < 3;
}
function reportLink(secret, expires = Date.now() + LINK_TTL) {
    if (!secret) throw new Error('Report signing key missing');
    const sig = crypto.createHmac('sha256', secret).update(`nqoc-report:${expires}`).digest('hex').slice(0, 32);
    return `${SITE}/nqoc/report-2026.pdf?exp=${expires}&sig=${sig}`;
}
// 邮件里的报告链接改用带记录 id 的追踪地址：先记一次「报告页面打开」，再跳到签名 PDF。
// 令牌与 PDF 签名共用同一密钥，有效期沿用邮件链接有效期。
function signOpenToken(secret, leadId, expires) {
    if (!secret) throw new Error('Report signing key missing');
    const payload = Buffer.from(JSON.stringify({ i: String(leadId), e: Number(expires) })).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(`nqoc-report-open:${payload}`).digest('base64url');
    return `${payload}.${sig}`;
}
function verifyOpenToken(secret, token) {
    if (!secret) return null;
    const raw = String(token || '');
    const dot = raw.indexOf('.');
    if (dot <= 0) return null;
    const payload = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const expected = crypto.createHmac('sha256', secret).update(`nqoc-report-open:${payload}`).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch (e) {
        return null;
    }
    if (!data || !data.i || !Number(data.e) || Number(data.e) <= Date.now()) return null;
    return data;
}
function reportOpenLink(secret, leadId, expires = Date.now() + LINK_TTL) {
    return `${SITE}/nqoc/reports/open?t=${encodeURIComponent(signOpenToken(secret, leadId, expires))}`;
}
function createTransport() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465),
        secure: process.env.SMTP_SECURE !== 'false',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        pool: false, connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 45000,
        dnsTimeout: 10000, tls: { rejectUnauthorized: true },
        disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false
    });
}
function messageFor(lead, secret) {
    const expires = lead.mail?.linkExpiresAt ? new Date(lead.mail.linkExpiresAt).getTime() : undefined;
    const link = reportOpenLink(secret, lead._id, expires);
    return {
        from: { name: process.env.SMTP_FROM_NAME || '瑞华智策·新质组织研究中心', address: process.env.SMTP_USER },
        to: lead.email,
        subject: `您申请的《${REPORT_TITLE}》已准备好`,
        text: `您好！\n\n感谢关注瑞华智策·新质组织研究中心。\n您申请的《${REPORT_TITLE}》已准备好，请通过以下链接查看或下载：\n\n${link}\n\n链接有效期为 7 天，请妥善保存报告文件。\n如有问题，可直接回复本邮件。\n\n瑞华智策·新质组织研究中心\n${SITE}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.8;color:#222"><p>您好！</p><p>感谢关注瑞华智策·新质组织研究中心。</p><p>您申请的《${REPORT_TITLE}》已准备好。</p><p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#18274a;color:#fff;text-decoration:none">查看 / 下载报告</a></p><p>链接有效期为 7 天，请妥善保存报告文件。如有问题，可直接回复本邮件。</p><p>瑞华智策·新质组织研究中心<br><a href="${SITE}">${SITE}</a></p></div>`
    };
}
function failureState(error, attempts) {
    const code = Number(error.responseCode);
    if (code >= 500 || error.code === 'EAUTH' || attempts >= 3) return 'failed';
    if (code >= 400 && code < 500) return 'pending';
    if (error.code === 'EDNS' || error.code === 'ECONNREFUSED') return 'pending';
    // 无明确 SMTP 拒绝时，断线可能发生在服务端接受后；保守暂停，避免重复投递。
    return 'uncertain';
}
function createReportMailer({ models, secret, transport = createTransport() }) {
    let busy = false, stopped = false, timer;
    async function tick() {
        if (busy || stopped) return;
        busy = true;
        try {
            for (const Model of models) {
                // 进程在 SMTP 接受后崩溃时无法确认投递结果，不自动重复发送。
                await Model.updateMany({ 'mail.status': 'sending', 'mail.lockedAt': { $lt: new Date(Date.now() - 180000) } },
                    { $set: { 'mail.status': 'uncertain', 'mail.lastError': '发送进程中断，请核实后手动重发' } });
                // 回收站内的记录不再发信
                const lead = await Model.findOneAndUpdate({ 'mail.status': 'pending', 'mail.reportSlug': REPORT_SLUG,
                    'mail.attempts': { $lt: 3 }, 'mail.nextAttemptAt': { $lte: new Date() }, deletedAt: null },
                    { $set: { 'mail.status': 'sending', 'mail.lockedAt': new Date(), 'mail.linkExpiresAt': new Date(Date.now() + LINK_TTL) }, $inc: { 'mail.attempts': 1 } },
                    { new: true, sort: { 'mail.nextAttemptAt': 1 } });
                if (!lead) continue;
                let state;
                try {
                    const info = await transport.sendMail(messageFor(lead, secret));
                    if (!info.accepted?.length) throw Object.assign(new Error('Recipient not accepted'), { responseCode: 550 });
                    state = { 'mail.status': 'accepted', 'mail.acceptedAt': new Date(), 'mail.messageId': info.messageId, 'mail.lastError': '' };
                } catch (error) {
                    state = { 'mail.status': failureState(error, lead.mail.attempts),
                        'mail.lastError': `${error.code || 'SMTP_ERROR'} ${error.responseCode || ''}`.trim(),
                        'mail.nextAttemptAt': new Date(Date.now() + 60000 * 2 ** (lead.mail.attempts - 1)) };
                }
                await Model.updateOne({ _id: lead._id, 'mail.status': 'sending', 'mail.lockedAt': lead.mail.lockedAt },
                    { $set: state, $unset: { 'mail.lockedAt': 1 } });
            }
        } finally { busy = false; }
    }
    return {
        tick,
        start() { timer = setInterval(() => tick().catch(() => console.error('[ReportMail] Worker database error')), 15000); timer.unref(); },
        stop() { stopped = true; clearInterval(timer); transport.close(); }
    };
}
module.exports = { REPORT_SLUG, REPORT_TITLE, pendingReportMail, reportMailAllowed, reportLink, signOpenToken, verifyOpenToken, reportOpenLink, createTransport, messageFor, failureState, createReportMailer };
