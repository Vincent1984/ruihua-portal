/**
 * 新质组织（迷你站 /nqoc）接口
 * - 后台：首页 Banner / 新质观点 / 案例研究 / 值得看见 / 报告领取记录
 * - 前台：报告领取表单提交 POST /api/nqoc/reports/apply
 *         报告凭证下载 GET  /api/nqoc/reports/download?t=&lt;凭证&gt;
 *
 * 字段与规则以 handoff/docs/数据模型与接口.md 为准，服务端独立再校验一遍。
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xss = require('xss');
const ExcelJS = require('exceljs');
const rateLimit = require('express-rate-limit');

const NqocBanner = require('../../models/NqocBanner');
const NqocInsight = require('../../models/NqocInsight');
const NqocCase = require('../../models/NqocCase');
const NqocVideo = require('../../models/NqocVideo');
const NqocReportLead = require('../../models/NqocReportLead');
// 历史「白皮书预约」独立表单数据，已并入报告领取记录统一展示
const NqocWhitepaperRequest = require('../../models/NqocWhitepaperRequest');
const { sendInternalError } = require('../../utils/responseHelpers');
const { escapeRegex } = require('../../utils/articleHelpers');
const { pushPage } = require('../../utils/baiduPush');
const logOp = require('../../middleware/operationLog');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EPISODE_RE = /^E\d{2,3}$/;
const STATUSES = ['draft', 'published', 'archived'];
const BANNER_MAX = 3;

// 研究成果：与前台共用同一份 JSON 配置（config/nqocReports.json），
// 领取报告时按 slug 取到 fileUrl（私有存储位置）用于输出下载流，accessMode=form 时绝不外露。
const REPORT_CONFIG = require('../../config/nqocReports.json');
const REPORTS = REPORT_CONFIG.map(report => ({
    slug: report.slug,
    title: report.title,
    status: report.status || 'published',
    publishDate: report.publishDate,
    fileUrl: report.fileUrl || '',
    accessMode: report.accessMode || 'form'
}));

/* ------------------------------- 通用小工具 ------------------------------- */

function trimStr(v, max) {
    const s = String(v == null ? '' : v).trim();
    return max && s.length > max ? s.slice(0, max) : s;
}

function has(body, key) {
    return Object.prototype.hasOwnProperty.call(body || {}, key);
}

function isAllowedLink(v) {
    const s = String(v || '').trim();
    return /^\/nqoc(\/|$)/.test(s) || /^https:\/\//i.test(s);
}

function isAllowedImage(v) {
    const s = String(v || '').trim();
    if (!s) return false;
    const base = String(process.env.TOS_PUBLIC_URL || '').replace(/\/+$/, '');
    if (base && s.startsWith(base + '/')) return true;
    return s.startsWith('/uploads/') || s.startsWith('/images/') || s.startsWith('/img/');
}

// 链接字段统一按规则裁剪：非法值一律存空串
function cleanLink(v) {
    const s = trimStr(v, 500);
    return isAllowedLink(s) ? s : '';
}

function pickStatus(v) {
    return STATUSES.includes(v) ? v : 'draft';
}

// 富文本白名单：p h2 h3 ul ol li blockquote strong em u a img figure figcaption br
// a 只留 href（站内 /nqoc 或 https），img 只留 src（自有存储）与 alt
const bodySanitizer = new xss.FilterXSS({
    whiteList: {
        p: [], h2: [], h3: [],
        ul: [], ol: [], li: [],
        blockquote: [], strong: [], em: [], u: [], br: [],
        a: ['href'], img: ['src', 'alt'],
        figure: [], figcaption: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script'],
    onTagAttr: function (tag, name, value) {
        if (tag === 'a' && name === 'href') {
            return isAllowedLink(value) ? 'href="' + xss.safeAttrValue(value) + '"' : '';
        }
        if (tag === 'img' && name === 'src') {
            return isAllowedImage(value) ? 'src="' + xss.safeAttrValue(value) + '"' : '';
        }
        return undefined;
    }
});

function sanitizeBody(v) {
    return bodySanitizer.process(String(v == null ? '' : v));
}

// 写操作 CSRF 兜底：拒绝浏览器明确标记为跨站的请求（同源与脚本调用不受影响）
function csrfGuard(req, res, next) {
    if (req.get('sec-fetch-site') === 'cross-site') {
        return res.status(403).json({ error: '请求来源校验失败' });
    }
    next();
}

function serializePost(doc) {
    const o = doc.toObject ? doc.toObject() : doc;
    o.id = String(o._id);
    delete o._id;
    delete o.__v;
    o.publishDate = o.publishDate ? new Date(o.publishDate).toISOString().slice(0, 10) : '';
    o.createdAt = o.createdAt ? new Date(o.createdAt).toISOString() : null;
    o.updatedAt = o.updatedAt ? new Date(o.updatedAt).toISOString() : null;
    return o;
}

function serializeLead(doc) {
    const o = doc.toObject ? doc.toObject() : doc;
    o.id = String(o._id);
    delete o._id;
    delete o.__v;
    o.createdAt = o.createdAt ? new Date(o.createdAt).toISOString() : null;
    return o;
}

// 历史白皮书预约记录标准化为报告领取记录的同构结构
function serializeLegacyWhitepaperLead(doc) {
    const o = doc.toObject ? doc.toObject() : doc;
    return {
        id: 'whitepaper-' + String(o._id),
        name: o.name || '',
        phone: o.phone || '',
        company: o.company || '',
        position: o.position || '',
        email: o.email || '',
        reportSlug: '',
        reportTitle: '白皮书预约',
        sourcePage: '/nqoc/whitepaper-apply',
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null
    };
}

function sortLeadsByCreatedAtDesc(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

function pad2(n) { return String(n).padStart(2, '0'); }

function autoSlug(prefix) {
    const d = new Date();
    return `${prefix}-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${Math.random().toString(36).slice(2, 6)}`;
}

async function resolveSlug(Model, rawSlug, prefix, currentId) {
    const slug = trimStr(rawSlug, 80).toLowerCase();
    if (slug && !SLUG_RE.test(slug)) {
        return { error: '网址别名只能用小写英文、数字和连字符' };
    }
    if (!slug) {
        for (let i = 0; i < 5; i++) {
            const candidate = autoSlug(prefix);
            if (!(await Model.exists({ slug: candidate }))) return { slug: candidate };
        }
        return { slug: autoSlug(prefix) };
    }
    const dup = await Model.findOne(currentId ? { slug, _id: { $ne: currentId } } : { slug });
    if (dup) return { error: '网址别名已被占用，换一个' };
    return { slug };
}

function pickPublishDate(v) {
    if (v === undefined || v === null || v === '') return new Date();
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
}

/* ------------------------------- 首页 Banner ------------------------------- */

function normalizeStats(v) {
    if (!Array.isArray(v)) return [];
    return v.slice(0, BANNER_MAX).map(s => ({
        value: trimStr(s && s.value, 6),
        label: trimStr(s && s.label, 14)
    })).filter(s => s.value || s.label);
}

function buildBanner(body, existing) {
    const b = existing ? {
        titlePrefix: existing.titlePrefix, titleHighlight: existing.titleHighlight,
        highlightOnNewLine: existing.highlightOnNewLine, titleLine2: existing.titleLine2,
        desc: existing.desc, primaryText: existing.primaryText, primaryAction: existing.primaryAction,
        primaryUrl: existing.primaryUrl, secondaryText: existing.secondaryText, secondaryUrl: existing.secondaryUrl,
        image: existing.image, imageAlt: existing.imageAlt, stats: normalizeStats(existing.stats),
        isOnline: existing.isOnline, sort: existing.sort
    } : {
        titlePrefix: '', titleHighlight: '', highlightOnNewLine: false, titleLine2: '',
        desc: '', primaryText: '', primaryAction: 'link', primaryUrl: '',
        secondaryText: '', secondaryUrl: '', image: '', imageAlt: '', stats: [],
        isOnline: true, sort: 0
    };

    if (has(body, 'titlePrefix')) b.titlePrefix = trimStr(body.titlePrefix, 14);
    if (has(body, 'titleHighlight')) b.titleHighlight = trimStr(body.titleHighlight, 14);
    if (has(body, 'highlightOnNewLine')) b.highlightOnNewLine = !!body.highlightOnNewLine;
    if (has(body, 'titleLine2')) b.titleLine2 = trimStr(body.titleLine2, 14);
    if (has(body, 'desc')) b.desc = trimStr(body.desc, 70);
    if (has(body, 'primaryText')) b.primaryText = trimStr(body.primaryText, 8);
    if (has(body, 'primaryAction')) b.primaryAction = body.primaryAction === 'report' ? 'report' : 'link';
    if (has(body, 'primaryUrl')) b.primaryUrl = cleanLink(body.primaryUrl);
    if (has(body, 'secondaryText')) b.secondaryText = trimStr(body.secondaryText, 8);
    if (has(body, 'secondaryUrl')) b.secondaryUrl = cleanLink(body.secondaryUrl);
    if (has(body, 'image')) b.image = trimStr(body.image, 500);
    if (has(body, 'imageAlt')) b.imageAlt = trimStr(body.imageAlt, 60);
    if (has(body, 'stats')) b.stats = normalizeStats(body.stats);
    if (has(body, 'isOnline')) b.isOnline = !!body.isOnline;
    if (has(body, 'sort')) b.sort = Number.isFinite(Number(body.sort)) ? Number(body.sort) : b.sort;

    if (b.primaryAction === 'report') b.primaryUrl = '';
    return b;
}

function validateBanner(b) {
    const errs = [];
    if (!b.titleHighlight) errs.push('标题高亮词');
    if (!b.primaryText) errs.push('主按钮文字');
    if (b.primaryAction === 'link' && !isAllowedLink(b.primaryUrl)) errs.push('主按钮链接');
    if (b.secondaryText && !isAllowedLink(b.secondaryUrl)) errs.push('次按钮链接');
    if (!b.image) errs.push('配图');
    if ((b.stats || []).some(s => !s.value || !s.label)) errs.push('数据锚点（数字与说明要成对）');
    return errs;
}

/* ------------------------- 新质观点 / 案例研究（同构） ------------------------- */

const POST_TYPES = {
    insights: { Model: NqocInsight, name: '新质观点', prefix: 'insight', perm: 'nqoc-insights', extraFields: true, extraSearch: ['author', 'source'] },
    cases: { Model: NqocCase, name: '案例研究', prefix: 'case', perm: 'nqoc-cases', extraFields: false, extraSearch: [] }
};

function buildPost(body, cfg, existing) {
    const d = existing ? {
        slug: existing.slug, title: existing.title, summary: existing.summary,
        cover: existing.cover, coverAlt: existing.coverAlt, body: existing.body,
        publishDate: existing.publishDate, status: existing.status, top: existing.top
    } : {
        slug: '', title: '', summary: '', cover: '', coverAlt: '', body: '',
        publishDate: new Date(), status: 'draft', top: false
    };
    if (has(body, 'slug')) d.slug = trimStr(body.slug, 80).toLowerCase();
    if (cfg.extraFields) {
        if (existing) {
            d.tags = (existing.tags || []).slice();
            d.author = existing.author;
            d.source = existing.source;
            d.credits = existing.credits;
        } else {
            d.tags = [];
            d.author = '';
            d.source = '';
            d.credits = '';
        }
    }

    if (has(body, 'title')) d.title = trimStr(body.title, 60);
    if (has(body, 'summary')) d.summary = trimStr(body.summary, 140);
    if (has(body, 'cover')) d.cover = trimStr(body.cover, 500);
    if (has(body, 'coverAlt')) d.coverAlt = trimStr(body.coverAlt, 60);
    if (has(body, 'body')) d.body = sanitizeBody(body.body);
    if (has(body, 'publishDate')) d.publishDate = pickPublishDate(body.publishDate);
    if (has(body, 'status')) d.status = pickStatus(body.status);
    if (has(body, 'top')) d.top = !!body.top;
    if (cfg.extraFields) {
        if (has(body, 'tags')) {
            d.tags = Array.isArray(body.tags)
                ? body.tags.map(t => trimStr(t, 8)).filter(Boolean).slice(0, 3)
                : [];
        }
        if (has(body, 'author')) d.author = trimStr(body.author, 30);
        if (has(body, 'source')) d.source = trimStr(body.source, 30);
        if (has(body, 'credits')) d.credits = trimStr(body.credits, 80);
    }
    return d;
}

// 发布必填校验；返回缺失项名称数组
function publishMissing(d) {
    const missing = [];
    if (!d.title) missing.push('标题');
    if (!d.summary) missing.push('摘要');
    if (!d.cover) missing.push('封面图');
    if (!d.body) missing.push('正文');
    return missing;
}

/* ------------------------------- 值得看见 ------------------------------- */

function buildVideo(body, existing) {
    const d = existing ? {
        slug: existing.slug, episode: existing.episode, title: existing.title,
        summary: existing.summary, cover: existing.cover, videoUrl: existing.videoUrl,
        duration: existing.duration,
        guests: (existing.guests || []).map(g => ({ name: g.name, title: g.title, company: g.company })),
        host: existing.host ? { name: existing.host.name, title: existing.host.title, company: existing.host.company } : undefined,
        publishDate: existing.publishDate, status: existing.status
    } : {
        slug: '', episode: '', title: '', summary: '', cover: '', videoUrl: '',
        duration: '', guests: [], host: undefined, publishDate: new Date(), status: 'draft'
    };

    if (has(body, 'episode')) d.episode = trimStr(body.episode, 6).toUpperCase();
    if (has(body, 'title')) d.title = trimStr(body.title, 60);
    if (has(body, 'summary')) d.summary = trimStr(body.summary, 300);
    if (has(body, 'cover')) d.cover = trimStr(body.cover, 500);
    if (has(body, 'videoUrl')) d.videoUrl = trimStr(body.videoUrl, 500);
    if (has(body, 'duration')) d.duration = trimStr(body.duration, 8);
    if (has(body, 'guests')) {
        d.guests = Array.isArray(body.guests)
            ? body.guests.slice(0, 2).map(g => ({
                name: trimStr(g && g.name, 12),
                title: trimStr(g && g.title, 30),
                company: trimStr(g && g.company, 30)
            })).filter(g => g.name)
            : [];
    }
    if (has(body, 'host') && body.host && typeof body.host === 'object') {
        d.host = {
            name: trimStr(body.host.name, 12),
            title: trimStr(body.host.title, 30),
            company: trimStr(body.host.company, 30)
        };
    }
    if (has(body, 'publishDate')) d.publishDate = pickPublishDate(body.publishDate);
    if (has(body, 'status')) d.status = pickStatus(body.status);
    return d;
}

async function nextEpisode() {
    const docs = await NqocVideo.find({}, 'episode').lean();
    let max = 0;
    docs.forEach(d => {
        const m = EPISODE_RE.exec(d.episode || '');
        if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'E' + String(max + 1).padStart(2, '0');
}

function videoPublishMissing(d) {
    const missing = [];
    if (!d.title) missing.push('标题');
    if (!d.cover) missing.push('封面图');
    if (!d.videoUrl) missing.push('视频文件');
    if (!(d.guests && d.guests.length)) missing.push('对谈嘉宾');
    if (!d.episode || !EPISODE_RE.test(d.episode)) missing.push('期数');
    return missing;
}

/* ---------------------------- 报告领取记录（只读） ---------------------------- */

function buildLeadQuery(req) {
    const query = {};
    const range = ['1', '7', '30'].includes(String(req.query.range)) ? Number(req.query.range) : 0;
    if (range) query.createdAt = { $gte: new Date(Date.now() - range * 24 * 3600 * 1000) };
    const q = trimStr(req.query.q, 100);
    if (q) {
        const rx = { $regex: escapeRegex(q), $options: 'i' };
        query.$or = [{ name: rx }, { company: rx }, { phone: rx }, { email: rx }, { position: rx }];
    }
    return { query, range, keyword: q };
}

/* ------------------------------- 前台限流 ------------------------------- */

const applyLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: '提交过于频繁，请稍后再试' }
});

function pickReport(reportSlug) {
    const published = REPORTS.filter(r => r.status === 'published')
        .sort((a, b) => String(b.publishDate).localeCompare(String(a.publishDate)));
    if (!published.length) return null;
    const wanted = trimStr(reportSlug, 120);
    return published.find(r => r.slug === wanted) || published[0];
}

/* --------------------------- 报告下载凭证与文件 --------------------------- */

// 领取成功后发出的下载链接有效期（小时）与同一凭证的最大下载次数，均可通过环境变量调整。
const REPORT_TOKEN_TTL_HOURS = Number(process.env.NQOC_REPORT_TOKEN_TTL_HOURS) > 0
    ? Number(process.env.NQOC_REPORT_TOKEN_TTL_HOURS) : 24;
const REPORT_MAX_DOWNLOADS = Number(process.env.NQOC_REPORT_MAX_DOWNLOADS) > 0
    ? Number(process.env.NQOC_REPORT_MAX_DOWNLOADS) : 10;
const REPORT_EXPIRED_PATH = '/nqoc/report-expired';

function reportTokenSecret() {
    return process.env.NQOC_REPORT_TOKEN_SECRET
        || process.env.JWT_SECRET
        || process.env.SECRET_KEY
        || 'nqoc-report-dev-secret';
}

// 带签名的令牌：payload（记录 id / 报告 slug / 签发时间）+ HMAC，不可猜测，绑定到这条领取记录。
function signReportToken(leadId, reportSlug) {
    const payload = Buffer.from(JSON.stringify({
        i: String(leadId),
        s: String(reportSlug || ''),
        t: Date.now()
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', reportTokenSecret()).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

function verifyReportToken(token) {
    const raw = String(token || '');
    const dot = raw.indexOf('.');
    if (dot <= 0) return null;
    const payload = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const expected = crypto.createHmac('sha256', reportTokenSecret()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch (e) {
        return null;
    }
    if (!data || !data.i || !data.t) return null;
    if (Date.now() - Number(data.t) > REPORT_TOKEN_TTL_HOURS * 3600 * 1000) return null;
    return data;
}

function findReportConfig(slug) {
    return REPORTS.find(r => r.slug === slug) || null;
}

// fileUrl 既可能是私有对象存储地址，也可能是站内相对路径；统一读成 Buffer。
async function readReportBuffer(fileUrl) {
    const target = String(fileUrl || '').trim();
    if (!target) return null;
    if (/^https?:\/\//i.test(target)) {
        const resp = await axios.get(target, { responseType: 'arraybuffer', timeout: 30000 });
        return Buffer.from(resp.data);
    }
    const root = path.join(__dirname, '..', '..', 'public');
    const abs = path.resolve(root, target.replace(/^\/+/, ''));
    if (!abs.startsWith(root + path.sep)) return null;   // 防止越出 public
    return fs.readFileSync(abs);
}

/* ------------------------------- 路由注册 ------------------------------- */

/**
 * @param {Function} authRequired 认证中间件
 * @param {Function} requirePerm   单权限校验
 * @param {Function} requireAnyPerm 任一权限校验
 */
function initNqocRoutes(authRequired, requirePerm, requireAnyPerm) {

    /* ---- 首页 Banner ---- */

    router.get('/admin/nqoc/banners', authRequired, requirePerm('nqoc-banner:list'), async (req, res) => {
        try {
            const banners = await NqocBanner.find({}).sort({ sort: 1, _id: 1 });
            res.json(banners.map(serializePost));
        } catch (e) {
            return sendInternalError(res, 'List nqoc banners error:', e);
        }
    });

    router.post('/admin/nqoc/banners', authRequired, csrfGuard, requirePerm('nqoc-banner:create'), async (req, res) => {
        try {
            const count = await NqocBanner.countDocuments({});
            if (count >= BANNER_MAX) {
                return res.status(400).json({ error: `最多 ${BANNER_MAX} 张 Banner，请先删除一张` });
            }
            const payload = buildBanner(req.body);
            const errs = validateBanner(payload);
            if (errs.length) return res.status(400).json({ error: '请先填写：' + errs.join('、') });

            if (!payload.sort) {
                const last = await NqocBanner.findOne({}).sort({ sort: -1 });
                payload.sort = last ? (Number(last.sort) || 0) + 1 : 1;
            }
            const doc = await NqocBanner.create(payload);
            await logOp('create', '新质组织-Banner', `新增 Banner：${doc.titleHighlight}`, req.user && req.user.username);
            res.json(serializePost(doc));
        } catch (e) {
            return sendInternalError(res, 'Create nqoc banner error:', e);
        }
    });

    // 注意：sort 必须在 :id 之前注册，否则会被当成 id
    router.put('/admin/nqoc/banners/sort', authRequired, csrfGuard, requirePerm('nqoc-banner:update'), async (req, res) => {
        try {
            const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(String) : [];
            if (!ids.length) return res.status(400).json({ error: '缺少排序数据' });
            await Promise.all(ids.map((id, index) => NqocBanner.updateOne({ _id: id }, { $set: { sort: index + 1 } })));
            await logOp('update', '新质组织-Banner', `调整轮播顺序（${ids.length} 张）`, req.user && req.user.username);
            res.json({ success: true });
        } catch (e) {
            return sendInternalError(res, 'Sort nqoc banners error:', e);
        }
    });

    router.put('/admin/nqoc/banners/:id', authRequired, csrfGuard, requirePerm('nqoc-banner:update'), async (req, res) => {
        try {
            const existing = await NqocBanner.findById(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Banner 不存在' });

            const payload = buildBanner(req.body, existing);
            const errs = validateBanner(payload);
            if (errs.length) return res.status(400).json({ error: '请先填写：' + errs.join('、') });

            // 最后一张展示中的不能隐藏
            if (existing.isOnline && !payload.isOnline) {
                const onlineCount = await NqocBanner.countDocuments({ isOnline: true, _id: { $ne: existing._id } });
                if (onlineCount === 0) return res.status(400).json({ error: '至少要保留 1 张展示中的 Banner' });
            }

            Object.assign(existing, payload);
            await existing.save();
            await logOp('update', '新质组织-Banner', `编辑 Banner：${existing.titleHighlight}`, req.user && req.user.username);
            res.json(serializePost(existing));
        } catch (e) {
            return sendInternalError(res, 'Update nqoc banner error:', e);
        }
    });

    router.delete('/admin/nqoc/banners/:id', authRequired, csrfGuard, requirePerm('nqoc-banner:delete'), async (req, res) => {
        try {
            const existing = await NqocBanner.findById(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Banner 不存在' });

            if (existing.isOnline) {
                const onlineCount = await NqocBanner.countDocuments({ isOnline: true, _id: { $ne: existing._id } });
                if (onlineCount === 0) return res.status(400).json({ error: '至少要保留 1 张展示中的 Banner' });
            }

            await existing.deleteOne();
            await logOp('delete', '新质组织-Banner', `删除 Banner：${existing.titleHighlight}`, req.user && req.user.username);
            res.json({ success: true });
        } catch (e) {
            return sendInternalError(res, 'Delete nqoc banner error:', e);
        }
    });

    /* ---- 新质观点 / 案例研究 ---- */

    [['insights', POST_TYPES.insights], ['cases', POST_TYPES.cases]].forEach(([segment, cfg]) => {
        const base = `/admin/nqoc/${segment}`;

        router.get(base, authRequired, requirePerm(`${cfg.perm}:list`), async (req, res) => {
            try {
                const query = {};
                const status = trimStr(req.query.status);
                if (STATUSES.includes(status)) query.status = status;
                const q = trimStr(req.query.q, 100);
                if (q) {
                    const rx = { $regex: escapeRegex(q), $options: 'i' };
                    const or = [{ title: rx }, { slug: rx }];
                    cfg.extraSearch.forEach(f => or.push({ [f]: rx }));
                    query.$or = or;
                }
                const docs = await cfg.Model.find(query).sort({ top: -1, publishDate: -1, _id: -1 });
                res.json(docs.map(serializePost));
            } catch (e) {
                return sendInternalError(res, `List nqoc ${segment} error:`, e);
            }
        });

        router.post(base, authRequired, csrfGuard, requirePerm(`${cfg.perm}:create`), async (req, res) => {
            try {
                const payload = buildPost(req.body, cfg);
                if (!payload.title) return res.status(400).json({ error: '请先填写标题' });

                const slugResult = await resolveSlug(cfg.Model, payload.slug, cfg.prefix);
                if (slugResult.error) return res.status(400).json({ error: slugResult.error });
                payload.slug = slugResult.slug;

                if (payload.status === 'published') {
                    const missing = publishMissing(payload);
                    if (missing.length) return res.status(400).json({ error: '发布前请先填写：' + missing.join('、') });
                    payload.slugLocked = true;
                } else {
                    payload.status = 'draft';
                    payload.top = false;
                }

                const doc = await cfg.Model.create(payload);
                if (doc.status === 'published' && doc.slug) {
                    pushPage(`nqoc/${segment}/${encodeURIComponent(doc.slug)}`);
                }
                await logOp('create', `新质组织-${cfg.name}`, `新增：${doc.title}`, req.user && req.user.username);
                res.json(serializePost(doc));
            } catch (e) {
                return sendInternalError(res, `Create nqoc ${segment} error:`, e);
            }
        });

        router.put(`${base}/:id`, authRequired, csrfGuard, requirePerm(`${cfg.perm}:update`), async (req, res) => {
            try {
                const existing = await cfg.Model.findById(req.params.id);
                if (!existing) return res.status(404).json({ error: `${cfg.name}不存在` });

                const payload = buildPost(req.body, cfg, existing);

                // slug：已锁定则忽略改动，否则校验唯一性
                if (existing.slugLocked) {
                    payload.slug = existing.slug;
                } else {
                    const slugResult = await resolveSlug(cfg.Model, payload.slug, cfg.prefix, existing._id);
                    if (slugResult.error) return res.status(400).json({ error: slugResult.error });
                    payload.slug = slugResult.slug;
                }

                const publishing = payload.status === 'published';
                if (publishing) {
                    const missing = publishMissing(payload);
                    if (missing.length) return res.status(400).json({ error: '发布前请先填写：' + missing.join('、') });
                    payload.slugLocked = true;
                } else {
                    payload.top = false; // 草稿 / 下架一律取消置顶
                }

                Object.assign(existing, payload);
                await existing.save();

                if (publishing && existing.slug) {
                    pushPage(`nqoc/${segment}/${encodeURIComponent(existing.slug)}`);
                }

                await logOp('update', `新质组织-${cfg.name}`, `${publishing ? '发布' : '保存'}：${existing.title}`, req.user && req.user.username);
                res.json(serializePost(existing));
            } catch (e) {
                return sendInternalError(res, `Update nqoc ${segment} error:`, e);
            }
        });

        router.delete(`${base}/:id`, authRequired, csrfGuard, requirePerm(`${cfg.perm}:delete`), async (req, res) => {
            try {
                const existing = await cfg.Model.findById(req.params.id);
                if (!existing) return res.status(404).json({ error: `${cfg.name}不存在` });
                await existing.deleteOne();
                await logOp('delete', `新质组织-${cfg.name}`, `删除：${existing.title}`, req.user && req.user.username);
                res.json({ success: true });
            } catch (e) {
                return sendInternalError(res, `Delete nqoc ${segment} error:`, e);
            }
        });
    });

    /* ---- 值得看见 ---- */

    router.get('/admin/nqoc/videos', authRequired, requirePerm('nqoc-videos:list'), async (req, res) => {
        try {
            const query = {};
            const status = trimStr(req.query.status);
            if (STATUSES.includes(status)) query.status = status;
            const q = trimStr(req.query.q, 100);
            if (q) {
                const rx = { $regex: escapeRegex(q), $options: 'i' };
                query.$or = [{ title: rx }, { episode: rx }, { slug: rx }, { 'guests.name': rx }];
            }
            const docs = await NqocVideo.find(query).sort({ publishDate: -1, _id: -1 });
            res.json(docs.map(serializePost));
        } catch (e) {
            return sendInternalError(res, 'List nqoc videos error:', e);
        }
    });

    router.post('/admin/nqoc/videos', authRequired, csrfGuard, requirePerm('nqoc-videos:create'), async (req, res) => {
        try {
            const payload = buildVideo(req.body);
            if (!payload.title) return res.status(400).json({ error: '请先填写标题' });

            if (!payload.episode) payload.episode = await nextEpisode();
            if (!EPISODE_RE.test(payload.episode)) return res.status(400).json({ error: '期数格式形如 E01' });
            const dupEp = await NqocVideo.findOne({ episode: payload.episode });
            if (dupEp) return res.status(400).json({ error: `期数 ${payload.episode} 已存在` });

            const slugResult = await resolveSlug(NqocVideo, payload.slug, 'ep');
            if (slugResult.error) return res.status(400).json({ error: slugResult.error });
            payload.slug = slugResult.slug;

            if (payload.status === 'published') {
                const missing = videoPublishMissing(payload);
                if (missing.length) return res.status(400).json({ error: '发布前请先填写：' + missing.join('、') });
                payload.slugLocked = true;
            } else {
                payload.status = 'draft';
            }

            const doc = await NqocVideo.create(payload);
            if (doc.status === 'published' && doc.slug) {
                pushPage(`nqoc/worth-seeing/${encodeURIComponent(doc.slug)}`);
            }
            await logOp('create', '新质组织-值得看见', `新增：${doc.episode} ${doc.title}`, req.user && req.user.username);
            res.json(serializePost(doc));
        } catch (e) {
            return sendInternalError(res, 'Create nqoc video error:', e);
        }
    });

    router.put('/admin/nqoc/videos/:id', authRequired, csrfGuard, requirePerm('nqoc-videos:update'), async (req, res) => {
        try {
            const existing = await NqocVideo.findById(req.params.id);
            if (!existing) return res.status(404).json({ error: '节目不存在' });

            const payload = buildVideo(req.body, existing);

            if (!payload.episode) payload.episode = existing.episode || await nextEpisode();
            if (!EPISODE_RE.test(payload.episode)) return res.status(400).json({ error: '期数格式形如 E01' });
            const dupEp = await NqocVideo.findOne({ episode: payload.episode, _id: { $ne: existing._id } });
            if (dupEp) return res.status(400).json({ error: `期数 ${payload.episode} 已存在` });

            if (existing.slugLocked) {
                payload.slug = existing.slug;
            } else {
                const slugResult = await resolveSlug(NqocVideo, payload.slug, 'ep', existing._id);
                if (slugResult.error) return res.status(400).json({ error: slugResult.error });
                payload.slug = slugResult.slug;
            }

            const publishing = payload.status === 'published';
            if (publishing) {
                const missing = videoPublishMissing(payload);
                if (missing.length) return res.status(400).json({ error: '发布前请先填写：' + missing.join('、') });
                payload.slugLocked = true;
            }

            Object.assign(existing, payload);
            await existing.save();
            if (publishing && existing.slug) {
                pushPage(`nqoc/worth-seeing/${encodeURIComponent(existing.slug)}`);
            }
            await logOp('update', '新质组织-值得看见', `${publishing ? '发布' : '保存'}：${existing.episode} ${existing.title}`, req.user && req.user.username);
            res.json(serializePost(existing));
        } catch (e) {
            return sendInternalError(res, 'Update nqoc video error:', e);
        }
    });

    router.delete('/admin/nqoc/videos/:id', authRequired, csrfGuard, requirePerm('nqoc-videos:delete'), async (req, res) => {
        try {
            const existing = await NqocVideo.findById(req.params.id);
            if (!existing) return res.status(404).json({ error: '节目不存在' });
            await existing.deleteOne();
            await logOp('delete', '新质组织-值得看见', `删除：${existing.episode} ${existing.title}`, req.user && req.user.username);
            res.json({ success: true });
        } catch (e) {
            return sendInternalError(res, 'Delete nqoc video error:', e);
        }
    });

    /* ---- 报告领取记录 ---- */

    router.get('/admin/nqoc/report-leads', authRequired, requirePerm('nqoc-report-leads:list'), async (req, res) => {
        try {
            const { query } = buildLeadQuery(req);
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const [leads, legacyLeads, today, todayWp, week7, week7Wp, all, allWp, companies, wpCompanies] = await Promise.all([
                NqocReportLead.find(query).sort({ createdAt: -1 }).limit(5000),
                NqocWhitepaperRequest.find(query).sort({ createdAt: -1 }).limit(5000),
                NqocReportLead.countDocuments({ createdAt: { $gte: startOfDay } }),
                NqocWhitepaperRequest.countDocuments({ createdAt: { $gte: startOfDay } }),
                NqocReportLead.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }),
                NqocWhitepaperRequest.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }),
                NqocReportLead.countDocuments({}),
                NqocWhitepaperRequest.countDocuments({}),
                NqocReportLead.distinct('company'),
                NqocWhitepaperRequest.distinct('company')
            ]);

            const merged = leads.map(serializeLead)
                .concat(legacyLeads.map(serializeLegacyWhitepaperLead))
                .sort(sortLeadsByCreatedAtDesc);

            res.json({
                leads: merged,
                total: merged.length,
                stats: {
                    today: today + todayWp,
                    week7: week7 + week7Wp,
                    all: all + allWp,
                    companies: new Set(companies.concat(wpCompanies).filter(Boolean)).size
                }
            });
        } catch (e) {
            return sendInternalError(res, 'List nqoc report leads error:', e);
        }
    });

    // 注意：export 必须在任何 /report-leads/:id 之前（当前无 :id 路由，保留顺序以防后续新增）
    router.get('/admin/nqoc/report-leads/export', authRequired, requirePerm('nqoc-report-leads:export'), async (req, res) => {
        try {
            const { query, range, keyword } = buildLeadQuery(req);
            const [leads, legacyLeads] = await Promise.all([
                NqocReportLead.find(query).sort({ createdAt: -1 }).limit(5000),
                NqocWhitepaperRequest.find(query).sort({ createdAt: -1 }).limit(5000)
            ]);
            leads.push(...legacyLeads.map(serializeLegacyWhitepaperLead));
            leads.sort(sortLeadsByCreatedAtDesc);

            const now = new Date();
            const stamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
            const cond = [
                range ? ({ 1: '今天', 7: '近 7 天', 30: '近 30 天' })[range] : '全部时间',
                keyword ? `关键词「${keyword}」` : ''
            ].filter(Boolean).join('，');

            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet('报告领取记录');
            ws.columns = [
                { key: 'idx', width: 7 }, { key: 'name', width: 13 }, { key: 'phone', width: 16 },
                { key: 'company', width: 30 }, { key: 'position', width: 22 }, { key: 'email', width: 30 },
                { key: 'report', width: 42 }, { key: 'page', width: 46 }, { key: 'time', width: 19 }
            ];

            const thin = { style: 'thin', color: { argb: 'FFEAE9ED' } };
            const border = { top: thin, left: thin, bottom: thin, right: thin };
            // 所有单元格按文本写入：手机号不变科学计数，=+-@ 开头也不会被当公式
            const setText = (cell, v) => {
                const s = v == null ? '' : String(v);
                cell.value = s ? { richText: [{ text: s }] } : '';
                cell.numFmt = '@';
            };

            ws.mergeCells('A1:I1');
            ws.getCell('A1').value = '新质组织 · 报告领取记录';
            ws.getCell('A1').font = { name: '微软雅黑', size: 14, bold: true, color: { argb: 'FF211E28' } };
            ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
            ws.getRow(1).height = 28;

            ws.mergeCells('A2:I2');
            ws.getCell('A2').value = `导出时间 ${now.toLocaleString('zh-CN')}　｜　共 ${leads.length} 条　｜　筛选范围：${cond}`;
            ws.getCell('A2').font = { name: '微软雅黑', size: 10, color: { argb: 'FF7A6F92' } };
            ws.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
            ws.getRow(2).height = 20;

            const headerRow = ws.getRow(3);
            ['序号', '姓名', '手机号', '公司', '职位', '邮箱', '领取的报告', '提交页面', '提交时间'].forEach((h, i) => {
                const cell = headerRow.getCell(i + 1);
                cell.value = h;
                cell.font = { name: '微软雅黑', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C4DFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.border = border;
            });
            headerRow.height = 22;

            const fmtTime = d => d ? new Date(d).toLocaleString('zh-CN') : '';
            leads.forEach((l, i) => {
                const row = ws.addRow([]);
                const values = [i + 1, l.name, l.phone, l.company, l.position, l.email, l.reportTitle, l.sourcePage, fmtTime(l.createdAt)];
                values.forEach((v, ci) => {
                    const cell = row.getCell(ci + 1);
                    setText(cell, v);
                    cell.font = { name: '微软雅黑', size: 10, color: { argb: 'FF211E28' } };
                    cell.border = border;
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    if (i % 2 === 1) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F3FF' } };
                    }
                });
            });

            ws.views = [{ state: 'frozen', ySplit: 3 }];
            if (leads.length) {
                ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + leads.length, column: 9 } };
            }
            ws.pageSetup = {
                paperSize: 9,
                orientation: 'landscape',
                fitToWidth: 1,
                fitToHeight: 0,
                printTitlesRow: '1:3',
                margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
            };

            const fileName = `新质组织_报告领取记录_${stamp}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="nqoc-report-leads-${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
            await workbook.xlsx.write(res);
            res.end();

            await logOp('export', '新质组织-报告领取记录', `导出 ${leads.length} 条（${cond}）`, req.user && req.user.username);
        } catch (e) {
            console.error('Export nqoc report leads error:', e);
            if (!res.headersSent) res.status(500).send('导出失败');
        }
    });

    /* ---- 前台：报告领取 ---- */

    router.post('/nqoc/reports/apply', applyLimiter, async (req, res) => {
        try {
            const body = req.body || {};

            // 蜜罐：机器人填了就假装成功，直接丢弃
            if (trimStr(body.website)) return res.json({ success: true, reportUrl: null });

            const name = trimStr(body.name, 30);
            const company = trimStr(body.company, 60);
            const position = trimStr(body.position, 40);
            const email = trimStr(body.email, 100);
            const phone = trimStr(body.phone, 20).replace(/[\s-]/g, '');

            const missing = [];
            if (!name) missing.push('姓名');
            if (!phone) missing.push('手机号');
            if (!company) missing.push('公司');
            if (!position) missing.push('职位');
            if (!email) missing.push('邮箱');
            if (missing.length) return res.status(400).json({ success: false, error: '请填写：' + missing.join('、') });
            if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ success: false, error: '手机号格式不正确' });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, error: '邮箱格式不正确' });

            const sourceRaw = trimStr(body.sourcePage, 200);
            const sourcePage = sourceRaw.startsWith('/nqoc') ? sourceRaw : '';

            // 同一手机号短时间内重复提交直接拒绝
            const recent = await NqocReportLead.findOne({ phone, createdAt: { $gte: new Date(Date.now() - 60 * 1000) } });
            if (recent) return res.status(429).json({ success: false, error: '提交过于频繁，请稍后再试' });

            const report = pickReport(body.reportSlug);
            const lead = await NqocReportLead.create({
                name, phone, company, position, email,
                reportSlug: report ? report.slug : '',
                reportTitle: report ? report.title : '',
                sourcePage
            });

            // 报告文件已就位时直接下发带凭证的下载地址；尚未上传则返回 null，前台提示「还在准备中」。
            const reportUrl = report && report.fileUrl
                ? `/api/nqoc/reports/download?t=${encodeURIComponent(signReportToken(lead._id, report.slug))}`
                : null;

            res.json({ success: true, reportUrl });
        } catch (e) {
            return sendInternalError(res, 'Nqoc report apply error:', e);
        }
    });

    // 凭证下载：校验令牌 → 输出 PDF 文件流（inline，浏览器直接打开）；任何异常一律落到失效页
    router.get('/nqoc/reports/download', async (req, res) => {
        try {
            const data = verifyReportToken(req.query.t);
            if (!data) return res.redirect(302, REPORT_EXPIRED_PATH);

            const lead = await NqocReportLead.findById(data.i).catch(() => null);
            if (!lead) return res.redirect(302, REPORT_EXPIRED_PATH);
            if ((lead.downloadCount || 0) >= REPORT_MAX_DOWNLOADS) return res.redirect(302, REPORT_EXPIRED_PATH);

            const report = findReportConfig(lead.reportSlug || data.s);
            if (!report || !report.fileUrl) return res.redirect(302, REPORT_EXPIRED_PATH);

            const buffer = await readReportBuffer(report.fileUrl);
            if (!buffer || !buffer.length) return res.redirect(302, REPORT_EXPIRED_PATH);

            const title = report.title || lead.reportTitle || '研究报告';
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${report.slug || 'report'}.pdf"; filename*=UTF-8''${encodeURIComponent(title)}.pdf`);
            res.setHeader('Cache-Control', 'private, no-store');
            res.setHeader('X-Robots-Tag', 'noindex');
            res.setHeader('Content-Length', buffer.length);
            res.end(buffer);

            await NqocReportLead.updateOne(
                { _id: lead._id },
                { $inc: { downloadCount: 1 }, $set: { lastDownloadedAt: new Date() } }
            );
        } catch (e) {
            console.error('Nqoc report download error:', e.message || e);
            if (!res.headersSent) return res.redirect(302, REPORT_EXPIRED_PATH);
            res.end();
        }
    });

    return router;
}

module.exports = initNqocRoutes;
