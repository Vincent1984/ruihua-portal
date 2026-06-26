if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const crypto = require('crypto');
const dns = require('dns');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');

// Import Models
const Appointment = require('./models/Appointment');
const Article = require('./models/Article');
const ArticleHistory = require('./models/ArticleHistory');
const OperationLog = require('./models/OperationLog');
const Role = require('./models/Role');
const Admin = require('./models/admin'); // Corrected model name
const MaturitySubmission = require('./models/MaturitySubmission');
const EfficiencySubmission = require('./models/EfficiencySubmission');
const Faq = require('./models/Faq');
const Category = require('./models/Category');
const Setting = require('./models/Setting');
const Subscription = require('./models/Subscription');
const WhitepaperSubmission = require('./models/WhitepaperSubmission');
const VerificationCode = require('./models/VerificationCode');
const Video = require('./models/Video');
const SeoConfig = require('./models/SeoConfig');
const quizData = require('./config/quizData'); // Import Quiz Data
const efficiencyQuizData = require('./config/efficiencyQuizData'); // Import Efficiency Quiz Data
const XLSX = require('xlsx'); // Import xlsx
const xss = require('xss');
const { slugify } = require('transliteration');
const { toDigitsFromSha256, clipDigits, ensureUniqueDigits } = require('./utils/numericName');
const FileNameMap = require('./models/FileNameMap');
const { renderInsightCard, renderFaqItem } = require('./utils/homeContentRenderer');
const domainNormalizer = require('./middleware/domainNormalizer');
const legacyRedirects = require('./middleware/legacyRedirects');
const { gatherPermissions } = require('./middleware/adminPageAuth');
const { PERMISSION_GROUPS, PERMISSION_CODES, validatePermissions, normalizePermissions } = require('./config/permissions');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Trust the first proxy (Kubernetes ingress/load balancer)
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY;
if (!SECRET_KEY) {
    if (process.env.NODE_ENV === 'production') {
        console.error('[FATAL] JWT secret is missing. Please set JWT_SECRET.');
        process.exit(1);
    }
    console.warn('[WARN] JWT_SECRET is missing, using temporary dev secret.');
}
const RUNTIME_SECRET_KEY = SECRET_KEY || `dev-secret-${crypto.randomUUID()}`;

// Escape special regex characters in user input for safe $regex queries
function escapeRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTosEndpoint(inputEndpoint) {
    const raw = String(inputEndpoint || '').trim();
    if (!raw) return '';
    const hasProto = /^https?:\/\//i.test(raw);
    const withProto = hasProto ? raw : `https://${raw}`;
    // S3Client should use S3-compatible endpoint
    return withProto.replace('://tos-cn-', '://tos-s3-cn-');
}
function resolveTosSecretAccessKey() {
    const raw = String(process.env.TOS_SECRET_KEY || '').trim();
    const encodedFlag = String(process.env.TOS_SECRET_KEY_BASE64 || '').toLowerCase();
    const shouldDecode = encodedFlag === '1' || encodedFlag === 'true' || encodedFlag === 'yes';
    if (!shouldDecode) return raw;
    try {
        return Buffer.from(raw, 'base64').toString('utf8').trim() || raw;
    } catch (e) {
        console.error('Base64 decode error:', e.message || e);
        return raw;
    }
}
const useTosUpload = Boolean(
    process.env.TOS_ACCESS_KEY &&
    process.env.TOS_SECRET_KEY &&
    process.env.TOS_BUCKET_NAME &&
    process.env.TOS_PUBLIC_URL
);
const tosEndpoint = normalizeTosEndpoint(process.env.TOS_ENDPOINT || 'https://tos-cn-beijing.volces.com');
const tosSecretAccessKey = resolveTosSecretAccessKey();
const tosClient = useTosUpload
    ? new S3Client({
        region: process.env.TOS_REGION || 'cn-beijing',
        endpoint: tosEndpoint,
        credentials: {
            accessKeyId: process.env.TOS_ACCESS_KEY,
            secretAccessKey: tosSecretAccessKey
        }
    })
    : null;
if (useTosUpload) {
    console.log(`[UPLOAD] TOS object storage enabled for /api/upload (endpoint: ${tosEndpoint})`);
} else {
    console.log('[UPLOAD] TOS object storage disabled, fallback to local public/uploads');
}

function sendInternalError(res, logLabel, err) {
    if (logLabel) console.error(logLabel, err);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const articleHtmlSanitizer = new xss.FilterXSS({
    whiteList: {
        ...xss.whiteList,
        h1: ['class'], h2: ['class'], h3: ['class'], h4: ['class'], h5: ['class'], h6: ['class'],
        p: ['class'],
        span: ['class'],
        div: ['class'],
        a: ['href', 'title', 'target', 'rel', 'class'],
        img: ['src', 'alt', 'title', 'width', 'height', 'class'],
        ul: ['class'], ol: ['class'], li: ['class'],
        blockquote: ['class'],
        code: ['class'], pre: ['class'],
        table: ['class'], thead: ['class'], tbody: ['class'], tr: ['class'], th: ['class'], td: ['class'],
        iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder']
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script'],
    onTagAttr: function(tag, name, value) {
        // Only allow iframe src from whitelisted domains
        if (tag === 'iframe' && name === 'src') {
            try {
                const url = new URL(value);
                const allowedHosts = ['player.bilibili.com', 'www.youtube.com', 'youtube.com', 'v.qq.com'];
                if (allowedHosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
                    return name + '="' + xss.safeAttrValue(value) + '"';
                }
            } catch(e) {}
            return '';
        }
    }
});

function sanitizeArticlePayload(body = {}) {
    const payload = { ...body };
    if (typeof payload.content === 'string') {
        payload.content = articleHtmlSanitizer.process(payload.content);
    }
    if (typeof payload.summary === 'string') payload.summary = xss(payload.summary);
    if (typeof payload.seoDescription === 'string') payload.seoDescription = xss(payload.seoDescription);
    if (typeof payload.title === 'string') payload.title = xss(payload.title);
    return payload;
}

// Domain Normalization Middleware (Should be early)
app.use(domainNormalizer);
app.use(legacyRedirects);
app.use((req, res, next) => {
    if (req.path === '/ai-strategic-special' || req.path === '/ai-strategic-special/' || req.path === '/ai-strategic-special.html') {
        return res.sendFile(path.join(__dirname, 'ai-strategic-special.html'));
    }
    next();
});

// Reusable Footer Injection for SSR pages
const injectFooterHTML = (document) => {
    const currentYear = new Date().getFullYear();
    const footerHtml = `
    <footer class="bg-slate-900 pt-16 pb-8 text-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex flex-col md:flex-row justify-between gap-10 mb-10">
                <div class="md:max-w-xl text-left">
                    <a href="/" class="inline-block mb-4">
                        <img src="/images/logo.png" alt="瑞华智策" class="footer-logo block h-10 w-auto">
                    </a>
                    <p class="text-slate-400 text-sm mb-4">瑞华智策以「咨询+技术+服务」三位一体的模式，助力企业构建「人力资本价值经营」体系，打造 AI 时代持续增长的韧性组织。</p>
                    <div class="flex items-center gap-2 text-sm text-slate-500"><i class="fas fa-building"></i><span>人瑞人才</span><span class="text-brand-400 font-medium">(6919.HK)</span><span>旗下全资子公司</span></div>
                </div>
                <div>
                    <h4 class="font-bold text-white mb-4">联系我们</h4>
                    <ul class="space-y-2 text-sm text-slate-400 mb-4">
                        <li class="flex items-center gap-2"><i class="fas fa-envelope text-brand-400"></i><a href="mailto:rxzj@renruihr.com" class="hover:text-white transition">rxzj@renruihr.com</a></li>
                        <li class="flex items-center gap-2"><i class="fas fa-phone text-brand-400"></i><a href="/productivity/" class="hover:text-white transition">预约专家咨询</a></li>
                        <li class="flex items-center gap-2"><i class="fas fa-location-dot text-brand-400"></i><span>上海 · 北京 · 深圳 · 成都</span></li>
                    </ul>
                </div>
            </div>
            <div class="pt-6 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-sm text-slate-500">
                    <p>© ${currentYear} 瑞华智策 Ruihua Consulting. All rights reserved.</p>
                    <span class="hidden md:inline text-slate-700">|</span>
                    <a href="https://beian.miit.gov.cn/" target="_blank" class="hover:text-white transition">沪ICP备12042344号-24</a>
                </div>
                <div class="flex gap-6 text-sm text-slate-500"><a href="/privacy/" class="hover:text-white transition">隐私政策</a></div>
            </div>
        </div>
    </footer>
    `;
    const footerPlaceholder = document.getElementById('footer-container');
    if (footerPlaceholder) {
        footerPlaceholder.innerHTML = footerHtml;
    }
};

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:", "picsum.photos", "placehold.co", "https://hm.baidu.com", "unpkg.com", "https://*.volces.com"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdn.quilljs.com", "https://cdn.bootcdn.net", "unpkg.com", "https://*.volces.com"],
            mediaSrc: ["'self'", "blob:", "https://*.volces.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.tailwindcss.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "cdn.quilljs.com", "cdn.bootcdn.net", "https://hm.baidu.com"],
            scriptSrcAttr: ["'unsafe-inline'"], 
            styleSrc: ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "cdn.jsdelivr.net", "cdn.quilljs.com", "cdn.bootcdn.net"],
            fontSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.gstatic.com", "cdn.jsdelivr.net", "cdn.bootcdn.net"],
            upgradeInsecureRequests: null, // Disable auto-upgrade for localhost dev environment
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Global Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Limit each IP to 300 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', (req, res, next) => {
    if (req.path.startsWith('/public/activity/register/') || req.path.startsWith('/api/public/activity/register/')) return next();
    return limiter(req, res, next);
});

app.use('/api/', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

// Stricter Rate Limiting for Login - REMOVED

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (allowedOrigins.length > 0) {
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(null, false);
        },
        credentials: true
    }));
} else {
    if (process.env.NODE_ENV === 'production') {
        app.use(cors({
            origin: (origin, callback) => {
                // Allow same-origin browser requests and server-to-server requests without Origin header.
                if (!origin) return callback(null, true);
                return callback(new Error('CORS origin is not allowed'));
            },
            credentials: true
        }));
    } else {
        app.use(cors());
    }
}
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

function guardPagination(req, res, next) {
    try {
        if (req.method === 'GET' && (req.path === '/api/articles' || req.path === '/api/videos')) {
            const q = req.query || {};
            const p = parseInt(q.page, 10);
            const l = parseInt(q.limit, 10);
            q.page = Number.isFinite(p) && p > 0 ? p : 1;
            q.limit = Number.isFinite(l) && l > 0 ? Math.min(l, 50) : 12;
            if (q.keyword && String(q.keyword).length > 120) {
                q.keyword = String(q.keyword).slice(0, 120);
            }
            req.query = q;
        }
    } catch (e) {
        console.error('Query param decode error:', e.message || e);
    }
    next();
}
app.use(guardPagination);

const uploadLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

app.get('/img/fallback/article', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#eef2ff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="Arial,Helvetica,sans-serif" font-size="24">Article Image</text></svg>`);
});
app.get('/img/fallback/avatar', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="#f1f5f9"/><circle cx="120" cy="90" r="40" fill="#cbd5e1"/><rect x="60" y="150" width="120" height="50" rx="12" fill="#cbd5e1"/></svg>`);
});
app.get('/img/fallback/video', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#eef2ff"/><stop offset="1" stop-color="#e0e7ff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><polygon points="360,225 360,165 430,195 430,255" fill="#6366f1"/><rect x="280" y="150" width="240" height="150" rx="16" fill="none" stroke="#94a3b8" stroke-width="4"/></svg>`);
});

app.get('/fallback-image/article', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#eef2ff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="Arial,Helvetica,sans-serif" font-size="24">Article Image</text></svg>`);
});
app.get('/fallback-image/avatar', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="#f1f5b9"/><circle cx="120" cy="90" r="40" fill="#cbd5e1"/><rect x="60" y="150" width="120" height="50" rx="12" fill="#cbd5e1"/></svg>`);
});
app.get('/fallback-image/video', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#eef2ff"/><stop offset="1" stop-color="#e0e7ff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><polygon points="360,225 360,165 430,195 430,255" fill="#6366f1"/><rect x="280" y="150" width="240" height="150" rx="16" fill="none" stroke="#94a3b8" stroke-width="4"/></svg>`);
});
// Manual Mongo Sanitize to fix "Cannot set property query" error
// The default middleware fails because req.query is sometimes a getter-only property in this environment.
app.use((req, res, next) => {
    try {
        if (req.body) req.body = mongoSanitize.sanitize(req.body);
        if (req.params) req.params = mongoSanitize.sanitize(req.params);
        if (req.query) {
            const sanitized = mongoSanitize.sanitize(req.query);
            try {
                req.query = sanitized;
            } catch (err) {
                // Fallback: If req.query is read-only (getter), define it as a value property
                Object.defineProperty(req, 'query', {
                    value: sanitized,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
            }
        }
    } catch (e) {
        console.error('Sanitization Error:', e);
    }
    next();
});

// Enforce WWW Redirect (301 Permanent Redirect for bare domain)
app.use((req, res, next) => {
    const host = req.get('host');
    // If the host exactly matches the bare domain, redirect to www
    if (host && host.toLowerCase() === 'ruihuaconsulting.com') {
        const targetUrl = 'https://www.ruihuaconsulting.com' + req.originalUrl;
        return res.redirect(301, targetUrl);
    }
    next();
});

// UTM Tracking Middleware
app.use((req, res, next) => {
    const { utm_source, utm_medium, utm_campaign, utm_term, utm_content } = req.query;
    if (utm_source) {
        const isValid = (str) => /^[a-zA-Z0-9_\-]+$/.test(str);
        const cookieOptions = {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        };
        if (isValid(utm_source)) res.cookie('utm_source', utm_source, cookieOptions);
        if (utm_medium && isValid(utm_medium)) res.cookie('utm_medium', utm_medium, cookieOptions);
        if (utm_campaign && isValid(utm_campaign)) res.cookie('utm_campaign', utm_campaign, cookieOptions);
        if (utm_term && isValid(utm_term)) res.cookie('utm_term', utm_term, cookieOptions);
        if (utm_content && isValid(utm_content)) res.cookie('utm_content', utm_content, cookieOptions);
    }
    next();
});

// Redirect .html files and trailing slashes for NQOC
app.use((req, res, next) => {
    if (req.path.startsWith('/nqoc')) {
        // Redirect /nqoc/index.html -> /nqoc
        if (req.path === '/nqoc/index.html') {
            return res.redirect(301, '/nqoc');
        }
        // Redirect /nqoc/xxx.html -> /nqoc/xxx
        if (req.path.endsWith('.html') && req.path !== '/nqoc/index.html') {
            return res.redirect(301, req.path.slice(0, -5));
        }
        // Redirect /nqoc/xxx/ -> /nqoc/xxx
        if (req.path !== '/nqoc' && req.path.endsWith('/')) {
            return res.redirect(301, req.path.slice(0, -1));
        }
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public'), { 
    index: false,
    redirect: false,
    etag: true,
    setHeaders: (res, filePath) => {
        if (/\.html$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days for other assets
        }
    }
}));
const ADMIN_STATIC_PAGE_PERMS = {
    '/admin/dashboard.html': [
        'dashboard:view',
        'article:list',
        'article:create',
        'article:edit',
        'faq:list',
        'banner:manage',
        'sidebar:manage',
        'system:manage'
    ],
    '/admin/activity-management.html': 'appointment:list',
    '/admin/efficiency.html': 'appointment:list',
    '/admin/maturity.html': 'appointment:list',
    '/admin/nqoc-awards.html': ['nqoc:list', 'nqoc:manage'],
    '/admin/nqoc-debate.html': ['nqoc:list', 'nqoc:manage'],
    '/admin/nqoc-experts.html': ['nqoc:list', 'nqoc:manage'],
    '/admin/nqoc-survey.html': ['nqoc:list', 'nqoc:manage'],
    '/admin/nqoc-whitepaper.html': ['nqoc:list', 'nqoc:manage'],
    '/admin/survey.html': 'appointment:list',
    '/admin/template-management.html': 'appointment:list',
    '/admin/training-applications.html': 'appointment:list',
    '/admin/video-management.html': 'video:list',
    '/admin/whitepaper-submissions.html': 'appointment:list'
};

const ADMIN_AUTH_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
};

function clearAdminAuthCookie(res) {
    res.clearCookie('admin_token', ADMIN_AUTH_COOKIE_OPTIONS);
}

function setAdminHtmlNoCache(res) {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
}

function redirectToAdminLogin(req, res, statusCode = 401) {
    const redirectTo = `/admin/index.html?redirect=${encodeURIComponent(req.originalUrl || '/admin/dashboard.html')}`;
    return res
        .status(statusCode)
        .set('Location', redirectTo)
        .send(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${redirectTo}"></head><body><script>window.location.replace(${JSON.stringify(redirectTo)});</script></body></html>`);
}

app.get(['/admin', '/admin/', '/admin/index.html'], (req, res) => {
    if (req.query.logout === '1') {
        clearAdminAuthCookie(res);
    }
    setAdminHtmlNoCache(res);
    res.sendFile(path.join(__dirname, 'admin/index.html'));
});

async function requireAdminStaticHtmlPage(req, res, next) {
    try {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (req.path === '/' || req.path === '/index.html' || !req.path.endsWith('.html')) return next();

        const fullPath = `/admin${req.path}`;
        if (!Object.prototype.hasOwnProperty.call(ADMIN_STATIC_PAGE_PERMS, fullPath)) {
            return res.status(404).sendFile(path.join(__dirname, '404.html'));
        }
        const requiredPerm = ADMIN_STATIC_PAGE_PERMS[fullPath];

        const auth = req.headers.authorization || '';
        const headerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        const cookieToken = req.cookies?.admin_token ? String(req.cookies.admin_token).trim() : '';
        const tokens = [headerToken, cookieToken].filter(Boolean).filter(t => t !== 'null' && t !== 'undefined');
        if (!tokens.length) return redirectToAdminLogin(req, res, 401);

        let payload = null;
        for (const token of tokens) {
            try {
                payload = jwt.verify(token, RUNTIME_SECRET_KEY);
                break;
            } catch {}
        }
        if (!payload) return redirectToAdminLogin(req, res, 401);

        const admin = await Admin.findById(payload.id).populate('roles');
        if (!admin || !admin.isActive) return redirectToAdminLogin(req, res, 403);
        setAdminHtmlNoCache(res);
        if (!requiredPerm) return next();

        const perms = gatherPermissions(admin);
        const requiredPerms = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];
        if (perms.has('all') || requiredPerms.some(perm => perms.has(perm))) return next();
        return redirectToAdminLogin(req, res, 403);
    } catch (err) {
        return redirectToAdminLogin(req, res, 401);
    }
}

app.use('/admin', requireAdminStaticHtmlPage);
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Google site verification file
app.get('/googled5b214b19ca84994.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'googled5b214b19ca84994.html'));
});

// Apply Rate Limiter AFTER static files
// Rate limiter removed

// Serve specific HTML files from root
const rootHtmlFiles = [
    'efficiency-diagnostic.html',
    'video-detail.html',
    'videos.html',
    'privacy.html',
    'solutions.html',
    'solutions-hcvm.html',
    'solutions-ohcvm.html',
    'about.html',
    'ai-strategic.html',
    'ai-strategic-special.html'
];

rootHtmlFiles.forEach(file => {
    app.get('/' + file, (req, res) => renderStaticHtmlWithFooter(res, file));
});

// 5. survey redirects
app.get('/survey', (req, res) => res.redirect(301, '/survey/'));
app.get('/survey.html', (req, res) => res.redirect(301, '/survey/'));

// NQOC Routes
app.get('/nqoc', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/nqoc/index.html'));
});

const nqocPages = ['survey', 'awards', 'cases', 'insights', 'events', 'whitepaper', 'about', 'debate-vote', 'flyer', 'poster', 'expert-apply'];
nqocPages.forEach(page => {
    app.get(`/nqoc/${page}`, (req, res) => {
        // expert-apply is a form page, should not be indexed
        if (page === 'expert-apply') {
            const fsSync = require('fs');
            const html = fsSync.readFileSync(path.join(__dirname, `public/nqoc/${page}.html`), 'utf8');
            const modified = html.replace('<head>', '<head><meta name="robots" content="noindex, nofollow" />');
            return res.send(modified);
        }
        res.sendFile(path.join(__dirname, `public/nqoc/${page}.html`));
    });
});

// Helper for SEO SSR on Article Page
const { JSDOM } = require('jsdom');
let articleTemplateCache = null;

async function getArticleTemplate() {
    if (process.env.NODE_ENV === 'production' && articleTemplateCache) {
        return articleTemplateCache;
    }
    const html = await fs.promises.readFile(path.join(__dirname, 'article.html'), 'utf8');
    if (process.env.NODE_ENV === 'production') {
        articleTemplateCache = html;
    }
    return html;
}

function getResolvedArticleAuthor(article) {
    const snapshot = (article && article.author && typeof article.author === 'object') ? article.author : {};
    const linkedAuthor = (article && article.authorId && typeof article.authorId === 'object' && article.authorId.name !== undefined)
        ? article.authorId
        : null;
    if (!linkedAuthor) {
        return {
            name: snapshot.name || '瑞华智策',
            avatar: snapshot.avatar || '/images/rhzclogo.png',
            desc: snapshot.desc || '',
            detail: snapshot.detail || ''
        };
    }
    return {
        name: linkedAuthor.name || snapshot.name || '瑞华智策',
        avatar: linkedAuthor.avatar || snapshot.avatar || '/images/rhzclogo.png',
        desc: linkedAuthor.desc || snapshot.desc || '',
        detail: linkedAuthor.detail || snapshot.detail || ''
    };
}

async function renderArticlePage(req, res, article) {
    try {
        let html = await getArticleTemplate();
        if (article) {
            const resolvedAuthor = getResolvedArticleAuthor(article);
            const dom = new JSDOM(html);
            const document = dom.window.document;

            // 1. SEO Tags
            const titleText = (article.title || '文章详情') + ' - 瑞华智策';
            document.title = titleText;
            
            // Canonical Tag
            let canonical = document.querySelector('link[rel="canonical"]');
            if (!canonical) {
                canonical = document.createElement('link');
                canonical.rel = 'canonical';
                document.head.appendChild(canonical);
            }
            const SITE_URL = process.env.SITE_URL || 'https://www.ruihuaconsulting.com';
            const articleUrl = `${SITE_URL}/article/${article.slug || article._id}.html`;
            canonical.href = articleUrl;

            const cleanSummary = article.summary ? article.summary.replace(/\r?\n/g, ' ') : '';
            if (cleanSummary) {
                let metaDesc = document.querySelector('meta[name="description"]');
                if (!metaDesc) {
                    metaDesc = document.createElement('meta');
                    metaDesc.name = 'description';
                    document.head.appendChild(metaDesc);
                }
                metaDesc.content = cleanSummary;
            }

            // --- Social/分享: Open Graph 标签（微信/微博/QQ 分享卡片）---
            const ogImage = article.coverImage
                ? (article.coverImage.startsWith('http') ? article.coverImage : `${SITE_URL}${article.coverImage}`)
                : `${SITE_URL}/images/logo.png`;
            const ogTags = [
                ['og:type', 'article'],
                ['og:site_name', '瑞华智策'],
                ['og:title', titleText],
                ['og:description', cleanSummary],
                ['og:url', articleUrl],
                ['og:image', ogImage]
            ];
            ogTags.forEach(([prop, content]) => {
                if (!content) return;
                let tag = document.querySelector(`meta[property="${prop}"]`);
                if (!tag) {
                    tag = document.createElement('meta');
                    tag.setAttribute('property', prop);
                    document.head.appendChild(tag);
                }
                tag.setAttribute('content', content);
            });

            // --- GEO: Inject Article Schema (always create a dedicated node to avoid clobbering existing JSON-LD) ---
            const schemaScript = document.createElement('script');
            schemaScript.type = 'application/ld+json';
            document.head.appendChild(schemaScript);
            const articleSchema = {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": article.title,
                "mainEntityOfPage": { "@type": "WebPage", "@id": articleUrl },
                "image": article.coverImage ? [article.coverImage.startsWith('http') ? article.coverImage : `${SITE_URL}${article.coverImage}`] : [],
                "datePublished": article.publishDate,
                "dateModified": article.updatedAt || article.publishDate,
                "author": {
                    "@type": "Person",
                    "name": resolvedAuthor.name || "瑞华智策",
                    ...(resolvedAuthor.url ? { "url": resolvedAuthor.url } : {})
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "瑞华智策",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://www.ruihuaconsulting.com/images/logo.png"
                    },
                    "sameAs": [
                        "https://www.ruihuaconsulting.com/"
                    ]
                },
                "description": article.summary || "",
                "inLanguage": "zh-CN",
                "wordCount": article.content ? article.content.replace(/<[^>]*>?/gm, '').length : 0,
                ...(article.seoKeywords && article.seoKeywords.length ? { "keywords": article.seoKeywords.join(',') } : {}),
                ...(article.tags && article.tags.length ? { "articleSection": article.tags[0] } : {})
            };
            schemaScript.textContent = JSON.stringify(articleSchema);

            // 2. Article Content (SSR)
            const titleEl = document.getElementById('article-title');
            if (titleEl) titleEl.textContent = article.title || '';

            const breadcrumbEl = document.getElementById('breadcrumb-title');
            if (breadcrumbEl) breadcrumbEl.textContent = article.title || '';

            const containerEl = document.getElementById('article-container');
            if (containerEl && article.content) {
                containerEl.innerHTML = article.content;
            }

            const summaryEl = document.getElementById('article-summary');
            const summaryTextEl = document.getElementById('article-summary-text');
            if (summaryEl && summaryTextEl && article.summary) {
                summaryTextEl.textContent = article.summary;
                summaryEl.classList.remove('hidden');
            }

            const authorEl = document.getElementById('article-author');
            if (authorEl) {
                authorEl.textContent = resolvedAuthor.name || '瑞华智策';
            }

            const dateEl = document.getElementById('article-date');
            if (dateEl && article.publishDate) {
                const d = new Date(article.publishDate);
                dateEl.textContent = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }

            const updatedEl = document.getElementById('article-updated');
            if (updatedEl && article.updatedAt) {
                const d = new Date(article.updatedAt);
                updatedEl.textContent = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }

            const viewsEl = document.getElementById('article-views');
            if (viewsEl) {
                viewsEl.textContent = article.views || 0;
            }
            
            // SSR Render Q&A Section
            if (article.qaList && article.qaList.length > 0) {
                const qaSection = document.getElementById('article-qa-section');
                const qaContainer = document.getElementById('article-qa-container');
                if (qaSection && qaContainer) {
                    qaSection.classList.remove('hidden');
                    let qaHtml = '';
                    let qaSchemaItems = [];
                    
                    article.qaList.forEach((qa, idx) => {
                        qaHtml += `
                            <div class="bg-slate-50 rounded-xl p-5 border border-slate-100">
                                <h4 class="font-bold text-slate-800 mb-2 flex items-start gap-2">
                                    <span class="text-brand-600">Q:</span> ${escapeHtml(qa.question)}
                                </h4>
                                <div class="text-slate-600 text-sm leading-relaxed flex items-start gap-2">
                                    <span class="text-brand-600 font-bold">A:</span> 
                                    <div>${escapeHtml(qa.answer)}</div>
                                </div>
                            </div>
                        `;
                        qaSchemaItems.push({
                            "@type": "Question",
                            "name": qa.question,
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": qa.answer
                            }
                        });
                    });
                    
                    qaContainer.innerHTML = qaHtml;
                    
                    // Inject FAQ Schema
                    if (qaSchemaItems.length > 0) {
                        const faqSchema = {
                            "@context": "https://schema.org",
                            "@type": "FAQPage",
                            "mainEntity": qaSchemaItems
                        };
                        const faqSchemaScript = document.createElement('script');
                        faqSchemaScript.type = 'application/ld+json';
                        faqSchemaScript.textContent = JSON.stringify(faqSchema);
                        document.head.appendChild(faqSchemaScript);
                    }
                }
            }

            // Fetch and inject Sidebar SSR Data
            try {
                const Setting = require('./models/Setting');
                const ArticleModel = require('./models/Article'); // Make sure we use the correct model reference
                
                const sidebarSetting = await Setting.findOne({ key: 'sidebar_modules' });
                const sidebarModules = sidebarSetting && Array.isArray(sidebarSetting.value) ? sidebarSetting.value : [];
                
                // Sort active modules
                const activeModules = sidebarModules.filter(m => m.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
                
                const sidebarContainer = document.getElementById('sidebar-modules-container');
                if (sidebarContainer) {
                    let modulesHtml = '';
                    
                    for (const mod of activeModules) {
                        if (mod.rule === 'custom_html') {
                            modulesHtml += `<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mt-6">${escapeHtml(mod.customHtml || '')}</div>`;
                        } else if (mod.rule === 'efficiency_agent') {
                            const conf = mod.effConfig || {};
                            const eTitle = conf.title || '组织人效智能体检Agent';
                            const eDesc = conf.desc || '通过科学的诊断模型，为您精准定位组织效能痛点，量化人力资本投资回报。';
                            const eBtn = conf.btnText || '预约体验 →';
                            const eLink = conf.link || '/productivity/';
                            
                            let raceHtml = '';
                            if (conf.rTitle || conf.rDesc || conf.aTitle || conf.aDesc || conf.cTitle || conf.cDesc || conf.eTitle || conf.eDesc) {
                                raceHtml += '<div class="grid grid-cols-2 gap-3 mb-6">';
                                
                                if (conf.rTitle || conf.rDesc) {
                                    raceHtml += `
                                        <div class="bg-white rounded-xl p-3 shadow-sm transform transition hover:-translate-y-1">
                                            <div class="text-violet-600 font-bold text-lg mb-1 flex items-center gap-2"><span class="text-2xl">R</span> <span class="text-slate-800 text-sm">${conf.rTitle || '人效对标'}</span></div>
                                            <p class="text-xs text-slate-500 leading-tight">${conf.rDesc || '排查利润黑洞<br>识别低效投入'}</p>
                                        </div>
                                    `;
                                }
                                
                                if (conf.aTitle || conf.aDesc) {
                                    raceHtml += `
                                        <div class="bg-white rounded-xl p-3 shadow-sm transform transition hover:-translate-y-1">
                                            <div class="text-indigo-500 font-bold text-lg mb-1 flex items-center gap-2"><span class="text-2xl">A</span> <span class="text-slate-800 text-sm">${conf.aTitle || '结构适配'}</span></div>
                                            <p class="text-xs text-slate-500 leading-tight">${conf.aDesc || '评估组织架构<br>支撑业务增长'}</p>
                                        </div>
                                    `;
                                }
                                
                                if (conf.cTitle || conf.cDesc) {
                                    raceHtml += `
                                        <div class="bg-white rounded-xl p-3 shadow-sm transform transition hover:-translate-y-1">
                                            <div class="text-purple-500 font-bold text-lg mb-1 flex items-center gap-2"><span class="text-2xl">C</span> <span class="text-slate-800 text-sm">${conf.cTitle || '人才动能'}</span></div>
                                            <p class="text-xs text-slate-500 leading-tight">${conf.cDesc || '识别核心能力<br>评估梯队健康度'}</p>
                                        </div>
                                    `;
                                }
                                
                                if (conf.eTitle || conf.eDesc) {
                                    raceHtml += `
                                        <div class="bg-white rounded-xl p-3 shadow-sm transform transition hover:-translate-y-1">
                                            <div class="text-blue-500 font-bold text-lg mb-1 flex items-center gap-2"><span class="text-2xl">E</span> <span class="text-slate-800 text-sm">${conf.eTitle || '组织活力'}</span></div>
                                            <p class="text-xs text-slate-500 leading-tight">${conf.eDesc || '量化员工敬业度<br>判断长效动力'}</p>
                                        </div>
                                    `;
                                }
                                
                                raceHtml += '</div>';
                            } else if (conf.rTitle === undefined && !conf.effConfig) {
                                // Default fallback for old data without RACE config explicitly saved
                                raceHtml = `
                                    <div class="grid grid-cols-2 gap-3 mb-6">
                                        <div class="bg-white rounded-xl p-3 shadow-sm transform transition hover:-translate-y-1">
                                            <div class="text-violet-600 font-bold text-lg mb-1 flex items-center gap-2"><span class="text-2xl">R</span> <span class="text-slate-800 text-sm">人效对标</span></div>
                                            <p class="text-xs text-slate-500 leading-tight">排查利润黑洞<br>识别低效投入</p>
                                        </div>
                                        <div class="bg-white rounded-xl p-3 shadow-sm transform transition hover:-translate-y-1">
                                            <div class="text-indigo-500 font-bold text-lg mb-1 flex items-center gap-2"><span class="text-2xl">A</span> <span class="text-slate-800 text-sm">结构适配</span></div>
                                            <p class="text-xs text-slate-500 leading-tight">评估组织架构<br>支撑业务增长</p>
                                        </div>
                                        <div class="bg-white rounded-xl p-3 shadow-sm transform transition hover:-translate-y-1">
                                            <div class="text-purple-500 font-bold text-lg mb-1 flex items-center gap-2"><span class="text-2xl">C</span> <span class="text-slate-800 text-sm">人才动能</span></div>
                                            <p class="text-xs text-slate-500 leading-tight">识别核心能力<br>评估梯队健康度</p>
                                        </div>
                                        <div class="bg-white rounded-xl p-3 shadow-sm transform transition hover:-translate-y-1">
                                            <div class="text-blue-500 font-bold text-lg mb-1 flex items-center gap-2"><span class="text-2xl">E</span> <span class="text-slate-800 text-sm">组织活力</span></div>
                                            <p class="text-xs text-slate-500 leading-tight">量化员工敬业度<br>判断长效动力</p>
                                        </div>
                                    </div>
                                `;
                            }
                            
                            modulesHtml += `
                            <div class="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-6 mt-6 text-white shadow-xl relative overflow-hidden group">
                                <div class="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>
                                <div class="relative z-10">
                                    <div class="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-yellow-300 mb-4 border border-white/10">
                                        <i class="fas fa-bolt"></i> 限时免费评估
                                    </div>
                                    <h3 class="text-xl font-bold mb-3 leading-snug">${eTitle}</h3>
                                    <p class="text-indigo-100 text-sm mb-6 leading-relaxed opacity-90">${eDesc}</p>
                                    
                                    ${raceHtml}
                                    
                                    <a href="${eLink}" class="block w-full bg-white text-violet-700 hover:bg-slate-50 font-bold py-3.5 px-4 rounded-xl text-center transition-colors shadow-md">
                                        ${eBtn}
                                    </a>
                                </div>
                            </div>
                            `;
                        } else {
                            // Fetch articles based on rule
                            let q = { status: 'published' };
                            if (mod.rule === 'category' && article.category) {
                                q.category = article.category;
                                q._id = { $ne: article._id };
                            } else if (mod.rule === 'tags' && article.tags && article.tags.length > 0) {
                                q.tags = { $in: article.tags };
                                q._id = { $ne: article._id };
                            } else if (mod.rule === 'latest') {
                                q._id = { $ne: article._id };
                            }
                            
                            const articles = await ArticleModel.find(q)
                                .sort({ publishDate: -1 })
                                .limit(mod.count || 5)
                                .select('title slug category');
                                
                            if (articles.length > 0) {
                                let listHtml = '';
                                articles.forEach((art, idx) => {
                                    let colorClass = 'text-blue-600';
                                    if (idx % 3 === 1) colorClass = 'text-purple-600';
                                    if (idx % 3 === 2) colorClass = 'text-emerald-600';
                                    listHtml += `
                                        <a href="/article/${art.slug}.html" class="block group flex items-start gap-3">
                                            <span class="text-sm font-bold ${colorClass} mt-0.5">${idx + 1}.</span>
                                            <div>
                                                <h5 class="text-sm font-bold text-slate-700 group-hover:text-brand-600 transition leading-snug">${art.title}</h5>
                                            </div>
                                        </a>
                                        ${idx < articles.length - 1 ? '<div class="h-px bg-slate-100"></div>' : ''}
                                    `;
                                });
                                
                                modulesHtml += `
                                    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mt-6">
                                        <h4 class="text-sm font-bold text-slate-900 mb-4">${mod.title}</h4>
                                        <div class="space-y-4">${listHtml}</div>
                                    </div>
                                `;
                            }
                        }
                    }
                    
                    // Insert the dynamically generated modules into the sidebar, appending after the author box
                    sidebarContainer.innerHTML = sidebarContainer.innerHTML + modulesHtml;
                }
                
                // Keep backwards compatibility for old __SIDEBAR_DATA__ if needed by other client scripts
                const sbScriptEl = document.createElement('script');
                sbScriptEl.textContent = `window.__SIDEBAR_DATA__ = ${JSON.stringify({ modules: activeModules }).replace(/</g, '\\u003c')};`;
                document.body.appendChild(sbScriptEl);
                
            // Render Author Box (Fallback to article author, or default)
            const expTitle = document.getElementById('expert-title');
            if (expTitle) expTitle.textContent = resolvedAuthor.name || '瑞华智策专家组';
            
            const expDesc = document.getElementById('expert-desc');
            if (expDesc) expDesc.textContent = resolvedAuthor.desc || '人力资本价值经营研究院';
            
            const expDetail = document.getElementById('expert-detail');
            if (expDetail) {
                if (resolvedAuthor.detail) {
                    expDetail.textContent = resolvedAuthor.detail;
                } else {
                    expDetail.textContent = '瑞华智策汇聚了来自华为、人瑞人才及全球顶尖咨询机构的实战专家。';
                }
            }
            
            // SSR Render Footer
            try {
                injectFooterHTML(document);
            } catch (compErr) {
                console.warn('SSR components rendering skipped:', compErr.message);
            }
                
                const expAvatar = document.getElementById('expert-avatar');
                if (expAvatar) {
                    expAvatar.src = resolvedAuthor.avatar || '/images/rhzclogo.png';
                }

            } catch (sidebarErr) {
                console.error('SSR Sidebar Error:', sidebarErr);
            }

            // Inject initial data to prevent redundant client-side fetch (Exclude raw HTML content to avoid payload bloat/SEO penalty)
            const scriptEl = document.createElement('script');
            const safeArticleData = article.toObject ? { ...article.toObject() } : { ...article };
            safeArticleData.author = resolvedAuthor;
            delete safeArticleData.content; // Remove full HTML text from inline script
            scriptEl.textContent = `window.__ARTICLE_DATA__ = ${JSON.stringify(safeArticleData).replace(/</g, '\\u003c')};`;
            document.body.appendChild(scriptEl);

            html = dom.serialize();
        }
        res.send(html);
    } catch (err) {
        console.error('Error rendering article page:', err);
        res.status(500).send('Internal Server Error');
    }
}

app.get('/article.html', async (req, res) => {
    try {
        let article = null;
        if (req.query.id && mongoose.Types.ObjectId.isValid(req.query.id)) {
            article = await Article.findById(req.query.id).populate('authorId');
        }
        await renderArticlePage(req, res, article);
    } catch (e) {
        console.error('Article HTML Route Error:', e);
        res.status(500).send('Internal Server Error');
    }
});

// Solutions HCVM Redirects & Serving
app.get('/solutions-ahcvm/', (req, res) => res.redirect(301, '/solutions-hcvm/'));
app.get('/solutions-ahcvm.html', (req, res) => res.redirect(301, '/solutions-hcvm/'));

// 7. solutions related routes
app.get('/solutions/', (req, res) => renderStaticHtmlWithFooter(res, 'solutions.html'));
app.get('/solutions.html', (req, res) => res.redirect(301, '/solutions/'));

app.get('/solutions-hcvm/', (req, res) => renderStaticHtmlWithFooter(res, 'solutions-hcvm.html'));
app.get('/solutions-hcvm.html', (req, res) => res.redirect(301, '/solutions-hcvm/'));

// Solutions OHCVM Redirects & Serving
app.get('/solutions-ohcvm/', (req, res) => renderStaticHtmlWithFooter(res, 'solutions-ohcvm.html'));
app.get('/solutions-ohcvm.html', (req, res) => res.redirect(301, '/solutions-ohcvm/'));

// 8. Root-level standalone pages (not in public/)
app.get('/diagnostic-result.html', (req, res) => renderStaticHtmlWithFooter(res, 'diagnostic-result.html'));
app.get('/event-registration.html', (req, res) => renderStaticHtmlWithFooter(res, 'event-registration.html'));
app.get('/sales-toolkit.html', (req, res) => renderStaticHtmlWithFooter(res, 'sales-toolkit.html'));
app.get('/nurture.html', (req, res) => renderStaticHtmlWithFooter(res, 'nurture.html'));

// Efficiency Diagnostic clean URL
app.get('/efficiency-diagnostic/', (req, res) => renderStaticHtmlWithFooter(res, 'efficiency-diagnostic.html'));
app.get('/efficiency-diagnostic', (req, res) => res.redirect(301, '/efficiency-diagnostic/'));

// 9. Digital business card
app.get('/card/wangkun.html', (req, res) => res.sendFile(path.join(__dirname, 'card', 'wangkun.html')));

// 10. robots.txt (in project root, outside public/)
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, 'robots.txt')));

// Serve verification txt file
app.get('/f30f7f41e5fa707ed66d41aeb3791adb.txt', (req, res) => {
    res.sendFile(path.join(__dirname, 'f30f7f41e5fa707ed66d41aeb3791adb.txt'));
});

// Serve Baidu verification html file
app.get('/baidu_verify_codeva-p4La8BZmYb.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'baidu_verify_codeva-p4La8BZmYb.html'));
});

// 404 Handler (Should be the last route)
// BUT we have other routes below.
// Express executes routes in order.
// We need to place the 404 handler at the VERY END of the file, after all other app.get/post calls.
// Let's search for where the routes end.

// URL Rewrites and Redirects for SEO (Directory Style)
// 1. about.html -> /about/
app.get('/about/', (req, res) => renderStaticHtmlWithFooter(res, 'about.html'));
app.get('/about.html', (req, res) => res.redirect(301, '/about/'));

// 2. training.html -> /training
app.get('/training', (req, res) => renderStaticHtmlWithFooter(res, 'training.html'));
app.get('/training.html', (req, res) => res.redirect(301, '/training'));
app.get('/training/', (req, res) => res.redirect(301, '/training'));
app.get('/raining.html', (req, res) => res.redirect(301, '/training'));

// Helper for SEO SSR on Resources Page
let resourcesTemplateCache = null;

async function getResourcesTemplate() {
    if (process.env.NODE_ENV === 'production' && resourcesTemplateCache) {
        return resourcesTemplateCache;
    }
    const html = await fs.promises.readFile(path.join(__dirname, 'resources.html'), 'utf8');
    if (process.env.NODE_ENV === 'production') {
        resourcesTemplateCache = html;
    }
    return html;
}

async function renderResourcesPage(req, res) {
    try {
        let html = await getResourcesTemplate();
        
        const dom = new JSDOM(html);
        const document = dom.window.document;
        const container = document.getElementById('resources-grid');
        
        if (container) {
            // Fetch Category mapping
            const CategoryModel = require('./models/Category');
            const categories = await CategoryModel.find().lean();
            const categoryMap = {};
            categories.forEach(cat => {
                categoryMap[cat.code] = cat.name;
            });

            // Fetch All Published Articles
            const ArticleModel = require('./models/Article');
            const articles = await ArticleModel.find({ status: 'published' }).sort({ publishDate: -1 }).lean();

            if (!articles || articles.length === 0) {
                container.innerHTML = '<div class="text-center py-20 text-slate-500">该分类下暂无内容</div>';
            } else {
                let articlesHtml = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">';

                articles.forEach(art => {
                    const date = new Date(art.publishDate).toLocaleDateString('zh-CN', {year:'numeric', month:'2-digit', day:'2-digit'}).replace(/\//g, '-');
                    const artUrl = art.slug ? `/article/${art.slug}.html` : `article.html?id=${art._id}`;
                    const artCategoryName = categoryMap[art.category] || art.category || '推荐';
                    const coverImage = art.coverImage || '/images/default-article.jpg';

                    const isWp = art.category === 'whitepaper' || art.category === '白皮书';
                    const cardAction = isWp
                        ? `<button onclick="event.preventDefault(); event.stopPropagation(); openDownloadModal('${(art.title||'').replace(/'/g, "\\'")}')" class="text-brand-600 font-semibold text-xs hover:underline flex items-center gap-1">立即下载 <i class="fas fa-arrow-right transform group-hover:translate-x-1 transition-transform"></i></button>`
                        : `<span class="text-brand-600 font-semibold text-xs hover:underline flex items-center gap-1">阅读文章 <i class="fas fa-arrow-right transform group-hover:translate-x-1 transition-transform"></i></span>`;

                    articlesHtml += `
                    <a href="${artUrl}" class="bg-white rounded-xl overflow-hidden transition-all duration-300 group flex flex-col cursor-pointer fade-in-up relative z-0 hover:z-10 block" 
                             style="box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-decoration: none;" 
                             onmouseover="this.style.boxShadow='0 12px 24px rgba(0,0,0,0.15)'; this.style.transform='translateY(-4px)'" 
                             onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'; this.style.transform='translateY(0)'">
                        <div class="relative overflow-hidden aspect-[16/9]">
                            <span class="absolute top-3 left-3 bg-white/90 backdrop-blur text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full z-10 uppercase shadow-sm tracking-wide">${artCategoryName}</span>
                            <img src="${coverImage}"
                                 class="w-full h-full object-cover transition duration-700 group-hover:scale-105" 
                                 alt="${art.title || ''}"
                                 loading="lazy" decoding="async"
                                 onerror="this.onerror=null;this.src='/fallback-image/article'">
                            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition duration-300"></div>
                        </div>
                        <div class="p-5 flex flex-col flex-grow">
                            <h3 class="font-bold text-slate-900 mb-2 group-hover:text-brand-600 transition truncate text-[16px] leading-snug tracking-tight" title="${art.title || ''}">${art.title || ''}</h3>
                            <div class="summary-wrapper flex-grow mb-4">
                                <p class="text-slate-500 text-[13px] leading-relaxed">${art.summary || ''}</p>
                            </div>
                            <div class="mt-auto pt-3 border-t border-slate-50 flex justify-between items-center relative z-20">
                                <span class="text-[11px] text-slate-400 font-medium">${date}</span>
                                ${cardAction}
                            </div>
                        </div>
                    </a>
                    `;
                });

                articlesHtml += '</div>';
                
                if (articles.length >= 6) {
                    articlesHtml += `<div class="mt-16 text-center"><button class="px-8 py-3 rounded-full border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 hover:border-slate-400 transition text-sm">加载更多内容</button></div>`;
                }

                container.innerHTML = articlesHtml;
                
                // Inject Categories data
                const catScriptEl = document.createElement('script');
                catScriptEl.textContent = `window.__INITIAL_CATEGORIES__ = ${JSON.stringify(categories).replace(/</g, '\\u003c')};`;
                document.body.appendChild(catScriptEl);
                
                // Expose initial data to window (Exclude raw HTML content to avoid payload bloat/SEO penalty)
                const scriptEl = document.createElement('script');
                const safeArticles = articles.map(art => {
                    const safeArt = { ...art };
                    delete safeArt.content;
                    return safeArt;
                });
                scriptEl.textContent = `window.__INITIAL_ARTICLES__ = ${JSON.stringify(safeArticles).replace(/</g, '\\u003c')};`;
                document.body.appendChild(scriptEl);
            }
        }
        
        // Inject SEO
        await injectSeoTags(document, '/resources.html');

        // Inject ItemList Schema for resources page
        if (articles && articles.length > 0) {
            const SITE_URL = process.env.SITE_URL || 'https://www.ruihuaconsulting.com';
            const itemListScript = document.createElement('script');
            itemListScript.type = 'application/ld+json';
            itemListScript.textContent = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "ItemList",
                "itemListElement": articles.slice(0, 20).map((art, i) => ({
                    "@type": "ListItem",
                    "position": i + 1,
                    "url": `${SITE_URL}/article/${art.slug || art._id}.html`,
                    "name": art.title,
                    "description": (art.summary || '').substring(0, 200),
                    "datePublished": art.publishDate
                }))
            });
            document.head.appendChild(itemListScript);
        }

        // Inject Footer
        try {
            injectFooterHTML(document);
        } catch (compErr) {
            console.warn('SSR components rendering skipped:', compErr.message);
        }
        
        res.send(dom.serialize());
    } catch (err) {
        console.error('Error rendering resources page:', err);
        res.status(500).send('Internal Server Error');
    }
}

// 3. resources.html -> /resources/
app.get('/resources/', renderResourcesPage);
app.get('/resources.html', (req, res) => res.redirect(301, '/resources/'));

function injectBreadcrumbSchema(document, filename) {
    const SITE_URL = process.env.SITE_URL || 'https://www.ruihuaconsulting.com';
    const breadcrumbMap = {
        'solutions-hcvm.html': [
            { name: '首页', url: SITE_URL },
            { name: '解决方案', url: `${SITE_URL}/solutions/` },
            { name: 'AHCVM 自有员工管理' }
        ],
        'solutions-ohcvm.html': [
            { name: '首页', url: SITE_URL },
            { name: '解决方案', url: `${SITE_URL}/solutions/` },
            { name: 'OHCVM 外包员工管理' }
        ],
        'solutions.html': [
            { name: '首页', url: SITE_URL },
            { name: '解决方案' }
        ],
        'resources.html': [
            { name: '首页', url: SITE_URL },
            { name: '文章资源' }
        ],
        'videos.html': [
            { name: '首页', url: SITE_URL },
            { name: '视频中心' }
        ],
        'training.html': [
            { name: '首页', url: SITE_URL },
            { name: '培训认证' }
        ],
        'diagnostic.html': [
            { name: '首页', url: SITE_URL },
            { name: '组织诊断' }
        ]
    };
    const items = breadcrumbMap[filename];
    if (!items) return;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items.map((item, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "name": item.name,
            ...(item.url ? { "item": item.url } : {})
        }))
    });
    document.head.appendChild(script);
}

async function injectSeoTags(document, pagePath) {
    try {
        console.log('Injecting SEO for:', pagePath);
        const config = await SeoConfig.findOne({ pagePath });
        console.log('SEO Config found:', !!config);
        if (config) {
            if (config.title) document.title = config.title;
            if (config.keywords) {
                let metaKeywords = document.querySelector('meta[name="keywords"]');
                if (!metaKeywords) {
                    metaKeywords = document.createElement('meta');
                    metaKeywords.name = 'keywords';
                    document.head.appendChild(metaKeywords);
                }
                metaKeywords.content = config.keywords;
            }
            if (config.description) {
                let metaDescription = document.querySelector('meta[name="description"]');
                if (!metaDescription) {
                    metaDescription = document.createElement('meta');
                    metaDescription.name = 'description';
                    document.head.appendChild(metaDescription);
                }
                metaDescription.content = config.description;
            }
            console.log('SEO injected successfully for:', pagePath);
        }
    } catch (e) {
        console.error(`Error injecting SEO tags for ${pagePath}:`, e);
    }
}

// Helper function to render static HTML files with injected Footer
const renderStaticHtmlWithFooter = async (res, filename) => {
    try {
        const fs = require('fs');
        const { JSDOM } = require('jsdom');
        const html = await fs.promises.readFile(path.join(__dirname, filename), 'utf8');
        const dom = new JSDOM(html);
        const document = dom.window.document;

        if (filename === 'index.html') {
            await injectHomeDynamicContent(document, { insightsLimit: 3, faqLimit: 5 });
        }

        await injectSeoTags(document, `/${filename}`);
        injectBreadcrumbSchema(document, filename);
        injectFooterHTML(document);
        
        res.send(dom.serialize());
    } catch (e) {
        console.error(`Error rendering ${filename} with footer:`, e);
        res.sendFile(path.join(__dirname, filename));
    }
};

async function injectHomeDynamicContent(document, options = {}) {
    const insightsLimit = Number(options.insightsLimit || 3);
    const faqLimit = Number(options.faqLimit || 5);
    const insightsContainer = document.getElementById('insights-container');
    const faqList = document.getElementById('faq-list');
    const loadMoreBtn = document.getElementById('insights-load-more');
    if (!insightsContainer || !faqList) return;

    try {
        const [articles, faqRows, categories, total] = await Promise.all([
            Article.find({ status: 'published', isRecommended: true })
                .sort({ publishDate: -1 })
                .limit(insightsLimit)
                .lean(),
            Faq.find({ status: { $in: ['published', undefined] } })
                .sort({ order: 1 })
                .limit(faqLimit)
                .lean(),
            Category.find({}).lean(),
            Article.countDocuments({ status: 'published', isRecommended: true })
        ]);

        const categoryMap = {};
        categories.forEach((item) => {
            if (item?.code && item?.name) categoryMap[item.code] = item.name;
        });

        insightsContainer.innerHTML = (articles || []).map((article) => renderInsightCard(article, categoryMap)).join('');
        faqList.innerHTML = (faqRows || []).map((faq) => renderFaqItem(faq)).join('');

        insightsContainer.setAttribute('data-ssr-rendered', 'true');
        insightsContainer.setAttribute('data-page', '1');
        insightsContainer.setAttribute('data-limit', String(insightsLimit));
        insightsContainer.setAttribute('data-has-more', total > insightsLimit ? 'true' : 'false');
        faqList.setAttribute('data-ssr-rendered', 'true');

        if (loadMoreBtn) {
            if (total > insightsLimit) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
        }

        const noScriptStyle = document.createElement('noscript');
        noScriptStyle.innerHTML = '<style>#faq-list .faq-content{max-height:none !important;opacity:1 !important;}</style>';
        document.body.appendChild(noScriptStyle);
    } catch (error) {
        console.error('Inject home dynamic content failed:', error.message);
    }
}

// 4. productivity.html -> /productivity/
app.get('/productivity/', (req, res) => renderStaticHtmlWithFooter(res, 'productivity.html'));
app.get('/productivity', (req, res) => res.redirect(301, '/productivity/'));
app.get('/productivity.html', (req, res) => res.redirect(301, '/productivity/'));

// 5. diagnostic.html -> /diagnostic/
app.get('/diagnostic/', (req, res) => renderStaticHtmlWithFooter(res, 'diagnostic.html'));
app.get('/diagnostic', (req, res) => res.redirect(301, '/diagnostic/'));
app.get('/diagnostic.html', (req, res) => res.redirect(301, '/diagnostic/'));

// 6. videos.html -> /videos/
app.get('/videos/', (req, res) => renderStaticHtmlWithFooter(res, 'videos.html'));
app.get('/videos.html', (req, res) => res.redirect(301, '/videos/'));

// 7. ai-strategic-special.html -> /ai-strategic-special/
app.get('/ai-strategic-special/', (req, res) => res.sendFile(path.join(__dirname, 'ai-strategic-special.html')));
app.get('/ai-strategic-special', (req, res) => res.redirect(301, '/ai-strategic-special/'));
app.get('/ai-strategic-special.html', (req, res) => res.redirect(301, '/ai-strategic-special/'));


// Handle /index.html redirection to root
app.get('/index.html', (req, res) => {
    if (process.env.NODE_ENV === 'development') {
        renderStaticHtmlWithFooter(res, 'index.html');
    } else {
        res.redirect(301, '/');
    }
});

// Serve index.html for root path with Cache-Control
app.get('/', (req, res) => {
    // Cache for 1 hour (3600s), but validate with ETag
    res.set('Cache-Control', 'public, max-age=3600');
    renderStaticHtmlWithFooter(res, 'index.html');
});

// --- SEO: Sitemap.xml ---
app.get('/sitemap.xml', async (req, res) => {
    try {
        const SITE_URL = process.env.SITE_URL || 'https://www.ruihuaconsulting.com';
        
        // Static Pages (file = 用于读取真实修改时间作为 lastmod，避免每天伪造"全站更新"信号)
        const staticPages = [
            { url: '', file: 'index.html', priority: 1.0, changefreq: 'weekly' },
            { url: 'solutions/', file: 'solutions.html', priority: 0.9, changefreq: 'weekly' },
            { url: 'solutions-hcvm/', file: 'solutions-hcvm.html', priority: 0.8, changefreq: 'monthly' },
            { url: 'solutions-ohcvm/', file: 'solutions-ohcvm.html', priority: 0.8, changefreq: 'monthly' },
            { url: 'resources/', file: 'resources.html', priority: 0.9, changefreq: 'weekly' },
            { url: 'productivity/', file: 'productivity.html', priority: 0.8, changefreq: 'weekly' },
            { url: 'diagnostic/', file: 'diagnostic.html', priority: 0.8, changefreq: 'weekly' },
            { url: 'videos/', file: 'videos.html', priority: 0.7, changefreq: 'weekly' },
            { url: 'training/', file: 'training.html', priority: 0.7, changefreq: 'monthly' },
            { url: 'ai-strategic/', file: 'ai-strategic.html', priority: 0.7, changefreq: 'monthly' },
            { url: 'about/', file: 'about.html', priority: 0.7, changefreq: 'monthly' },
            { url: 'nqoc/', file: 'public/nqoc/index.html', priority: 0.7, changefreq: 'weekly' },
            { url: 'privacy/', file: 'privacy.html', priority: 0.3, changefreq: 'yearly' }
        ];

        let xml = '<?xml version="1.0" encoding="UTF-8"?>';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        // Add Static Pages
        const today = new Date().toISOString().split('T')[0];
        staticPages.forEach(page => {
            let lastmod = today;
            try {
                if (page.file) {
                    lastmod = fs.statSync(path.join(__dirname, page.file)).mtime.toISOString().split('T')[0];
                }
            } catch (e) { /* fallback to today */ }
            xml += `
    <url>
        <loc>${SITE_URL}/${page.url}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>${page.changefreq}</changefreq>
        <priority>${page.priority}</priority>
    </url>`;
        });

        // Add Dynamic Articles（仅收录已发布且有 slug 的文章；无 slug 的文章路由无法解析会 404）
        const articles = await Article.find({ status: 'published', slug: { $exists: true, $nin: [null, ''] } }, 'slug publishDate updatedAt');
        articles.forEach(article => {
            if (!article.slug) return;
            const date = article.updatedAt || article.publishDate || new Date();
            const lastmod = new Date(date).toISOString().split('T')[0];

            xml += `
    <url>
        <loc>${SITE_URL}/article/${article.slug}.html</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>`;
        });

        xml += '\n</urlset>';
        
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (e) {
        console.error('Sitemap Error:', e);
        res.status(500).send('Error generating sitemap');
    }
});


app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
    etag: true,
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        }
    }
}));

app.get('/images/default-article.jpg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#eef2ff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="Arial,Helvetica,sans-serif" font-size="24">Article Image</text></svg>`);
});

app.get('/images/default-avatar.png', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="#f1f5f9"/><circle cx="120" cy="90" r="40" fill="#cbd5e1"/><rect x="60" y="150" width="120" height="50" rx="12" fill="#cbd5e1"/></svg>`);
});

app.get('/images/default-video.jpg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#eef2ff"/><stop offset="1" stop-color="#e0e7ff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><polygon points="360,225 360,165 430,195 430,255" fill="#6366f1"/><rect x="280" y="150" width="240" height="150" rx="16" fill="none" stroke="#94a3b8" stroke-width="4"/></svg>`);
});

// --- Auth Middleware ---
function authRequired(req, res, next) {
    try {
        const auth = req.headers.authorization || '';
        const headerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        const cookieToken = req.cookies?.admin_token || '';
        const candidates = [headerToken, cookieToken].filter(Boolean).filter(t => t !== 'null' && t !== 'undefined');
        if (candidates.length === 0) return res.status(401).json({ error: 'Unauthorized' });
        for (const token of candidates) {
            try {
                const payload = jwt.verify(token, RUNTIME_SECRET_KEY);
                req.user = payload;
                return next();
            } catch (e) {
                console.error('JWT verify error:', e.message || e);
            }
        }
        return res.status(401).json({ error: 'Invalid token' });
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// DB Connection
console.log('Environment MONGODB_URL:', process.env.MONGODB_URL);
const mongoUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/ruihua_cms';
console.log('Using MongoDB URL:', mongoUrl);
mongoose.connect(mongoUrl)
    .then(async () => {
        console.log('MongoDB Connected to:', mongoUrl);
        // Rebuild llms.txt on startup
        try { await rebuildLLMsTxt(); } catch {}
    })
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    });

// Multer Config for Uploads
function ensureDirSync(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (e) {
        console.error('EnsureDir failed:', e);
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public/uploads/');
        ensureDirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const base = path.basename(file.originalname).replace(/\.[^.]+$/, '');
        const digitsRaw = toDigitsFromSha256(base + String(Date.now()));
        const digits30 = clipDigits(digitsRaw, 30);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, digits30 + ext);
    }
});

// Fix File Upload Vulnerability: Limit file size and type
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for high-res covers
    fileFilter: (req, file, cb) => {
        const allowedExt = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx/;
        const allowedMime = /image\/jpeg|image\/jpg|image\/png|image\/gif|image\/webp|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/;
        const extname = allowedExt.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedMime.test((file.mimetype || '').toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('仅支持 jpg/jpeg/png/gif/webp/pdf/doc/docx/xls/xlsx 文件'));
        }
    }
});

function parseUploadError(err) {
    if (!err) return null;
    if (err.code === 'LIMIT_FILE_SIZE') {
        return { status: 400, error: '文件大小超限：图片或附件请控制在 10MB 以内' };
    }
    if (err.message) {
        return { status: 400, error: err.message };
    }
    return { status: 500, error: '上传失败，请稍后重试' };
}

function toTosPublicUrl(key) {
    const base = String(process.env.TOS_PUBLIC_URL || '').replace(/\/+$/, '');
    return `${base}/${String(key).replace(/^\/+/, '')}`;
}

async function uploadLocalFileToTos(localAbsPath, objectKey, contentType) {
    if (!useTosUpload || !tosClient) return null;
    if (!fs.existsSync(localAbsPath)) return null;
    const fileBuffer = await fs.promises.readFile(localAbsPath);
    await tosClient.send(
        new PutObjectCommand({
            Bucket: process.env.TOS_BUCKET_NAME,
            Key: objectKey,
            Body: fileBuffer,
            ContentLength: fileBuffer.length,
            ContentType: contentType || 'application/octet-stream'
        })
    );
    return toTosPublicUrl(objectKey);
}

// Helper: Operation Logging
async function logOp(action, module, detail, operator) {
    try {
        await OperationLog.create({
            action,
            module,
            detail,
            operator: operator || 'System',
            ip: '127.0.0.1' // Simplify for now
        });
    } catch (e) {
        console.error('Logging failed:', e);
    }
}

const tosFallbackAlertState = {
    windowStart: 0,
    windowCount: 0,
    lastSentAt: 0
};

function buildSignedDingTalkWebhookUrl() {
    const webhookUrl = process.env.DINGTALK_WEBHOOK_URL;
    const secret = process.env.DINGTALK_SECRET;
    if (!webhookUrl) return null;
    if (!secret) return webhookUrl;
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
    return `${webhookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
}

async function notifyTosFallbackAlert(reason) {
    try {
        const now = Date.now();
        const windowMs = 5 * 60 * 1000;
        const threshold = 3;
        const cooldownMs = 10 * 60 * 1000;
        if (now - tosFallbackAlertState.windowStart > windowMs) {
            tosFallbackAlertState.windowStart = now;
            tosFallbackAlertState.windowCount = 0;
        }
        tosFallbackAlertState.windowCount += 1;
        if (tosFallbackAlertState.windowCount < threshold) return;
        if (now - tosFallbackAlertState.lastSentAt < cooldownMs) return;
        tosFallbackAlertState.lastSentAt = now;

        const finalUrl = buildSignedDingTalkWebhookUrl();
        if (!finalUrl) {
            console.error(`[ALERT][TOS_FALLBACK] ${reason}`);
            return;
        }
        const message = {
            msgtype: 'markdown',
            markdown: {
                title: 'TOS 上传回退告警',
                text: `## TOS 上传回退告警\n\n` +
                    `- 时间：${new Date(now).toLocaleString('zh-CN')}\n` +
                    `- 环境：${process.env.NODE_ENV || 'unknown'}\n` +
                    `- 桶：${process.env.TOS_BUCKET_NAME || '(empty)'}\n` +
                    `- 原因：${reason}\n` +
                    `\n> 5分钟内累计触发达到阈值，已触发告警，请检查 AK/SK、权限、Endpoint 与网络。`
            }
        };
        await axios.post(finalUrl, message, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.error(`[ALERT][TOS_FALLBACK] ${reason}`);
    } catch (err) {
        console.error('notifyTosFallbackAlert failed:', err.message);
    }
}

// --- Permission Middleware ---
async function checkPerm(req, res, next, requiredPerm) {
    // If authRequired passed, req.user is set
    // But we need full user details to check role permissions properly
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        
        // Fetch fresh user/role data
        const admin = await Admin.findById(req.user.id).populate('roles');
        if (!admin || !admin.isActive) return res.status(403).json({ error: 'Account disabled or not found' });
        
        // Check if roles exist
        if (!admin.roles || admin.roles.length === 0) return res.status(403).json({ error: 'No roles assigned' });
        
        // Aggregate permissions
        const allPerms = new Set();
        admin.roles.forEach(role => {
            if (role.permissions) {
                role.permissions.forEach(p => allPerms.add(p));
            }
        });
        
        if (allPerms.has('all')) {
            return next();
        }

        const requiredPerms = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];
        if (requiredPerms.some(perm => allPerms.has(perm))) {
            return next();
        }

        return res.status(403).json({ error: 'Permission denied: ' + requiredPerms.join(' or ') });
    } catch (e) {
        console.error('Perm Check Error:', e);
        res.status(500).json({ error: 'Internal Error' });
    }
}

const requirePerm = (perm) => {
    return (req, res, next) => checkPerm(req, res, next, perm);
};

const requireAnyPerm = (perms) => {
    return (req, res, next) => checkPerm(req, res, next, perms);
};

function normalizeRoleIds(roleIds) {
    if (!Array.isArray(roleIds)) return [];
    return [...new Set(roleIds.map(id => String(id || '').trim()).filter(Boolean))];
}

async function validateAdminRoleIds(roleIds) {
    const normalized = normalizeRoleIds(roleIds);
    if (normalized.length === 0) {
        return { ok: false, error: '至少需要分配一个角色' };
    }
    const invalidId = normalized.find(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidId) {
        return { ok: false, error: `无效的角色ID: ${invalidId}` };
    }
    const roles = await Role.find({ _id: { $in: normalized }, isActive: { $ne: false } });
    if (roles.length !== normalized.length) {
        return { ok: false, error: '存在不存在或已停用的角色' };
    }
    return { ok: true, roleIds: normalized, roles };
}

function rolesHaveAll(roles) {
    return Array.isArray(roles) && roles.some(role => Array.isArray(role.permissions) && role.permissions.includes('all'));
}

async function countActiveSuperAdmins(excludeAdminId = null) {
    const allRoles = await Role.find({ permissions: 'all', isActive: { $ne: false } }).select('_id');
    if (allRoles.length === 0) return 0;
    const query = {
        isActive: { $ne: false },
        roles: { $in: allRoles.map(role => role._id) }
    };
    if (excludeAdminId) query._id = { $ne: excludeAdminId };
    return Admin.countDocuments(query);
}

// --- Auth Routes ---
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username }).populate('roles');
        
        if (!admin) {
            return res.status(401).json({ success: false, message: '用户不存在' });
        }
        
        // Check password (if hashed) or plain text (for legacy/dev)
        // Assume all passwords should be hashed, but for safety in dev, check plain if match
        let isMatch = false;
        if (admin.password.startsWith('$')) {
             isMatch = await bcrypt.compare(password, admin.password);
        } else {
             // REMOVED plaintext fallback for security
             // isMatch = (password === admin.password);
             console.warn(`User ${username} has a plaintext password. Please reset it.`);
             return res.status(401).json({ success: false, message: 'Password security upgrade required. Please contact admin.' });
        }

        if (!isMatch) {
            return res.status(401).json({ success: false, message: '密码错误' });
        }

        if (!admin.isActive) {
            return res.status(403).json({ success: false, message: '账号已禁用' });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        const token = jwt.sign({ id: admin._id, username: admin.username, roles: admin.roles }, RUNTIME_SECRET_KEY, { expiresIn: '24h' });
        const permissionSet = gatherPermissions(admin);
        const permissions = Array.from(permissionSet);
        res.cookie('admin_token', token, {
            ...ADMIN_AUTH_COOKIE_OPTIONS,
            maxAge: 24 * 60 * 60 * 1000
        });
        
        await logOp('login', 'Auth', `User ${username} logged in`, username);

        res.json({ success: true, token, admin: { id: admin._id, name: admin.name, roles: admin.roles, permissions } });

    } catch (e) {
        console.error('Login Error:', e);
        res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
    }
});

app.post('/api/logout', (req, res) => {
    clearAdminAuthCookie(res);
    res.json({ success: true });
});

// Token verify
app.get('/api/auth/verify', authRequired, async (req, res) => {
    const admin = await Admin.findById(req.user.id).populate('roles');
    if (!admin || !admin.isActive) {
        return res.status(403).json({ error: 'Account disabled or not found' });
    }
    const permissionSet = gatherPermissions(admin);
    res.json({
        success: true,
        user: {
            ...req.user,
            permissions: Array.from(permissionSet)
        }
    });
});

app.get('/api/permissions/dictionary', authRequired, requirePerm('all'), (req, res) => {
    res.json({ success: true, groups: PERMISSION_GROUPS, permissions: PERMISSION_CODES });
});

// --- SEO Config API ---
app.get('/api/admin/seo', authRequired, requirePerm('system:manage'), async (req, res) => {
    try {
        const { pagePath } = req.query;
        if (!pagePath) return res.status(400).json({ success: false, error: 'pagePath is required' });
        
        const config = await SeoConfig.findOne({ pagePath });
        
        let defaultTitle = '';
        let defaultKeywords = '';
        let defaultDescription = '';
        
        try {
            const fs = require('fs');
            const { JSDOM } = require('jsdom');
            const filePath = require('path').join(__dirname, pagePath.startsWith('/') ? pagePath.substring(1) : pagePath);
            if (fs.existsSync(filePath)) {
                const html = await fs.promises.readFile(filePath, 'utf8');
                const dom = new JSDOM(html);
                const doc = dom.window.document;
                
                defaultTitle = doc.title || '';
                const kwMeta = doc.querySelector('meta[name="keywords"]');
                if (kwMeta) defaultKeywords = kwMeta.content || '';
                
                const descMeta = doc.querySelector('meta[name="description"]');
                if (descMeta) defaultDescription = descMeta.content || '';
            }
        } catch (fileErr) {
            console.warn(`Could not read default SEO from ${pagePath}:`, fileErr);
        }

        const data = {
            title: config && config.title ? config.title : defaultTitle,
            keywords: config && config.keywords ? config.keywords : defaultKeywords,
            description: config && config.description ? config.description : defaultDescription
        };

        res.json({ success: true, data });
    } catch (e) {
        console.error('SEO Get Error:', e);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/api/admin/seo', authRequired, requirePerm('system:manage'), async (req, res) => {
    try {
        const { pagePath, title, keywords, description } = req.body;
        if (!pagePath) return res.status(400).json({ success: false, error: 'pagePath is required' });
        
        let config = await SeoConfig.findOne({ pagePath });
        if (config) {
            config.title = title;
            config.keywords = keywords;
            config.description = description;
        } else {
            config = new SeoConfig({ pagePath, title, keywords, description });
        }
        await config.save();
        res.json({ success: true, data: config });
    } catch (e) {
        console.error('SEO Post Error:', e);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// --- Dashboard Stats API (Restored) ---
app.get('/api/dashboard/stats', authRequired, requirePerm('dashboard:view'), async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        let start, end;

        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            end = new Date();
            start = new Date();
            start.setDate(end.getDate() - 6);
            start.setHours(0, 0, 0, 0);
        }

        const dates = [];
        let current = new Date(start);
        while (current <= end) {
            dates.push(current.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }));
            current.setDate(current.getDate() + 1);
        }

        const [apptStats, artStats, logStats] = await Promise.all([
            Appointment.aggregate([
                { $match: { createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: { $dateToString: { format: "%m/%d", date: "$createdAt", timezone: "+08:00" } }, count: { $sum: 1 } } }
            ]),
            Article.aggregate([
                { $match: { publishDate: { $gte: start, $lte: end } } },
                { $group: { _id: { $dateToString: { format: "%m/%d", date: "$publishDate", timezone: "+08:00" } }, count: { $sum: 1 } } }
            ]),
            OperationLog.aggregate([
                { $match: { createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: { $dateToString: { format: "%m/%d", date: "$createdAt", timezone: "+08:00" } }, count: { $sum: 1 } } }
            ])
        ]);

        const mapStats = (stats) => dates.map(date => {
            const found = stats.find(s => s._id === date);
            return found ? found.count : 0;
        });

        // Mock visits for demo
        const visits = dates.map(() => Math.floor(Math.random() * 500) + 800);

        res.json({
            dates,
            series: {
                visits,
                appointments: mapStats(apptStats),
                articles: mapStats(artStats),
                logs: mapStats(logStats)
            },
            summary: {
                totalVisits: 12045 + Math.floor(Math.random() * 100),
                totalAppts: await Appointment.countDocuments(),
                totalArts: await Article.countDocuments(),
                pendingFaqs: 0 // Placeholder
            }
        });
    } catch (e) {
        console.error('Stats Error:', e);
        return sendInternalError(res, null, e);
    }
});

// --- Article Routes ---
app.get('/article/:slug', async (req, res) => {
    try {
        let slug = req.params.slug;
        // Strip .html extension if present
        if (slug.endsWith('.html')) {
            slug = slug.slice(0, -5);
        }

        let article = await Article.findOne({ slug, status: 'published' }).populate('authorId');

        // Check if article exists and is published (Feature Flag: ENABLE_STRICT_404, default true)
        if (process.env.ENABLE_STRICT_404 !== 'false') {
            if (!article) {
                // Article not found or deleted
                res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.status(404).sendFile(path.join(__dirname, '404.html'));
                return;
            }
        }

        // Article exists, send the template with SSR tags
        await renderArticlePage(req, res, article);
    } catch (e) {
        console.error('Article Route Error:', e);
        res.status(500).send('Internal Server Error');
    }
});

// Also handle the case where .html is part of the url explicitly if the above doesn't catch it
app.get('/article/:slug.html', async (req, res) => {
    try {
        let slug = req.params.slug;
        const article = await Article.findOne({ slug, status: 'published' }).populate('authorId');
        if (!article && process.env.ENABLE_STRICT_404 !== 'false') {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.status(404).sendFile(path.join(__dirname, '404.html'));
            return;
        }
        await renderArticlePage(req, res, article);
    } catch (e) {
        console.error('Article HTML Route Error:', e);
        res.status(500).send('Internal Server Error');
    }
});

// --- Article API ---
app.get('/api/articles', async (req, res) => {
    try {
        const { keyword, category, featured, page, limit, status, tag } = req.query;
        let query = {};
        
        if (keyword && keyword.length <= 200) {
            const regex = new RegExp(escapeRegex(keyword), 'i');
            query.$or = [{ title: regex }, { content: regex }, { summary: regex }];
        }
        
        if (category && category !== 'all') {
            query.category = category;
        }

        if (featured === 'true') {
            query.isRecommended = true;
        }

        query.status = 'published';
        if (status === 'published') query.status = 'published';

        if (tag) {
            query.tags = tag;
        }

        let articles;
        if (page && limit) {
            const skip = (page - 1) * limit;
            const total = await Article.countDocuments(query);
            const data = await Article.find(query)
                .sort({ publishDate: -1 })
                .skip(parseInt(skip))
                .limit(parseInt(limit));
            
            res.json({
                data,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            });
        } else {
            // Backward compatibility for non-paginated calls (if any)
            articles = await Article.find(query).sort({ publishDate: -1 });
            res.json(articles);
        }
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.get('/api/admin/articles', authRequired, requirePerm('article:list'), async (req, res) => {
    try {
        const { keyword, category, featured, page, limit, status, tag } = req.query;
        let query = {};
        if (keyword && keyword.length <= 200) {
            const regex = new RegExp(escapeRegex(keyword), 'i');
            query.$or = [{ title: regex }, { content: regex }, { summary: regex }];
        }
        if (category && category !== 'all') {
            query.category = category;
        }
        if (featured === 'true') {
            query.isRecommended = true;
        }
        if (status && status !== 'all') {
            query.status = status;
        }
        if (tag) {
            query.tags = tag;
        }
        let articles;
        if (page && limit) {
            const skip = (page - 1) * limit;
            const total = await Article.countDocuments(query);
            const data = await Article.find(query).sort({ publishDate: -1 }).skip(parseInt(skip)).limit(parseInt(limit));
            return res.json({ data, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
        }
        articles = await Article.find(query).sort({ publishDate: -1 });
        res.json(articles);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.get('/api/articles/detail/query', async (req, res) => {
    try {
        const { slug } = req.query;
        if (!slug) return res.status(400).json({ error: 'Slug is required' });
        
        // Increment views without triggering update hooks/timestamps issues
        await Article.updateOne({ slug, status: 'published' }, { $inc: { views: 1 } });
        
        const article = await Article.findOne({ slug, status: 'published' }).populate('authorId');
        if (!article) return res.status(404).json({ error: 'Article not found' });
        const result = article.toObject ? article.toObject() : article;
        result.author = getResolvedArticleAuthor(article);
        res.json(result);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.get('/api/articles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // console.log('Checking article ID:', id);
        if (!mongoose.Types.ObjectId.isValid(id)) {
            // console.log('Invalid ID detected');
            return res.status(404).json({ error: 'Invalid article id' });
        }
        
        await Article.updateOne({ _id: id, status: 'published' }, { $inc: { views: 1 } });
        
        const article = await Article.findOne({ _id: id, status: 'published' }).populate('authorId');
        if (!article) return res.status(404).json({ error: 'Article not found' });
        const result = article.toObject ? article.toObject() : article;
        result.author = getResolvedArticleAuthor(article);
        res.json(result);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.get('/api/admin/articles/:id', authRequired, requirePerm('article:list'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ error: 'Invalid article id' });
        }
        const article = await Article.findById(id);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/articles', authRequired, requirePerm('article:create'), async (req, res) => {
    try {
        const payload = sanitizeArticlePayload(req.body);
        const { slug } = payload;
        // Check uniqueness
        if (slug) {
            const existing = await Article.findOne({ slug });
            if (existing) {
                return res.status(400).json({ error: 'URL (Slug) 已存在，请更换' });
            }
        }
        
        const newArticle = new Article(payload);
        
        // Ensure publishDate and updatedAt are identical on creation
        const now = new Date();
        if (!newArticle.publishDate) newArticle.publishDate = now;
        if (!newArticle.updatedAt) newArticle.updatedAt = now;
        
        // Handle slug if not provided
        if (!newArticle.slug) newArticle.slug = 'art-' + now.getTime();
        await newArticle.save();
        
        // Update category count
        if (payload.category) {
            await Category.updateOne({ code: payload.category }, { $inc: { articleCount: 1 } });
        }
        
        await syncLLMsTxt(newArticle); // Trigger llms.txt sync
        
        await logOp('create', 'Article', `Created article: ${newArticle.title}`, req.user.username);
        res.json({ success: true, data: newArticle });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: 'URL (Slug) 已存在' });
        return sendInternalError(res, 'Create article failed:', e);
    }
});

app.put('/api/articles/:id', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
        const payload = sanitizeArticlePayload(req.body);
        const { slug } = payload;
        // Check uniqueness for update
        if (slug) {
            const existing = await Article.findOne({ slug, _id: { $ne: req.params.id } });
            if (existing) {
                return res.status(400).json({ error: 'URL (Slug) 已存在，请更换' });
            }
        }

        const oldArt = await Article.findById(req.params.id);
        
        // Save History
        if (oldArt) {
            const historyCount = await ArticleHistory.countDocuments({ articleId: oldArt._id });
            await ArticleHistory.create({
                articleId: oldArt._id,
                title: oldArt.title,
                content: oldArt.content,
                summary: oldArt.summary,
                coverImage: oldArt.coverImage,
                tags: oldArt.tags,
                status: oldArt.status,
                editor: req.user.username,
                version: historyCount + 1
            });
        }

        const updatedArticle = await Article.findByIdAndUpdate(
            req.params.id, 
            { ...payload, updatedAt: Date.now() }, 
            { new: true }
        );
        
        // Handle category count update if changed
        if (oldArt && oldArt.category !== payload.category) {
             if (oldArt.category) await Category.updateOne({ code: oldArt.category }, { $inc: { articleCount: -1 } });
             if (payload.category) await Category.updateOne({ code: payload.category }, { $inc: { articleCount: 1 } });
        }

        await logOp('update', 'Article', `Updated article: ${updatedArticle.title}`, req.user.username);
        
        await syncLLMsTxt(updatedArticle); // Trigger llms.txt sync if published
        
        res.json({ success: true, data: updatedArticle });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: 'URL (Slug) 已存在' });
        return sendInternalError(res, 'Update article failed:', e);
    }
});

// --- Article History API ---
app.get('/api/articles/:id/history', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
        const history = await ArticleHistory.find({ articleId: req.params.id })
            .sort({ version: -1 })
            .limit(20);
        res.json(history);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

const Author = require('./models/Author'); // Import Author Model

// --- Author Management Routes ---
app.get('/api/authors', async (req, res) => {
    try {
        const authors = await Author.find().sort({ createdAt: -1 });
        res.json(authors);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/authors', authRequired, requirePerm('article:create'), async (req, res) => {
    try {
        const author = new Author(req.body);
        await author.save();
        await logOp('create', 'Author', `Created author: ${author.name}`, req.user.username);
        res.json({ success: true, data: author });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.put('/api/authors/:id', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
        const author = await Author.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: Date.now() }, { new: true });
        if (!author) return res.status(404).json({ error: 'Author not found' });
        // Sync snapshot fields in existing articles to avoid stale author display in caches/lists.
        await Article.updateMany(
            { authorId: author._id },
            {
                $set: {
                    'author.name': author.name || '',
                    'author.avatar': author.avatar || '',
                    'author.desc': author.desc || '',
                    'author.detail': author.detail || ''
                }
            }
        );
        await logOp('update', 'Author', `Updated author: ${author.name}`, req.user.username);
        res.json({ success: true, data: author });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.delete('/api/authors/:id', authRequired, requirePerm('article:delete'), async (req, res) => {
    try {
        await Author.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Author', `Deleted author: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// --- llms.txt Sync Logic ---
async function rebuildLLMsTxt() {
    try {
        const fs = require('fs').promises;
        const publicPath = path.join(__dirname, 'public/llms.txt');
        const SITE_URL = process.env.SITE_URL || 'https://www.ruihuaconsulting.com';

        // Fetch all published articles with slugs, deduplicated
        const articles = await Article.find({ status: 'published', slug: { $exists: true, $nin: [null, ''] } })
            .sort({ publishDate: -1 })
            .lean();

        // Deduplicate by slug
        const seen = new Set();
        const unique = articles.filter(a => {
            if (seen.has(a.slug)) return false;
            seen.add(a.slug);
            return true;
        });

        let content = '# Ruihua Consulting Knowledge Base\n\n';
        content += `> 最后更新：${new Date().toISOString().split('T')[0]}\n`;
        content += `> 文章总数：${unique.length}\n\n`;

        for (const article of unique) {
            const canonicalUrl = `${SITE_URL}/article/${article.slug}.html`;
            const summary = (article.summary || '').replace(/\r?\n/g, ' ').substring(0, 200);
            const tags = (article.tags || []).slice(0, 5).filter(Boolean);
            const date = article.publishDate ? new Date(article.publishDate).toISOString().split('T')[0] : '';

            content += `## ${article.title}\n`;
            content += `- URL: ${canonicalUrl}\n`;
            content += `- Date: ${date}\n`;
            if (tags.length) content += `- Tags: ${tags.join(', ')}\n`;
            content += `- Summary: ${summary || '暂无摘要'}\n\n`;
        }

        await fs.writeFile(publicPath, content);
        console.log(`llms.txt rebuilt: ${unique.length} articles`);
    } catch (e) {
        console.error('llms.txt rebuild failed:', e);
    }
}

// Rebuild on article create/update if published
async function syncLLMsTxt(article) {
    if (article && article.status !== 'published') return;
    await rebuildLLMsTxt();
}

// Route to serve llms.txt from root
app.get('/llms.txt', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/llms.txt'));
});

// Update Article Create/Update to trigger Sync
// We need to inject this into existing POST/PUT /api/articles routes.
// Instead of rewriting the whole block, I will append the function call in the next SearchReplace or manual edit.
// Wait, I can't easily inject into the middle of a function with SearchReplace without matching a large block.
// I will place these new routes BEFORE the article routes or AFTER.
// Placing them here (around line 1100) is fine.

app.get('/api/articles/history/:historyId', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
        const record = await ArticleHistory.findById(req.params.historyId);
        if (!record) return res.status(404).json({ error: 'History record not found' });
        res.json(record);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/articles/:id/restore/:historyId', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
        const history = await ArticleHistory.findById(req.params.historyId);
        if (!history) return res.status(404).json({ error: 'History record not found' });
        
        // Save current as history before restore
        const current = await Article.findById(req.params.id);
        if (current) {
            const historyCount = await ArticleHistory.countDocuments({ articleId: current._id });
            await ArticleHistory.create({
                articleId: current._id,
                title: current.title,
                content: current.content,
                summary: current.summary,
                coverImage: current.coverImage,
                tags: current.tags,
                status: current.status,
                editor: req.user.username,
                version: historyCount + 1
            });
        }

        const restored = await Article.findByIdAndUpdate(req.params.id, {
            title: history.title,
            content: history.content,
            summary: history.summary,
            coverImage: history.coverImage,
            tags: history.tags,
            status: history.status,
            updatedAt: Date.now() // Ensure updated time is refreshed on restore
        }, { new: true });

        await logOp('update', 'Article', `Restored article ${req.params.id} to version ${history.version}`, req.user.username);
        res.json({ success: true, data: restored });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/articles/:id/like', async (req, res) => {
    try {
        const article = await Article.findByIdAndUpdate(
            req.params.id, 
            { $inc: { likes: 1 } }, 
            { new: true }
        );
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json({ success: true, likes: article.likes });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.delete('/api/articles/:id', authRequired, requirePerm('article:delete'), async (req, res) => {
    try {
        const art = await Article.findByIdAndDelete(req.params.id);
        if (art && art.category) {
            await Category.updateOne({ code: art.category }, { $inc: { articleCount: -1 } });
        }
        await logOp('delete', 'Article', `Deleted article: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// Batch Delete
app.post('/api/articles/batch-delete', authRequired, requirePerm('article:delete'), async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid IDs' });
        }
        
        // Find articles to decrement category counts
        const articles = await Article.find({ _id: { $in: ids } });
        for (const art of articles) {
            if (art.category) {
                await Category.updateOne({ code: art.category }, { $inc: { articleCount: -1 } });
            }
        }

        await Article.deleteMany({ _id: { $in: ids } });
        await logOp('delete', 'Article', `Batch deleted ${ids.length} articles`, req.user.username);
        res.json({ success: true, count: ids.length });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// Batch Status Update
app.post('/api/articles/batch-status', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
        const { ids, status } = req.body;
        if (!Array.isArray(ids) || ids.length === 0 || !status) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }

        await Article.updateMany({ _id: { $in: ids } }, { status });
        await logOp('update', 'Article', `Batch updated status to ${status} for ${ids.length} articles`, req.user.username);
        res.json({ success: true, count: ids.length });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// --- Category API ---
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort({ order: 1 });
        res.json(categories);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/categories', authRequired, requirePerm('article:create'), async (req, res) => {
    try {
        const newCat = new Category(req.body);
        await newCat.save();
        await logOp('create', 'Category', `Created category: ${newCat.name}`, req.user.username);
        res.json({ success: true, data: newCat });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.put('/api/categories/:id', authRequired, requirePerm('article:edit'), async (req, res) => {
    try {
        const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: cat });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.delete('/api/categories/:id', authRequired, requirePerm('article:delete'), async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        // Note: Should we handle articles in this category? For now, just leave them.
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});


// --- FAQ API ---
app.get('/api/faqs', async (req, res) => {
    try {
        const query = {};
        if (req.query.status) {
            query.status = req.query.status;
        }
        let faqsQuery = Faq.find(query).sort({ order: 1 });
        if (req.query.limit) {
            faqsQuery = faqsQuery.limit(parseInt(req.query.limit));
        }
        const faqs = await faqsQuery;
        res.json(faqs);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.get('/api/home/content', async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit || '3', 10), 1), 12);
        const faqLimit = Math.min(Math.max(parseInt(req.query.faqLimit || '5', 10), 1), 20);
        const includeFaqs = req.query.includeFaqs !== 'false';
        const skip = (page - 1) * limit;

        const [articles, total, categories, faqs] = await Promise.all([
            Article.find({ status: 'published', isRecommended: true })
                .sort({ publishDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Article.countDocuments({ status: 'published', isRecommended: true }),
            Category.find({}).lean(),
            includeFaqs
                ? Faq.find({ status: { $in: ['published', undefined] } }).sort({ order: 1 }).limit(faqLimit).lean()
                : Promise.resolve([])
        ]);

        const categoryMap = {};
        categories.forEach((item) => {
            if (item?.code && item?.name) categoryMap[item.code] = item.name;
        });

        res.json({
            success: true,
            data: {
                page,
                limit,
                total,
                hasMore: skip + articles.length < total,
                articles: articles || [],
                faqs: faqs || [],
                categoryMap
            }
        });
    } catch (e) {
        console.error('/api/home/content failed:', e);
        res.status(500).json({ success: false, error: 'Failed to load homepage content' });
    }
});

app.get('/api/faqs/:id', async (req, res) => {
    try {
        const faq = await Faq.findById(req.params.id);
        if (!faq) return res.status(404).json({ error: 'FAQ not found' });
        res.json(faq);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/faqs', authRequired, requirePerm('faq:create'), async (req, res) => {
    try {
        // Remove category if passed (User requested removal)
        const { category, ...rest } = req.body;
        
        if (rest.answer) {
            rest.answer = xss(rest.answer);
        }
        
        const newFaq = new Faq(rest);
        await newFaq.save();
        await logOp('create', 'FAQ', `Created FAQ: ${newFaq.question}`, req.user.username);
        res.json({ success: true, data: newFaq });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.put('/api/faqs/:id', authRequired, requirePerm('faq:edit'), async (req, res) => {
    try {
        const { category, ...rest } = req.body;
        
        if (rest.answer) {
            rest.answer = xss(rest.answer);
        }
        
        const faq = await Faq.findByIdAndUpdate(req.params.id, { ...rest, updatedAt: Date.now() }, { new: true });
        await logOp('update', 'FAQ', `Updated FAQ: ${faq.question}`, req.user.username);
        res.json({ success: true, data: faq });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.delete('/api/faqs/:id', authRequired, requirePerm('faq:delete'), async (req, res) => {
    try {
        await Faq.findByIdAndDelete(req.params.id);
        await logOp('delete', 'FAQ', `Deleted FAQ: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// --- Maturity/Diagnostic Submission API ---
app.post('/api/maturity-submission', async (req, res) => {
    try {
        const { answers, score, level, resultDetail, name, phone, company } = req.body;
        
        if (!answers || !score || !level) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const submission = new MaturitySubmission({
            answers,
            score,
            level,
            resultDetail,
            name, 
            phone, 
            company
        });

        await submission.save();
        await logOp('create', 'Diagnostic', `New diagnostic submission with score: ${score}`);
        
        res.json({ success: true, id: submission._id });
    } catch (e) {
        console.error('Diagnostic Submission Error:', e);
        return sendInternalError(res, null, e);
    }
});

// --- Admin/User API ---
// Only super admins (perm 'all') or specific user management perm should access this
// We'll assume 'all' for now as per permission list, or add 'user:manage'
// The current list has 'all' and business perms. Let's use 'all' for user management for now or check if there is a specific one.
// The dict had: 'article:...', 'faq:...', 'banner:...', 'sidebar:...', 'appointment:...'.
// No 'user:...' in the provided list. So we restrict to 'all' (Super Admin).

app.get('/api/admins', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const admins = await Admin.find().populate('roles');
        res.json(admins);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/admins', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const { username, password, roles, name } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Password Policy Check
        const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!pwdRegex.test(password)) {
            return res.status(400).json({ error: '密码必须包含字母和数字，且至少8位' });
        }

        const roleValidation = await validateAdminRoleIds(roles);
        if (!roleValidation.ok) {
            return res.status(400).json({ error: roleValidation.error });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newAdmin = new Admin({
            username,
            password: hashedPassword,
            name,
            roles: roleValidation.roleIds,
            createdBy: req.user.username,
            lastPasswordChangedAt: new Date(),
            isActive: true
        });
        
        await newAdmin.save();
        await logOp('create', 'Admin', `Created user: ${username}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: '用户名已存在' });
        return sendInternalError(res, null, e);
    }
});

app.put('/api/admins/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const { username, password, roles, name, isActive } = req.body;
        const target = await Admin.findById(req.params.id).populate('roles');
        if (!target) return res.status(404).json({ error: '用户不存在' });
        const isSelf = String(req.user.id) === String(req.params.id);
        const updates = { username, name, updatedBy: req.user.username };

        // Check if username exists (if changed)
        if (username) {
            const existing = await Admin.findOne({ username, _id: { $ne: req.params.id } });
            if (existing) return res.status(400).json({ error: '用户名已存在' });
        }

        let nextRoles = target.roles || [];
        if (roles !== undefined) {
            const roleValidation = await validateAdminRoleIds(roles);
            if (!roleValidation.ok) {
                return res.status(400).json({ error: roleValidation.error });
            }
            nextRoles = roleValidation.roles;
            updates.roles = roleValidation.roleIds;
        }

        if (isActive !== undefined) {
            const nextActive = Boolean(isActive);
            if (isSelf && !nextActive) {
                return res.status(400).json({ error: '不能禁用当前登录用户' });
            }
            if (target.isActive && !nextActive && rolesHaveAll(target.roles)) {
                const remainingSuperAdmins = await countActiveSuperAdmins(req.params.id);
                if (remainingSuperAdmins < 1) {
                    return res.status(400).json({ error: '不能禁用最后一个超级管理员' });
                }
            }
            updates.isActive = nextActive;
        }

        if (isSelf && !rolesHaveAll(nextRoles)) {
            return res.status(400).json({ error: '不能移除当前用户的超级管理员权限' });
        }

        if (target.isActive && rolesHaveAll(target.roles) && !rolesHaveAll(nextRoles)) {
            const remainingSuperAdmins = await countActiveSuperAdmins(req.params.id);
            if (remainingSuperAdmins < 1) {
                return res.status(400).json({ error: '不能移除最后一个超级管理员权限' });
            }
        }

        // Handle password update
        if (password) {
            // Password Policy Check
            const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
            if (!pwdRegex.test(password)) {
                return res.status(400).json({ error: '密码必须包含字母和数字，且至少8位' });
            }
            updates.password = await bcrypt.hash(password, 10);
            updates.lastPasswordChangedAt = new Date();
        }

        await Admin.findByIdAndUpdate(req.params.id, updates);
        await logOp('update', 'Admin', `Updated user: ${username || req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.delete('/api/admins/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
        if (String(req.user.id) === String(req.params.id)) {
            return res.status(400).json({ error: '不能删除当前登录用户' });
        }
        const target = await Admin.findById(req.params.id).populate('roles');
        if (!target) return res.status(404).json({ error: '用户不存在' });
        if (target.isActive && rolesHaveAll(target.roles)) {
            const remainingSuperAdmins = await countActiveSuperAdmins(req.params.id);
            if (remainingSuperAdmins < 1) {
                return res.status(400).json({ error: '不能删除最后一个超级管理员' });
            }
        }
        await Admin.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Admin', `Deleted user: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// --- Role API ---
app.get('/api/roles', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const roles = await Role.find();
        res.json(roles);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/roles', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const { name, code, permissions, description } = req.body;
        
        // Required fields
        if (!name) return res.status(400).json({ error: '角色名称为必填项' });

        // Unique checks
        const existing = await Role.findOne({ name });
        if (existing) return res.status(400).json({ error: '角色名称已存在' });
        
        let roleCode = code;
        if (!roleCode) {
            // Auto-generate code
            roleCode = slugify(name, { separator: '_' });
            // Ensure unique
            let counter = 1;
            let tempCode = roleCode;
            while (await Role.findOne({ code: tempCode })) {
                tempCode = `${roleCode}_${counter}`;
                counter++;
            }
            roleCode = tempCode;
        } else {
             const existingCode = await Role.findOne({ code: roleCode });
             if (existingCode) return res.status(400).json({ error: '角色代码已存在' });
        }

        // Permissions validation
        const { permissions: perms, invalid } = validatePermissions(permissions);
        if (invalid.length > 0) return res.status(400).json({ error: '无效的权限项: ' + invalid.join(', ') });

        const newRole = new Role({ name, code: roleCode, permissions: perms, description, createdBy: req.user.username });
        await newRole.save();
        await logOp('create', 'Role', `Created role: ${name}`, req.user.username);
        res.json({ success: true, data: newRole });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.put('/api/roles/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const { name, code, permissions, description } = req.body;
        const roleBefore = await Role.findById(req.params.id);
        if (!roleBefore) return res.status(404).json({ error: '角色不存在' });
        if (roleBefore.isSystem && permissions !== undefined) {
            return res.status(400).json({ error: '系统角色的权限不能直接修改' });
        }
        if (name) {
             const existing = await Role.findOne({ name, _id: { $ne: req.params.id } });
             if (existing) return res.status(400).json({ error: '角色名称已存在' });
        }
        if (code) {
             const existingCode = await Role.findOne({ code, _id: { $ne: req.params.id } });
             if (existingCode) return res.status(400).json({ error: '角色代码已存在' });
        }
        const updates = { name, code, description, updatedBy: req.user.username };
        if (permissions !== undefined) {
             const { permissions: perms, invalid } = validatePermissions(permissions);
             if (invalid.length > 0) return res.status(400).json({ error: '无效的权限项: ' + invalid.join(', ') });
             const oldPerms = Array.isArray(roleBefore.permissions) ? roleBefore.permissions : [];
             if (oldPerms.includes('all') && !perms.includes('all')) {
                const otherAllRoles = await Role.find({ _id: { $ne: roleBefore._id }, permissions: 'all', isActive: { $ne: false } }).select('_id');
                const adminsWithOtherAllRole = otherAllRoles.length
                    ? await Admin.countDocuments({ isActive: { $ne: false }, roles: { $in: otherAllRoles.map(role => role._id) } })
                    : 0;
                if (adminsWithOtherAllRole < 1) {
                    return res.status(400).json({ error: '不能移除最后一个超级角色的全部权限' });
                }
             }
             updates.permissions = perms;
        }
        
        const role = await Role.findByIdAndUpdate(req.params.id, updates, { new: true });
        res.json({ success: true, data: role });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.delete('/api/roles/:id', authRequired, requirePerm('all'), async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) return res.status(404).json({ error: '角色不存在' });
        if (role.isSystem) return res.status(400).json({ error: '系统角色不能删除' });
        const usersUsingRole = await Admin.countDocuments({ roles: req.params.id });
        if (usersUsingRole > 0) {
            return res.status(400).json({ error: '该角色仍有关联用户，不能删除' });
        }
        if (Array.isArray(role.permissions) && role.permissions.includes('all')) {
            const remainingAllRoles = await Role.countDocuments({ _id: { $ne: role._id }, permissions: 'all', isActive: { $ne: false } });
            if (remainingAllRoles < 1) return res.status(400).json({ error: '不能删除最后一个超级角色' });
        }
        await Role.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Role', `Deleted role: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// --- Settings/Banner/Sidebar API ---
app.get('/api/banner', async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'banner' });
        res.json(setting ? setting.value : {});
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.put('/api/banner', authRequired, requirePerm('banner:manage'), async (req, res) => {
    try {
        await Setting.findOneAndUpdate(
            { key: 'banner' },
            { value: req.body, updatedAt: Date.now() },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.get('/api/sidebar/modules', async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'sidebar_modules' });
        res.json({ success: true, data: setting ? setting.value : [] });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
});

app.post('/api/sidebar/modules', authRequired, requirePerm('sidebar:manage'), async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'sidebar_modules' });
        let modules = setting ? setting.value : [];
        if (!Array.isArray(modules)) modules = [];
        
        if (modules.length >= 5) {
            return res.status(400).json({ success: false, error: '最多只能配置5个侧边栏模块' });
        }
        
        const newModule = {
            _id: new mongoose.Types.ObjectId().toString(),
            ...req.body
        };
        
        modules.push(newModule);
        
        await Setting.findOneAndUpdate(
            { key: 'sidebar_modules' },
            { value: modules, updatedAt: Date.now() },
            { upsert: true, new: true }
        );
        
        res.json({ success: true, data: newModule });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
});

app.put('/api/sidebar/modules/:id', authRequired, requirePerm('sidebar:manage'), async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'sidebar_modules' });
        if (!setting) return res.status(404).json({ success: false, error: '模块不存在' });
        
        let modules = setting.value;
        const index = modules.findIndex(m => m._id === req.params.id);
        if (index === -1) return res.status(404).json({ success: false, error: '模块不存在' });
        
        modules[index] = { ...modules[index], ...req.body };
        
        await Setting.findOneAndUpdate(
            { key: 'sidebar_modules' },
            { value: modules, updatedAt: Date.now() }
        );
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
});

app.delete('/api/sidebar/modules/:id', authRequired, requirePerm('sidebar:manage'), async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'sidebar_modules' });
        if (!setting) return res.status(404).json({ success: false, error: '模块不存在' });
        
        let modules = setting.value;
        modules = modules.filter(m => m._id !== req.params.id);
        
        await Setting.findOneAndUpdate(
            { key: 'sidebar_modules' },
            { value: modules, updatedAt: Date.now() }
        );
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
});


// NQOC Models
const NqocAwardApplication = require('./models/NqocAwardApplication');
const NqocDebateConfig = require('./models/NqocDebateConfig');
const NqocSurveyChannel = require('./models/NqocSurveyChannel');
const NqocAwardChannel = require('./models/NqocAwardChannel');
const NqocSurveySubmission = require('./models/NqocSurveySubmission');
const SurveyTrackingLog = require('./models/SurveyTrackingLog');
const TrainingApplication = require('./models/TrainingApplication');
const NqocExpertApplication = require('./models/NqocExpertApplication');


// File Upload configuration for public NQOC
const nqocStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public', 'uploads', 'nqoc');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, `award-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
});
const nqocUpload = multer({ 
    storage: nqocStorage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ==========================================
// Training Applications API
// ==========================================

// Client: Submit Training Application
app.post('/api/training/apply', async (req, res) => {
    try {
        const { name, phone, company, courseOption, verifyCode, source } = req.body;

        if (!name || !phone || !company || !courseOption || !verifyCode) {
            return res.status(400).json({ success: false, message: '请填写所有必填字段并输入验证码' });
        }

        if (!/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ success: false, message: '请输入有效的11位手机号码' });
        }

        // SMS Verification check (validates expiry + single-use, marks code as used)
        const codeCheck = await verifyCode(phone, verifyCode);
        if (!codeCheck.valid) {
            return res.status(400).json({ success: false, message: codeCheck.message || '验证码不正确或已过期' });
        }

        const newApp = new TrainingApplication({
            name,
            phone,
            company,
            courseOption,
            source: source || '自然流量'
        });

        await newApp.save();
        res.json({ success: true, message: '申请提交成功！我们的专家顾问将尽快与您联系。' });
    } catch (error) {
        console.error('Error submitting training application:', error);
        res.status(500).json({ success: false, message: '服务器错误，请稍后重试' });
    }
});

// Admin: Get Training Applications
app.get('/api/admin/training-applications', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: escapeRegex(search), $options: 'i' } },
                { phone: { $regex: escapeRegex(search), $options: 'i' } },
                { company: { $regex: escapeRegex(search), $options: 'i' } }
            ];
        }
        if (status) {
            query.status = status;
        }

        const applications = await TrainingApplication.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await TrainingApplication.countDocuments(query);

        res.json({
            success: true,
            data: applications,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching training applications:', error);
        res.status(500).json({ success: false, message: '获取数据失败' });
    }
});

// Admin: Update Training Application Status
app.put('/api/admin/training-applications/:id/status', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    try {
        const { status, remarks } = req.body;
        const application = await TrainingApplication.findById(req.params.id);
        
        if (!application) {
            return res.status(404).json({ success: false, message: '记录不存在' });
        }

        if (status) application.status = status;
        if (remarks !== undefined) application.remarks = remarks;

        await application.save();
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        console.error('Error updating training application:', error);
        res.status(500).json({ success: false, message: '更新失败' });
    }
});


// --- NQOC Award Application API ---
app.post('/api/nqoc/awards/apply', nqocUpload.single('file'), async (req, res) => {
    try {
        const { orgName, contactName, phone, awardCategory, channel } = req.body;
        
        if (!orgName || !contactName || !phone || !awardCategory) {
            return res.status(400).json({ success: false, error: '请填写所有必填字段' });
        }

        let fileUrl = '';
        if (req.file) {
            fileUrl = `/uploads/nqoc/${req.file.filename}`;
        }

        const newApplication = new NqocAwardApplication({
            orgName,
            contactName,
            phone,
            awardCategory,
            fileUrl,
            channel: channel || 'organic'
        });

        await newApplication.save();
        res.json({ success: true, message: '申报提交成功' });
    } catch (e) {
        console.error('NQOC Award Submit Error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' });
    }
});

// Admin: NQOC Award Channels CRUD
app.get('/api/admin/nqoc/awards/channels', authRequired, requireAnyPerm(['nqoc:list', 'nqoc:manage']), async (req, res) => {
    try {
        const channels = await NqocAwardChannel.find().sort({ createdAt: -1 }).lean();
        for (let ch of channels) {
            ch.submissionCount = await NqocAwardApplication.countDocuments({ channel: ch.code });
        }
        res.json({ success: true, data: channels });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

app.post('/api/admin/nqoc/awards/channels', authRequired, requireAnyPerm(['nqoc:edit', 'nqoc:manage']), async (req, res) => {
    try {
        const { name, code, description } = req.body;
        if (!name || !code) return res.status(400).json({ success: false, error: '渠道名称和代码为必填' });
        
        const exists = await NqocAwardChannel.findOne({ code });
        if (exists) return res.status(400).json({ success: false, error: '渠道代码已存在' });

        const channel = new NqocAwardChannel({ name, code, description });
        await channel.save();
        res.json({ success: true, data: channel });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

app.put('/api/admin/nqoc/awards/channels/:id', authRequired, requireAnyPerm(['nqoc:edit', 'nqoc:manage']), async (req, res) => {
    try {
        const { name, code, description } = req.body;
        const exists = await NqocAwardChannel.findOne({ code, _id: { $ne: req.params.id } });
        if (exists) return res.status(400).json({ success: false, error: '渠道代码已存在' });

        const channel = await NqocAwardChannel.findByIdAndUpdate(req.params.id, { name, code, description }, { new: true });
        if (!channel) return res.status(404).json({ success: false, error: '渠道不存在' });
        res.json({ success: true, data: channel });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

app.delete('/api/admin/nqoc/awards/channels/:id', authRequired, requireAnyPerm(['nqoc:delete', 'nqoc:manage']), async (req, res) => {
    try {
        await NqocAwardChannel.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// Admin API for NQOC Awards
app.get('/api/admin/nqoc/awards', authRequired, requireAnyPerm(['nqoc:list', 'nqoc:manage']), async (req, res) => {
    try {
        const { page = 1, limit = 20, keyword, channel, startDate, endDate } = req.query;
        let query = {};
        
        if (keyword) {
            query.$or = [
                { orgName: { $regex: escapeRegex(keyword), $options: 'i' } },
                { contactName: { $regex: escapeRegex(keyword), $options: 'i' } },
                { phone: { $regex: escapeRegex(keyword), $options: 'i' } }
            ];
        }
        if (channel) {
            query.channel = channel;
        }
        if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const applications = await NqocAwardApplication.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
            
        const total = await NqocAwardApplication.countDocuments(query);
        
        res.json({
            success: true,
            data: applications,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (e) {
        console.error('Fetch NQOC Awards Error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误: ' + e.message });
    }
});

app.delete('/api/admin/nqoc/awards/:id', authRequired, requireAnyPerm(['nqoc:delete', 'nqoc:manage']), async (req, res) => {
    try {
        const deleted = await NqocAwardApplication.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: '记录不存在' });
        res.json({ success: true });
    } catch (e) {
        console.error('Delete NQOC Award Error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// Update NQOC Award Display Status & Details
app.put('/api/admin/nqoc/awards/:id/display', authRequired, requireAnyPerm(['nqoc:edit', 'nqoc:manage']), async (req, res) => {
    try {
        const { showOnFrontend, description, voteCount, status } = req.body;
        const updateData = {};
        if (showOnFrontend !== undefined) updateData.showOnFrontend = showOnFrontend;
        if (description !== undefined) updateData.description = description;
        if (voteCount !== undefined) updateData.voteCount = voteCount;
        if (status !== undefined) updateData.status = status;

        const application = await NqocAwardApplication.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!application) return res.status(404).json({ success: false, error: '记录不存在' });
        res.json({ success: true, data: application });
    } catch (e) {
        console.error('Update NQOC Award Display Error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// Get Shortlisted Awards for Frontend
app.get('/api/nqoc/awards/shortlisted', async (req, res) => {
    try {
        const shortlisted = await NqocAwardApplication.find({ showOnFrontend: true })
            .select('orgName awardCategory description voteCount')
            .sort({ voteCount: -1, createdAt: -1 });
        res.json({ success: true, data: shortlisted });
    } catch (e) {
        console.error('Get Shortlisted Awards Error:', e);
        res.status(500).json({ success: false, error: '获取入围企业失败' });
    }
});

// --- NQOC Whitepaper Request API ---
const NqocWhitepaperRequest = require('./models/NqocWhitepaperRequest');

app.post('/api/nqoc/whitepaper/apply', async (req, res) => {
    try {
        const { name, phone, email, company, position, smsCode } = req.body;
        
        if (!name || !phone || !email || !company || !position || !smsCode) {
            return res.status(400).json({ success: false, error: '请填写所有必填项并输入验证码' });
        }
        
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ success: false, error: '手机号格式不正确' });
        }

        const hit = await VerificationCode.findOne({
            phone,
            code: smsCode,
            used: false,
            createdAt: { $gt: new Date(Date.now() - 3 * 60 * 1000) }
        }).sort({ createdAt: -1 });

        if (!hit) {
            return res.status(400).json({ success: false, error: '验证码错误或已过期' });
        }
        hit.used = true;
        await hit.save();

        const newRequest = new NqocWhitepaperRequest({
            name, phone, email, company, position
        });

        await newRequest.save();
        res.json({ success: true, message: '提交成功' });
    } catch (e) {
        console.error('Whitepaper request error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// Admin API for NQOC Whitepaper Requests
app.get('/api/admin/nqoc/whitepaper', authRequired, requireAnyPerm(['nqoc:list', 'nqoc:manage']), async (req, res) => {
    try {
        const { page = 1, limit = 20, keyword } = req.query;
        let query = {};

        if (keyword && keyword.length <= 200) {
            query.$or = [
                { name: new RegExp(escapeRegex(keyword), 'i') },
                { phone: new RegExp(escapeRegex(keyword), 'i') },
                { company: new RegExp(escapeRegex(keyword), 'i') }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [total, list] = await Promise.all([
            NqocWhitepaperRequest.countDocuments(query),
            NqocWhitepaperRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
        ]);

        res.json({
            success: true,
            data: { list, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (e) {
        console.error('Fetch whitepaper requests error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

app.delete('/api/admin/nqoc/whitepaper/:id', authRequired, requireAnyPerm(['nqoc:delete', 'nqoc:manage']), async (req, res) => {
    try {
        const deleted = await NqocWhitepaperRequest.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: '记录不存在' });
        res.json({ success: true });
    } catch (e) {
        console.error('Delete whitepaper request error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

app.get('/api/admin/nqoc/whitepaper/export', authRequired, requireAnyPerm(['nqoc:export', 'nqoc:manage']), async (req, res) => {
    try {
        const { keyword } = req.query;
        let query = {};
        if (keyword && keyword.length <= 200) {
            query.$or = [
                { name: new RegExp(escapeRegex(keyword), 'i') },
                { phone: new RegExp(escapeRegex(keyword), 'i') },
                { company: new RegExp(escapeRegex(keyword), 'i') }
            ];
        }

        const list = await NqocWhitepaperRequest.find(query).sort({ createdAt: -1 });

        let csvContent = '\uFEFF'; // BOM
        csvContent += '姓名,手机号,邮箱,公司名称,职位,提交时间\n';

        list.forEach(item => {
            const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '';
            csvContent += `"${item.name}","${item.phone}","${item.email}","${item.company}","${item.position}","${dateStr}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="nqoc_whitepaper_requests.csv"');
        res.send(csvContent);
    } catch (e) {
        console.error('Export NQOC Whitepaper Requests Error:', e);
        res.status(500).send('导出失败');
    }
});

// CSV Export for NQOC Awards
// Use JWT authentication via query string since it's accessed via window.open
app.get('/api/admin/nqoc/awards/export', authRequired, requireAnyPerm(['nqoc:export', 'nqoc:manage']), async (req, res) => {
    try {
        const { keyword, channel, startDate, endDate } = req.query;
        let query = {};
        
        if (keyword) {
            query.$or = [
                { orgName: { $regex: escapeRegex(keyword), $options: 'i' } },
                { contactName: { $regex: escapeRegex(keyword), $options: 'i' } },
                { phone: { $regex: escapeRegex(keyword), $options: 'i' } }
            ];
        }
        if (channel) {
            query.channel = channel;
        }
        if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const applications = await NqocAwardApplication.find(query).sort({ createdAt: -1 });

        const getAwardName = (val) => {
            const map = { '1': '年度优秀新质组织', '2': 'AI组织创新奖', '3': '动态人效实践奖', '4': '组织变革先锋奖' };
            return map[val] || val;
        };

        const BOM = '\uFEFF';
        let csv = BOM + '企业名称,联系人,手机号,申报奖项,来源渠道,提交时间,附件地址\n';
        
        applications.forEach(app => {
            const org = `"${(app.orgName || '').replace(/"/g, '""')}"`;
            const name = `"${(app.contactName || '').replace(/"/g, '""')}"`;
            const phone = `"${(app.phone || '').replace(/"/g, '""')}"`;
            const award = `"${getAwardName(app.awardCategory)}"`;
            const ch = `"${(app.channel || 'organic').replace(/"/g, '""')}"`;
            const time = `"${app.createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}"`;
            const fileUrl = `"${app.fileUrl ? (process.env.SITE_URL || 'https://www.ruihuaconsulting.com') + app.fileUrl : ''}"`;
            
            csv += `${org},${name},${phone},${award},${ch},${time},${fileUrl}\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=nqoc-awards-${Date.now()}.csv`);
        res.send(csv);

    } catch (e) {
        console.error('Export NQOC Awards Error:', e);
        res.status(500).send('服务器内部错误');
    }
});

// --- NQOC Survey API ---

// Public: Submit Tracking Log
app.post('/api/tracking', async (req, res) => {
    try {
        const { sessionId, channel, deviceType, eventType, stepIndex, durationMs, errorField } = req.body;
        
        if (!sessionId || !eventType) {
            return res.status(400).json({ success: false, error: 'Missing required tracking fields' });
        }

        const log = new SurveyTrackingLog({
            sessionId,
            channel,
            deviceType,
            eventType,
            stepIndex,
            durationMs,
            errorField
        });

        await log.save();
        res.status(204).send(); // No content needed
    } catch (error) {
        console.error('Tracking Log Error:', error);
        res.status(500).json({ success: false, error: 'Failed to save tracking log' });
    }
});

// Public: Submit Survey
app.post('/api/nqoc/survey/submit', async (req, res) => {
    try {
        const payload = req.body;
        
        if (!payload.orgName || !payload.industry || !payload.respondentTitle || !payload.s7) {
            return res.status(400).json({ success: false, error: '缺少必填字段' });
        }

        const submission = new NqocSurveySubmission(payload);
        await submission.save();

        res.json({ success: true, message: '提交成功' });
    } catch (e) {
        console.error('NQOC Survey Submit Error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// Admin: Channels CRUD
app.get('/api/admin/nqoc/survey/channels', authRequired, requireAnyPerm(['nqoc:list', 'nqoc:manage']), async (req, res) => {
    try {
        const channels = await NqocSurveyChannel.find().sort({ createdAt: -1 }).lean();
        // Calculate submission count for each channel
        for (let ch of channels) {
            ch.submissionCount = await NqocSurveySubmission.countDocuments({ channel: ch.code });
        }
        res.json({ success: true, data: channels });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

app.post('/api/admin/nqoc/survey/channels', authRequired, requireAnyPerm(['nqoc:edit', 'nqoc:manage']), async (req, res) => {
    try {
        const { name, code, description } = req.body;
        if (!name || !code) return res.status(400).json({ success: false, error: '渠道名称和代码为必填' });
        
        const exists = await NqocSurveyChannel.findOne({ code });
        if (exists) return res.status(400).json({ success: false, error: '渠道代码已存在' });

        const channel = new NqocSurveyChannel({ name, code, description });
        await channel.save();
        res.json({ success: true, data: channel });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

app.put('/api/admin/nqoc/survey/channels/:id', authRequired, requireAnyPerm(['nqoc:edit', 'nqoc:manage']), async (req, res) => {
    try {
        const { name, code, description } = req.body;
        const exists = await NqocSurveyChannel.findOne({ code, _id: { $ne: req.params.id } });
        if (exists) return res.status(400).json({ success: false, error: '渠道代码已存在' });

        const channel = await NqocSurveyChannel.findByIdAndUpdate(req.params.id, { name, code, description }, { new: true });
        if (!channel) return res.status(404).json({ success: false, error: '渠道不存在' });
        res.json({ success: true, data: channel });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

app.delete('/api/admin/nqoc/survey/channels/:id', authRequired, requireAnyPerm(['nqoc:delete', 'nqoc:manage']), async (req, res) => {
    try {
        await NqocSurveyChannel.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// Admin: Survey Submissions List
app.get('/api/admin/nqoc/survey/submissions', authRequired, requireAnyPerm(['nqoc:list', 'nqoc:manage']), async (req, res) => {
    try {
        const { page = 1, limit = 20, orgName, name, phone, channel, startDate, endDate } = req.query;
        let query = {};
        
        if (orgName) query.orgName = { $regex: escapeRegex(orgName), $options: 'i' };
        if (name) query.respondentName = { $regex: escapeRegex(name), $options: 'i' };
        if (phone) query.respondentContact = { $regex: escapeRegex(phone), $options: 'i' };
        if (channel) query.channel = channel;
        if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const submissions = await NqocSurveySubmission.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
            
        const total = await NqocSurveySubmission.countDocuments(query);
        
        res.json({
            success: true,
            data: submissions,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (e) {
        console.error('Fetch NQOC Survey Submissions Error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

app.delete('/api/admin/nqoc/survey/submissions/:id', authRequired, requireAnyPerm(['nqoc:delete', 'nqoc:manage']), async (req, res) => {
    try {
        const deleted = await NqocSurveySubmission.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: '记录不存在' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// === Survey Admin Alias Routes (match frontend /api/admin/survey/* expectations) ===

app.get('/api/admin/survey/list', authRequired, requirePerm('appointment:list'), async (req, res) => {
    const { page = 1, limit = 20, orgName, name, phone, channel, startDate, endDate, utm_source, utm_medium, utm_campaign, utm_term, utm_content } = req.query;
    let query = {};
    if (orgName) query.orgName = { $regex: escapeRegex(orgName), $options: 'i' };
    if (name) query.respondentName = { $regex: escapeRegex(name), $options: 'i' };
    if (phone) query.respondentContact = { $regex: escapeRegex(phone), $options: 'i' };
    if (channel) query.channel = channel;
    if (utm_source) query.utm_source = utm_source;
    if (utm_medium) query.utm_medium = utm_medium;
    if (utm_campaign) query.utm_campaign = utm_campaign;
    if (utm_term) query.utm_term = utm_term;
    if (utm_content) query.utm_content = utm_content;
    if (startDate && endDate) query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    try {
        const submissions = await NqocSurveySubmission.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        const total = await NqocSurveySubmission.countDocuments(query);
        res.json({ success: true, data: submissions, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (e) { res.status(500).json({ success: false, error: '服务器内部错误' }); }
});

app.get('/api/admin/survey/analytics', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { channel, startDate, endDate } = req.query;
        let matchQuery = {};
        if (channel) matchQuery.channel = channel;
        if (startDate && endDate) { const endOfDay = new Date(endDate); endOfDay.setHours(23, 59, 59, 999); matchQuery.createdAt = { $gte: new Date(startDate), $lte: endOfDay }; }
        const submissions = await NqocSurveySubmission.find(matchQuery).select('v1_1_1 v1_1_2 v1_2_1 v1_2_2 v1_3_1 v1_3_2 v1_3_3 v1_4_1 v1_4_2 v1_5_1 v1_5_2 b2_1_1 b2_1_2 b2_2_1 b2_2_2 b2_2_3 b2_3_1 b2_3_2 b2_4_1 b2_4_2 b2_5_1 b2_5_2 b2_6_1 b2_6_2 b2_7_1 p3_1_1 p3_1_2 p3_2_1 p3_2_2 p3_3_1 p3_3_2 p3_4_1 p3_4_2 p3_5_1 p3_5_2 p3_6_1 p3_6_2 p3_7_1 m4_1_1 m4_1_2 m4_2_1 m4_2_2 m4_3_1 m4_3_2 m4_4_1 m4_4_2 m4_5_1 m4_5_2 m4_5_3 m4_5_4 m4_6_1 m4_6_2 m4_6_3 m4_7_1 e5_1_1 e5_1_2 e5_2_1 e5_2_2 e5_3_1 e5_3_2 e5_4_1 e5_4_2 e5_5_1 e5_5_2 e5_6_1 s1 orgName industry orgNature employeeCount revenue respondentTitle channel createdAt').lean();
        const total = submissions.length;
        const scoreAvg = (prefix, count) => {
            let sum = 0, n = 0;
            submissions.forEach(s => { for (let i = 1; i <= count; i++) { for (let j = 1; j <= 4; j++) { const key = `${prefix}${i}_${j}`; if (s[key]) { sum += s[key]; n++; } } } });
            return n > 0 ? sum / n : 0;
        };
        const stageCount = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        submissions.forEach(s => { if (s.s1) stageCount[String(s.s1)] = (stageCount[String(s.s1)] || 0) + 1; });
        res.json({ success: true, data: { total, scores: { v1: scoreAvg('v', 5), b2: scoreAvg('b', 7), p3: scoreAvg('p', 7), m4: scoreAvg('m', 7), e5: scoreAvg('e', 6) }, stageCount } });
    } catch (e) { res.status(500).json({ success: false, error: '服务器内部错误' }); }
});

app.get('/api/admin/survey/export', authRequired, requirePerm('appointment:export'), async (req, res) => {
    try {
        const { channel, startDate, endDate } = req.query;
        let query = {};
        if (channel) query.channel = channel;
        if (startDate && endDate) { const endOfDay = new Date(endDate); endOfDay.setHours(23, 59, 59, 999); query.createdAt = { $gte: new Date(startDate), $lte: endOfDay }; }
        const submissions = await NqocSurveySubmission.find(query).sort({ createdAt: -1 }).lean();
        const rows = submissions.map(s => ({ '组织名称': s.orgName, '行业': s.industry, '企业性质': s.orgNature, '员工数': s.employeeCount, '营收': s.revenue, '成立年限': s.establishedYears, '上市情况': s.listingStatus, '职位': s.respondentTitle, '姓名': s.respondentName, '联系电话': s.respondentContact, '邮箱': s.respondentEmail, '渠道': s.channel || '', '提交时间': s.createdAt }));
        const header = Object.keys(rows[0] || {}).join(',');
        const csv = rows.map(r => Object.values(r).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename=survey-export.csv');
        res.send('\uFEFF' + header + '\n' + csv);
    } catch (e) { res.status(500).json({ success: false, error: '服务器内部错误' }); }
});

app.delete('/api/admin/survey/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
    try {
        const deleted = await NqocSurveySubmission.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: '记录不存在' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: '服务器内部错误' }); }
});

app.post('/api/admin/survey/batch-delete', authRequired, requirePerm('appointment:delete'), async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ success: false, error: '请提供要删除的ID' });
        await NqocSurveySubmission.deleteMany({ _id: { $in: ids } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: '服务器内部错误' }); }
});

// Admin: Survey Stats
app.get('/api/admin/nqoc/survey/stats', authRequired, requireAnyPerm(['nqoc:list', 'nqoc:manage']), async (req, res) => {
    try {
        const { channel, startDate, endDate } = req.query;
        let matchQuery = {};
        if (channel) matchQuery.channel = channel;
        if (startDate && endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            matchQuery.createdAt = { $gte: new Date(startDate), $lte: endOfDay };
        } else if (startDate) {
            matchQuery.createdAt = { $gte: new Date(startDate) };
        } else if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            matchQuery.createdAt = { $lte: endOfDay };
        }

        const total = await NqocSurveySubmission.countDocuments(matchQuery);
        const submissions = await NqocSurveySubmission.find(matchQuery);
        
        // Calculate average scores for radar chart
        let scores = { v1: 0, b2: 0, p3: 0, m4: 0, e5: 0 };
        let stageCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let painPointsCount = {};

        if (total > 0) {
            submissions.forEach(sub => {
                // Sum averages
                const v1_avg = (sub.v1_1_1 + sub.v1_1_2 + sub.v1_2_1 + sub.v1_2_2 + sub.v1_3_1 + sub.v1_3_2 + sub.v1_3_3 + sub.v1_4_1 + sub.v1_4_2 + sub.v1_5_1 + sub.v1_5_2) / 11;
                const b2_avg = (sub.b2_1_1 + sub.b2_1_2 + sub.b2_2_1 + sub.b2_2_2 + sub.b2_3_1 + sub.b2_3_2 + sub.b2_4_1 + sub.b2_4_2 + sub.b2_5_1 + sub.b2_5_2) / 10;
                const p3_avg = (sub.p3_1_1 + sub.p3_1_2 + sub.p3_2_1 + sub.p3_2_2 + sub.p3_3_1 + sub.p3_3_2 + sub.p3_4_1 + sub.p3_4_2 + sub.p3_5_1 + sub.p3_5_2 + sub.p3_6_1 + sub.p3_6_2) / 12;
                const m4_avg = (sub.m4_1_1 + sub.m4_1_2 + sub.m4_2_1 + sub.m4_2_2 + sub.m4_3_1 + sub.m4_3_2 + sub.m4_4_1 + sub.m4_4_2 + sub.m4_5_1 + sub.m4_5_2 + sub.m4_6_1 + sub.m4_6_2) / 12;
                const e5_avg = (sub.e5_1_1 + sub.e5_1_2 + sub.e5_2_1 + sub.e5_2_2 + sub.e5_3_1 + sub.e5_3_2 + sub.e5_4_1 + sub.e5_4_2 + sub.e5_5_1 + sub.e5_5_2) / 10;
                
                scores.v1 += v1_avg;
                scores.b2 += b2_avg;
                scores.p3 += p3_avg;
                scores.m4 += m4_avg;
                scores.e5 += e5_avg;

                // Stage distribution
                if (sub.s1) {
                    stageCount[sub.s1] = (stageCount[sub.s1] || 0) + 1;
                }

                // Pain points distribution
                if (sub.s2 && Array.isArray(sub.s2)) {
                    sub.s2.forEach(point => {
                        painPointsCount[point] = (painPointsCount[point] || 0) + 1;
                    });
                }
            });

            scores.v1 /= total;
            scores.b2 /= total;
            scores.p3 /= total;
            scores.m4 /= total;
            scores.e5 /= total;
        }

        res.json({
            success: true,
            data: {
                total,
                scores,
                stageCount,
                painPointsCount
            }
        });
    } catch (error) {
        console.error('Survey stats error:', error);
        res.status(500).json({ success: false, message: '获取数据失败' });
    }
});

// Admin: Tracking Stats for Funnel
app.get('/api/admin/nqoc/survey/tracking-stats', authRequired, requireAnyPerm(['nqoc:list', 'nqoc:manage']), async (req, res) => {
    try {
        const { channel, startDate, endDate } = req.query;
        let matchQuery = {};
        if (channel) {
            matchQuery.channel = channel;
        }
        if (startDate && endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            matchQuery.createdAt = { $gte: new Date(startDate), $lte: endOfDay };
        } else if (startDate) {
            matchQuery.createdAt = { $gte: new Date(startDate) };
        } else if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            matchQuery.createdAt = { $lte: endOfDay };
        }

        // Aggregate unique users entering each step
        const funnelStats = await SurveyTrackingLog.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: "$stepIndex",
                    uniqueUsers: { $addToSet: "$sessionId" },
                    avgDuration: { $avg: "$durationMs" }
                }
            },
            {
                $project: {
                    stepIndex: "$_id",
                    userCount: { $size: "$uniqueUsers" },
                    avgDuration: { $round: ["$avgDuration", 0] },
                    _id: 0
                }
            },
            { $sort: { stepIndex: 1 } }
        ]);

        // Aggregate event counts (e.g. page_view vs submit_success)
        const eventStats = await SurveyTrackingLog.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: "$eventType",
                    uniqueUsers: { $addToSet: "$sessionId" }
                }
            },
            {
                $project: {
                    eventType: "$_id",
                    userCount: { $size: "$uniqueUsers" },
                    _id: 0
                }
            }
        ]);

        // Aggregate field interactions
        const fieldStats = await SurveyTrackingLog.aggregate([
            { $match: { ...matchQuery, eventType: 'field_interact' } },
            {
                $group: {
                    _id: { step: "$stepIndex", field: "$errorField" },
                    uniqueUsers: { $addToSet: "$sessionId" }
                }
            },
            {
                $project: {
                    stepIndex: "$_id.step",
                    fieldName: "$_id.field",
                    userCount: { $size: "$uniqueUsers" },
                    _id: 0
                }
            },
            { $sort: { userCount: -1 } }
        ]);

        res.json({
            success: true,
            data: {
                funnel: funnelStats,
                events: eventStats,
                fieldStats: fieldStats
            }
        });
    } catch (error) {
        console.error('Tracking stats error:', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// Admin: Export Survey Submissions
app.get('/api/admin/nqoc/survey/submissions/export', authRequired, requireAnyPerm(['nqoc:export', 'nqoc:manage']), async (req, res) => {
    try {
        const { orgName, name, phone, channel, startDate, endDate } = req.query;
        let query = {};
        if (orgName) query.orgName = { $regex: escapeRegex(orgName), $options: 'i' };
        if (name) query.respondentName = { $regex: escapeRegex(name), $options: 'i' };
        if (phone) query.respondentContact = { $regex: escapeRegex(phone), $options: 'i' };
        if (channel) query.channel = channel;
        if (startDate && endDate) query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };

        const NqocSurveySubmission = require('./models/NqocSurveySubmission');
        const submissions = await NqocSurveySubmission.find(query).sort({ createdAt: -1 });
        const BOM = '\uFEFF';
        
        const mappings = require('./admin/js/survey_mappings.json');
        const getLabel = (key, defaultLabel = key) => mappings[key] || defaultLabel;
        const getOptionLabel = (key, val) => {
            if (!val) return '';
            if (Array.isArray(val)) return val.map(v => getOptionLabel(key, v)).join(' | ');
            if (mappings[key + '_' + val]) return mappings[key + '_' + val];
            return val;
        };
        
        const headers = [
            '提交时间', '来源渠道', 
            getLabel('E1'), getLabel('E2'), getLabel('E2') + '(其他)', getLabel('E3'), getLabel('E3') + '(其他)', getLabel('E4'), getLabel('E5'), getLabel('E6'), getLabel('E7'), getLabel('E8'),
            getLabel('R1'), getLabel('R1') + '(其他)', getLabel('R2'), getLabel('R3'), getLabel('R4'), getLabel('R5'),
            getLabel('V1.1.1'), getLabel('V1.1.2'), getLabel('V1.2.1'), getLabel('V1.2.2'), getLabel('V1.3.1'), getLabel('V1.3.2'), getLabel('V1.3.3'), getLabel('V1.4.1'), getLabel('V1.4.2'), getLabel('V1.5.1'), getLabel('V1.5.2'),
            getLabel('B2.1.1'), getLabel('B2.1.2'), getLabel('B2.2.1'), getLabel('B2.2.2'), getLabel('B2.2.3'), getLabel('B2.3.1'), getLabel('B2.3.2'), getLabel('B2.4.1'), getLabel('B2.4.2'), getLabel('B2.5.1'), getLabel('B2.5.2'), getLabel('B2.6.1'), getLabel('B2.6.2'), getLabel('B2.7.1'), getLabel('B-O1'), getLabel('B-O1') + '(其他)',
            getLabel('P3.1.1'), getLabel('P3.1.2'), getLabel('P3.2.1'), getLabel('P3.2.2'), getLabel('P3.3.1'), getLabel('P3.3.2'), getLabel('P3.4.1'), getLabel('P3.4.2'), getLabel('P3.5.1'), getLabel('P3.5.2'), getLabel('P3.6.1'), getLabel('P3.6.2'), getLabel('P3.7.1'), getLabel('P-O1'), getLabel('P-O1') + '(其他)',
            getLabel('M4.1.1'), getLabel('M4.1.2'), getLabel('M4.2.1'), getLabel('M4.2.2'), getLabel('M4.3.1'), getLabel('M4.3.2'), getLabel('M4.4.1'), getLabel('M4.4.2'), getLabel('M4.5.1'), getLabel('M4.5.2'), getLabel('M4.5.3'), getLabel('M4.5.4'), getLabel('M4.6.1'), getLabel('M4.6.2'), getLabel('M4.6.3'), getLabel('M4.7.1'), getLabel('M-O1'), getLabel('M-O1') + '(其他)',
            getLabel('E5.1.1'), getLabel('E5.1.2'), getLabel('E5.2.1'), getLabel('E5.2.2'), getLabel('E5.3.1'), getLabel('E5.3.2'), getLabel('E5.4.1'), getLabel('E5.4.2'), getLabel('E5.5.1'), getLabel('E5.5.2'), getLabel('E5.6.1'), getLabel('E-O1'), getLabel('E-O1') + '(其他)',
            getLabel('O1.1'), getLabel('O1.2'), getLabel('O2.1'), getLabel('O2.2'), getLabel('O2.3'), getLabel('O3.1'), getLabel('O3.2'), getLabel('O3.3'), getLabel('O4.1'), getLabel('O4.2'), getLabel('O4.3'), getLabel('O5.1'), getLabel('O5.2'),
            getLabel('S1'), getLabel('S2'), getLabel('S3'), getLabel('S4'), getLabel('S4') + '(其他)', getLabel('S5'), getLabel('S5') + '(其他)', getLabel('S6'), getLabel('S6') + '(其他)', getLabel('S7')
        ];

        let csv = BOM + headers.join(',') + '\n';
        
        const escapeCsv = (val) => {
            if (val === null || val === undefined) return '""';
            if (Array.isArray(val)) val = val.join(' | ');
            return `"${String(val).replace(/"/g, '""')}"`;
        };

        submissions.forEach(sub => {
            const row = [
                sub.createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
                sub.channel || 'organic',
                sub.orgName, getOptionLabel('industry', sub.industry), sub.industry && sub.industry.includes('其他') ? sub.industry_other : '', getOptionLabel('orgNature', sub.orgNature), sub.orgNature && sub.orgNature.includes('其他') ? sub.orgNature_other : '', getOptionLabel('employeeCount', sub.employeeCount), getOptionLabel('revenue', sub.revenue), 
                getOptionLabel('establishedYears', sub.establishedYears), getOptionLabel('listingStatus', sub.listingStatus), getOptionLabel('aiDeptStatus', sub.aiDeptStatus),
                getOptionLabel('respondentTitle', sub.respondentTitle), sub.respondentTitle && sub.respondentTitle.includes('其他') ? sub.respondentTitle_other : '', getOptionLabel('respondentTenure', sub.respondentTenure), sub.respondentName, sub.respondentContact, sub.respondentEmail,
                
                getOptionLabel('v1_1_1', sub.v1_1_1), getOptionLabel('v1_1_2', sub.v1_1_2), getOptionLabel('v1_2_1', sub.v1_2_1), getOptionLabel('v1_2_2', sub.v1_2_2), getOptionLabel('v1_3_1', sub.v1_3_1), getOptionLabel('v1_3_2', sub.v1_3_2), getOptionLabel('v1_3_3', sub.v1_3_3), getOptionLabel('v1_4_1', sub.v1_4_1), getOptionLabel('v1_4_2', sub.v1_4_2), getOptionLabel('v1_5_1', sub.v1_5_1), getOptionLabel('v1_5_2', sub.v1_5_2),
                getOptionLabel('b2_1_1', sub.b2_1_1), getOptionLabel('b2_1_2', sub.b2_1_2), getOptionLabel('b2_2_1', sub.b2_2_1), getOptionLabel('b2_2_2', sub.b2_2_2), getOptionLabel('b2_2_3', sub.b2_2_3), getOptionLabel('b2_3_1', sub.b2_3_1), getOptionLabel('b2_3_2', sub.b2_3_2), getOptionLabel('b2_4_1', sub.b2_4_1), getOptionLabel('b2_4_2', sub.b2_4_2), getOptionLabel('b2_5_1', sub.b2_5_1), getOptionLabel('b2_5_2', sub.b2_5_2), getOptionLabel('b2_6_1', sub.b2_6_1), getOptionLabel('b2_6_2', sub.b2_6_2), getOptionLabel('b2_7_1', sub.b2_7_1), getOptionLabel('b_o1', sub.b_o1), sub.b_o1_other,
                getOptionLabel('p3_1_1', sub.p3_1_1), getOptionLabel('p3_1_2', sub.p3_1_2), getOptionLabel('p3_2_1', sub.p3_2_1), getOptionLabel('p3_2_2', sub.p3_2_2), getOptionLabel('p3_3_1', sub.p3_3_1), getOptionLabel('p3_3_2', sub.p3_3_2), getOptionLabel('p3_4_1', sub.p3_4_1), getOptionLabel('p3_4_2', sub.p3_4_2), getOptionLabel('p3_5_1', sub.p3_5_1), getOptionLabel('p3_5_2', sub.p3_5_2), getOptionLabel('p3_6_1', sub.p3_6_1), getOptionLabel('p3_6_2', sub.p3_6_2), getOptionLabel('p3_7_1', sub.p3_7_1), getOptionLabel('p_o1', sub.p_o1), sub.p_o1_other,
                getOptionLabel('m4_1_1', sub.m4_1_1), getOptionLabel('m4_1_2', sub.m4_1_2), getOptionLabel('m4_2_1', sub.m4_2_1), getOptionLabel('m4_2_2', sub.m4_2_2), getOptionLabel('m4_3_1', sub.m4_3_1), getOptionLabel('m4_3_2', sub.m4_3_2), getOptionLabel('m4_4_1', sub.m4_4_1), getOptionLabel('m4_4_2', sub.m4_4_2), getOptionLabel('m4_5_1', sub.m4_5_1), getOptionLabel('m4_5_2', sub.m4_5_2), getOptionLabel('m4_5_3', sub.m4_5_3), getOptionLabel('m4_5_4', sub.m4_5_4), getOptionLabel('m4_6_1', sub.m4_6_1), getOptionLabel('m4_6_2', sub.m4_6_2), getOptionLabel('m4_6_3', sub.m4_6_3), getOptionLabel('m4_7_1', sub.m4_7_1), getOptionLabel('m_o1', sub.m_o1), sub.m_o1_other,
                getOptionLabel('e5_1_1', sub.e5_1_1), getOptionLabel('e5_1_2', sub.e5_1_2), getOptionLabel('e5_2_1', sub.e5_2_1), getOptionLabel('e5_2_2', sub.e5_2_2), getOptionLabel('e5_3_1', sub.e5_3_1), getOptionLabel('e5_3_2', sub.e5_3_2), getOptionLabel('e5_4_1', sub.e5_4_1), getOptionLabel('e5_4_2', sub.e5_4_2), getOptionLabel('e5_5_1', sub.e5_5_1), getOptionLabel('e5_5_2', sub.e5_5_2), getOptionLabel('e5_6_1', sub.e5_6_1), getOptionLabel('e_o1', sub.e_o1), sub.e_o1_other,
                getOptionLabel('o1_1', sub.o1_1), getOptionLabel('o1_2', sub.o1_2), getOptionLabel('o2_1', sub.o2_1), getOptionLabel('o2_2', sub.o2_2), getOptionLabel('o2_3', sub.o2_3), getOptionLabel('o3_1', sub.o3_1), getOptionLabel('o3_2', sub.o3_2), getOptionLabel('o3_3', sub.o3_3), getOptionLabel('o4_1', sub.o4_1), getOptionLabel('o4_2', sub.o4_2), getOptionLabel('o4_3', sub.o4_3), getOptionLabel('o5_1', sub.o5_1), getOptionLabel('o5_2', sub.o5_2),
                getOptionLabel('s1', sub.s1), getOptionLabel('s2', sub.s2), getOptionLabel('s3', sub.s3), getOptionLabel('s4', sub.s4), sub.s4_other, getOptionLabel('s5', sub.s5), sub.s5_other, getOptionLabel('s6', sub.s6), sub.s6_other, getOptionLabel('s7', sub.s7)
            ].map(escapeCsv);
            
            csv += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=nqoc-survey-detailed-${Date.now()}.csv`);
        res.send(csv);
    } catch (e) {
        console.error('Export NQOC Survey Error:', e);
        res.status(500).send('服务器内部错误');
    }
});

// --- NQOC Debate Voting API ---

// Helper to get or create debate config
async function getDebateConfig() {
    let config = await NqocDebateConfig.findOne();
    if (!config) {
        config = await NqocDebateConfig.create({});
    }
    return config;
}

// Public: Get debate config and current votes
app.get('/api/nqoc/debate/votes', async (req, res) => {
    try {
        const config = await getDebateConfig();
        res.json({
            success: true,
            data: {
                1: { pro: config.topic1_proVotes, con: config.topic1_conVotes, status: config.topic1_status || (config.topic1_isOpen ? 'in_progress' : 'ended') },
                2: { pro: config.topic2_proVotes, con: config.topic2_conVotes, status: config.topic2_status || (config.topic2_isOpen ? 'in_progress' : 'ended') },
                maxVotes: config.maxVotesPerDevice
            }
        });
    } catch (e) {
        console.error('Fetch Debate Config Error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// Public: Submit a vote
app.post('/api/nqoc/debate/vote', express.json(), async (req, res) => {
    try {
        const { topicId, side } = req.body;
        const config = await getDebateConfig();
        
        if (topicId == 1) {
            const status = config.topic1_status || (config.topic1_isOpen ? 'in_progress' : 'ended');
            if (status === 'not_started') return res.status(400).json({ success: false, error: '该话题投票尚未开始' });
            if (status === 'ended') return res.status(400).json({ success: false, error: '该话题投票已结束' });
            if (side === 'pro') config.topic1_proVotes++;
            else if (side === 'con') config.topic1_conVotes++;
        } else if (topicId == 2) {
            const status = config.topic2_status || (config.topic2_isOpen ? 'in_progress' : 'ended');
            if (status === 'not_started') return res.status(400).json({ success: false, error: '该话题投票尚未开始' });
            if (status === 'ended') return res.status(400).json({ success: false, error: '该话题投票已结束' });
            if (side === 'pro') config.topic2_proVotes++;
            else if (side === 'con') config.topic2_conVotes++;
        } else {
            return res.status(400).json({ success: false, error: '无效的话题' });
        }
        
        await config.save();
        res.json({ success: true, data: { topicId, side } });
    } catch (e) {
        console.error('Submit Vote Error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// Admin: Get debate config
app.get('/api/admin/nqoc/debate/config', authRequired, requireAnyPerm(['nqoc:list', 'nqoc:manage']), async (req, res) => {
    try {
        const config = await getDebateConfig();
        res.json({ success: true, data: config });
    } catch (e) {
        console.error('Fetch Debate Config Error (Admin):', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// Admin: Update debate config
app.post('/api/admin/nqoc/debate/config', authRequired, requireAnyPerm(['nqoc:edit', 'nqoc:manage']), express.json(), async (req, res) => {
    try {
        const config = await getDebateConfig();
        Object.assign(config, req.body);
        await config.save();
        res.json({ success: true, data: config });
    } catch (e) {
        console.error('Update Debate Config Error:', e);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});


// ==========================================
// NQOC Expert Application APIs
// ==========================================

// Public API to submit expert application (supports multipart for photo upload)
app.post('/api/nqoc/experts/apply', nqocUpload.single('photo'), async (req, res) => {
    try {
        const fields = req.body || {};
        // Parse arrays sent as JSON string or comma-separated
        let activities = [];
        if (fields.activities) {
            try { activities = typeof fields.activities === 'string' ? JSON.parse(fields.activities) : fields.activities; }
            catch { activities = fields.activities.split(',').map(s => s.trim()).filter(Boolean); }
        }

        const {
            name,
            location, position, company, email,
            bio, researchFields, publications, topicNeeds, referrer,
            privacyConsent
        } = fields;

        // 必填校验：所有字段均为必填
        const requiredFields = [
            ['name', '姓名'],
            ['location', '常驻地'],
            ['position', '职位名称'],
            ['company', '工作单位'],
            ['email', '电子邮箱'],
            ['bio', '个人官方简介'],
            ['researchFields', '研究领域'],
            ['topicNeeds', '课题需求'],
            ['referrer', '来源/联系人']
        ];
        for (const [key, label] of requiredFields) {
            if (!fields[key] || !String(fields[key]).trim()) {
                return res.status(400).json({ success: false, message: `"${label}"为必填项` });
            }
        }
        if (!Array.isArray(activities) || activities.length === 0) {
            return res.status(400).json({ success: false, message: '"活动选择"为必填项' });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: '请填写有效的邮箱地址' });
        }
        if (String(bio).length > 2000) {
            return res.status(400).json({ success: false, message: '个人简介不能超过200字' });
        }
        if (topicNeeds && String(topicNeeds).length > 5000) {
            return res.status(400).json({ success: false, message: '课题需求过长' });
        }
        if (privacyConsent !== 'true' && privacyConsent !== true) {
            return res.status(400).json({ success: false, message: '请同意隐私授权' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: '"个人官方照片"为必填项' });
        }

        // 处理照片上传 - 上传至火山引擎TOS: nqoc/zhuanjia/
        let photoUrl = '';
        if (req.file) {
            if (useTosUpload) {
                try {
                    const filePath = path.join(__dirname, 'public', 'uploads', 'nqoc', req.file.filename);
                    const objectKey = 'nqoc/zhuanjia/' + req.file.filename;
                    const tosUrl = await uploadLocalFileToTos(filePath, objectKey, req.file.mimetype || 'image/jpeg');
                    if (tosUrl) {
                        photoUrl = tosUrl;
                        // 上传成功后删除本地文件
                        try { fs.unlinkSync(filePath); } catch {}
                    } else {
                        photoUrl = '/uploads/nqoc/' + req.file.filename;
                    }
                } catch (tosErr) {
                    console.error('专家照片上传TOS失败，退回本地存储:', tosErr.message);
                    photoUrl = '/uploads/nqoc/' + req.file.filename;
                }
            } else {
                photoUrl = '/uploads/nqoc/' + req.file.filename;
            }
        }

        const newApplication = new NqocExpertApplication({
            name,
            activities: Array.isArray(activities) ? activities : [],
            location: location || '',
            position: position || '',
            company: company || '',
            email: email || '',
            bio: bio || '',
            researchFields: researchFields || '',
            publications: publications || '',
            topicNeeds: topicNeeds || '',
            referrer: referrer || '',
            photoUrl,
            privacyConsent: privacyConsent === 'true' || privacyConsent === true,
            otherDeclaration: fields.otherDeclaration || '',
            status: 'pending'
        });
        
        await newApplication.save();
        res.json({ success: true, message: '申请提交成功' });
    } catch (error) {
        console.error('Submit expert application error:', error);
        res.status(500).json({ success: false, message: '服务器错误，请稍后重试' });
    }
});

// Admin API to get applications list
app.get('/api/admin/nqoc/experts', authRequired, requireAnyPerm(['nqoc:list', 'nqoc:manage']), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        let query = {};
        if (req.query.search) {
            const kw = { $regex: escapeRegex(req.query.search), $options: 'i' };
            query = {
                $or: [
                    { name: kw }, { email: kw },
                    { company: kw }, { position: kw }, { location: kw },
                    { researchFields: kw }
                ]
            };
        }

        if (req.query.status) {
            query.status = req.query.status;
        }

        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) {
                let endDate = new Date(req.query.endDate);
                endDate.setDate(endDate.getDate() + 1);
                query.createdAt.$lt = endDate;
            }
        }

        const applications = await NqocExpertApplication.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await NqocExpertApplication.countDocuments(query);
        
        res.json({
            success: true,
            data: applications,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get expert applications error:', error);
        res.status(500).json({ success: false, message: '获取数据失败' });
    }
});

// Admin API to update application status
app.put('/api/admin/nqoc/experts/:id/status', authRequired, requireAnyPerm(['nqoc:edit', 'nqoc:manage']), express.json(), async (req, res) => {
    try {
        const { status } = req.body;
        const application = await NqocExpertApplication.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        
        if (!application) {
            return res.status(404).json({ success: false, message: '记录不存在' });
        }
        
        res.json({ success: true, data: application });
    } catch (error) {
        console.error('Update expert application status error:', error);
        res.status(500).json({ success: false, message: '更新状态失败' });
    }
});

// Admin API to delete application
app.delete('/api/admin/nqoc/experts/:id', authRequired, requireAnyPerm(['nqoc:delete', 'nqoc:manage']), async (req, res) => {
    try {
        const deleted = await NqocExpertApplication.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: '记录不存在' });
        }
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        console.error('Delete expert application error:', error);
        res.status(500).json({ success: false, message: '删除失败' });
    }
});

// Admin API: batch delete expert applications
app.post('/api/admin/nqoc/experts/batch-delete', authRequired, requireAnyPerm(['nqoc:delete', 'nqoc:manage']), express.json(), async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: '请提供要删除的记录ID' });
        }
        const result = await NqocExpertApplication.deleteMany({ _id: { $in: ids } });
        res.json({ success: true, deletedCount: result.deletedCount, message: `成功删除 ${result.deletedCount} 条记录` });
    } catch (error) {
        console.error('Batch delete expert applications error:', error);
        res.status(500).json({ success: false, message: '批量删除失败' });
    }
});

// Admin API to export expert applications
app.get('/api/admin/nqoc/experts/export', authRequired, requireAnyPerm(['nqoc:export', 'nqoc:manage']), async (req, res) => {
    try {

        let query = {};
        if (req.query.search) {
            const kw = { $regex: escapeRegex(req.query.search), $options: 'i' };
            query.$or = [
                { name: kw }, { email: kw },
                { company: kw }, { position: kw }, { location: kw }
            ];
        }
        if (req.query.status) query.status = req.query.status;
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) {
                let ed = new Date(req.query.endDate); ed.setDate(ed.getDate() + 1);
                query.createdAt.$lt = ed;
            }
        }

        const applications = await NqocExpertApplication.find(query).sort({ createdAt: -1 });

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('智库专家申请');

        const ACT_LABELS = {
            speaker: '研讨会/私董会/论坛分享嘉宾',
            video_interview: '《值得看见》栏目录制',
            case_review: '优秀案例评审',
            standard_making: '新质组织模型标准制定',
            host_visits: '接待企业参观学习研讨',
            writing: '接受约稿撰写',
            general_events: '参加其他相关专业活动'
        };

        worksheet.columns = [
            { header: '姓名', key: 'name', width: 12 },
            { header: '意向活动', key: 'activities', width: 40 },
            { header: '常驻地', key: 'location', width: 12 },
            { header: '职位名称', key: 'position', width: 18 },
            { header: '工作单位', key: 'company', width: 22 },
            { header: '电子邮箱', key: 'email', width: 22 },
            { header: '个人官方简介', key: 'bio', width: 40 },
            { header: '研究领域', key: 'researchFields', width: 25 },
            { header: '个人专业著作', key: 'publications', width: 30 },
            { header: '课题需求', key: 'topicNeeds', width: 30 },
            { header: '来源/联系人', key: 'referrer', width: 15 },
            { header: '照片URL', key: 'photoUrl', width: 40 },
            { header: '隐私说明', key: 'privacy', width: 10 },
            { header: '状态', key: 'status', width: 10 },
            { header: '提交时间', key: 'createdAt', width: 20 }
        ];

        const statusMap = { pending: '待处理', contacted: '已联系', rejected: '已拒绝', approved: '已通过' };

        applications.forEach(app => {
            const acts = Array.isArray(app.activities) ? app.activities.map(k => ACT_LABELS[k] || k).join('；') : '';
            worksheet.addRow({
                createdAt: new Date(app.createdAt).toLocaleString('zh-CN'),
                name: app.name,
                email: app.email || '',
                location: app.location || '',
                position: app.position || '',
                company: app.company || '',
                researchFields: app.researchFields || '',
                activities: acts,
                bio: app.bio || '',
                publications: app.publications || '',
                topicNeeds: app.topicNeeds || '',
                referrer: app.referrer || '',
                photoUrl: app.photoUrl || '',
                privacy: app.privacyConsent ? '是' : '否',
                status: statusMap[app.status] || app.status
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=nqoc-expert-applications.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export expert applications error:', error);
        res.status(500).send('导出失败');
    }
});


// --- Deepseek API ---
// Fix for UNABLE_TO_GET_ISSUER_CERT_LOCALLY in dev environment
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function generateDeepseekSlug(title) {
    const API_KEY = process.env.DEEPSEEK_API_KEY;
    const API_URL = 'https://api.deepseek.com/chat/completions';
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system', 
                        content: 'You are an SEO expert. Generate a short, English, URL-friendly slug (lowercase, hyphens only, no special chars) for the article title provided. Return ONLY the slug.'
                    },
                    {
                        role: 'user', 
                        content: `Title: ${title}`
                    }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Deepseek API Error: ${response.status} ${errText}`);
        }

        const data = await response.json();
        let slug = data.choices[0].message.content.trim();
        
        // Clean up response if it contains extra text (just in case)
        slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
        return slug;
    } catch (e) {
        console.error('Deepseek API Failed:', e);
        return null; // Fallback to local
    }
}

async function generateDeepseekText(systemPrompt, userPrompt) {
    const API_KEY = process.env.DEEPSEEK_API_KEY;
    const API_URL = 'https://api.deepseek.com/chat/completions';
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
                { role: 'user', content: userPrompt || '' }
            ],
            stream: false
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Deepseek API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
}

// --- Tools API ---
app.post('/api/tools/slug', authRequired, requirePerm('ai:use'), async (req, res) => {
    try {
        const { text, forceAi } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });
        
        let finalSlug = '';

        // Try AI first if requested or default
        // The user asked to "Integrate deepseek API... Implement intelligent slug generation based on article title"
        // I'll try AI first, then fallback.
        
        const aiSlug = await generateDeepseekSlug(text);
        
        if (aiSlug) {
            finalSlug = aiSlug;
        } else {
            // Fallback to transliteration
            const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'with', 'by'];
            let slug = slugify(text, { 
                lowercase: true, 
                separator: '-'
            });
            slug = slug.split('-').filter(word => !stopWords.includes(word)).join('-');
            finalSlug = slug;
        }
        
        // Ensure max length 60 chars
        if (finalSlug.length > 60) {
             finalSlug = finalSlug.substring(0, 60);
             const lastHyphen = finalSlug.lastIndexOf('-');
             if (lastHyphen > 0) finalSlug = finalSlug.substring(0, lastHyphen);
        }
        
        // Remove trailing hyphens
        finalSlug = finalSlug.replace(/-+$/, '');

        // Uniqueness Check (Loop until unique)
        let uniqueSlug = finalSlug;
        let counter = 1;
        while (await Article.findOne({ slug: uniqueSlug })) {
            uniqueSlug = `${finalSlug}-${counter}`;
            counter++;
        }
        
        await logOp('tool', 'Slug', `Generated slug: ${uniqueSlug} (AI: ${!!aiSlug})`);
        
        res.json({ slug: uniqueSlug });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/tools/tags', authRequired, requirePerm('ai:use'), async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title && !content) return res.status(400).json({ error: 'Title or content required' });
        
        const systemPrompt = "You are an expert tag generator. Generate exactly 3 highly relevant tags based on the provided title and content. Each tag MUST be exactly 4 Chinese characters long. Return ONLY a comma-separated list of tags, no other text.";
        const userPrompt = `Title: ${title}\nContent: ${(content || '').substring(0, 1000)}`;
        
        const aiResponse = await generateDeepseekText(systemPrompt, userPrompt);
        const tags = aiResponse.split(',').map(t => t.trim()).filter(t => t);
        
        res.json({ tags });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/tools/summary', authRequired, requirePerm('ai:use'), async (req, res) => {
    try {
        const { title, content, type } = req.body;
        if (!content) return res.status(400).json({ error: 'Content required' });
        
        let systemPrompt = "";
        if (type === 'seo') {
            systemPrompt = "You are an SEO expert. Generate a concise meta description (max 150 characters) for the following article.";
        } else if (type === 'geo') {
            systemPrompt = "You are an AI content optimizer. Generate a highly structured 'Generative Engine Optimization' summary (200-300 characters) that perfectly answers the core questions of this article, suitable for AI bots to scrape and understand.";
        } else {
            systemPrompt = "Summarize the following text in one short paragraph.";
        }
        
        const userPrompt = `Title: ${title || ''}\nContent: ${content.substring(0, 3000)}`;
        const summary = await generateDeepseekText(systemPrompt, userPrompt);
        
        res.json({ summary });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/tools/qa', authRequired, requirePerm('ai:use'), async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!content) return res.status(400).json({ error: 'Content required' });
        
        const systemPrompt = `You are a helpful assistant. Based on the provided content, generate exactly 3 Q&A pairs (Frequently Asked Questions) in Chinese.
Return the result strictly as a JSON array of objects:
[
  { "question": "中文问题1？", "answer": "中文答案1。" },
  { "question": "中文问题2？", "answer": "中文答案2。" },
  { "question": "中文问题3？", "answer": "中文答案3。" }
]
Do not output any markdown formatting or other text.`;
        const userPrompt = `Title: ${title || ''}\nContent: ${content.substring(0, 3000)}`;
        
        let jsonText = await generateDeepseekText(systemPrompt, userPrompt);
        const match = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) jsonText = match[0];
        else jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const qaList = JSON.parse(jsonText);
        // Important: Frontend expects { qa: [...] }
        res.json({ qa: qaList });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.post('/api/tools/geo-analysis', authRequired, requirePerm('ai:use'), async (req, res) => {
    try {
        const { title, content, metaTitle, metaDescription } = req.body;
        if (!title) return res.status(400).json({ error: 'Title required' });
        
        const systemPrompt = `You are an advanced SEO and GEO (Generative Engine Optimization) analyzer.
Evaluate the provided article data and return a JSON object with the following structure:
{
  "success": true,
  "data": [
    {
      "location": "标题",
      "priority": 5,
      "suggestion": "Suggestion 1",
      "expectedImpact": "提升点击率"
    },
    {
      "location": "内容",
      "priority": 4,
      "suggestion": "Suggestion 2",
      "expectedImpact": "增加收录概率"
    }
  ]
}
Return ONLY valid JSON.`;
        const userPrompt = `Title: ${title}\nMeta Title: ${metaTitle || ''}\nMeta Desc: ${metaDescription || ''}\nContent: ${(content || '').substring(0, 2000)}`;
        
        let jsonText = await generateDeepseekText(systemPrompt, userPrompt);
        const match = jsonText.match(/\{\s*"success"[\s\S]*\}/);
        if (match) jsonText = match[0];
        else jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const result = JSON.parse(jsonText);
        // Ensure structure matches frontend expectation
        if (!result.success && result.data === undefined && Array.isArray(result.suggestions)) {
            // map from old prompt style to new frontend expected style
            const mappedData = result.suggestions.map(s => ({
                location: "全局",
                priority: 3,
                suggestion: typeof s === 'string' ? s : JSON.stringify(s),
                expectedImpact: "优化 AI 抓取效率"
            }));
            return res.json({ success: true, data: mappedData });
        }
        
        // If it still doesn't have data array, wrap it
        if (!result.data || !Array.isArray(result.data)) {
            return res.json({ success: true, data: [] });
        }
        
        res.json(result);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// --- Upload API ---
// Update storage to handle author paths if needed, or just use a smart filename
// For simplicity and robustness, we'll stick to a flat structure or date-based, 
// but user asked for /uploads/authors/{user_id}/. 
// Let's create a specific upload endpoint for authors.

const authorStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const fs = require('fs');
        const userId = req.params.userId || 'default';
        const dir = path.join(__dirname, `public/uploads/authors/${userId}`);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const uploadAuthor = multer({ 
    storage: authorStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, WebP allowed.'));
        }
    }
});

function parseAuthorUploadError(err) {
    if (!err) return null;
    if (err.code === 'LIMIT_FILE_SIZE') {
        return { status: 400, error: '作者头像大小超限：请控制在 2MB 以内' };
    }
    if (err.message) return { status: 400, error: err.message };
    return { status: 500, error: '作者头像上传失败，请稍后重试' };
}

app.post('/api/upload/author/:userId', authRequired, requirePerm('article:edit'), uploadLimiter, (req, res) => {
    uploadAuthor.single('file')(req, res, async (uploadErr) => {
        if (uploadErr) {
            const parsed = parseAuthorUploadError(uploadErr);
            console.error('Author upload middleware error:', uploadErr);
            await logOp('upload_failed', 'AuthorAvatar', `Author upload middleware failed: ${parsed.error}`, req.user?.username);
            return res.status(parsed.status).json({ success: false, error: parsed.error });
        }
        try {
            if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
            const userId = req.params.userId || 'default';
            if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
                return res.status(400).json({ success: false, error: 'Invalid user id' });
            }
            const dir = path.join(__dirname, `public/uploads/authors/${userId}`);
            ensureDirSync(dir);
            const originalBase = path.basename(req.file.originalname).replace(/\.[^.]+$/, '');
            const digitsRaw = toDigitsFromSha256(originalBase + String(Date.now()));
            const digits30 = clipDigits(digitsRaw, 30);
            const uniqueDigits = ensureUniqueDigits(dir, digits30);
            const avatarAbs = path.join(dir, uniqueDigits + '2.webp');
            await sharp(req.file.path).resize(256, 256, { fit: 'cover' }).webp({ quality: 85 }).toFile(avatarAbs);
            try { fs.unlinkSync(req.file.path); } catch {}
            const publicRoot = path.join(__dirname, 'public');
            const url = avatarAbs.replace(publicRoot, '').replace(/\\/g, '/');
            let finalUrl = url;
            if (useTosUpload) {
                try {
                    const objectKey = url.replace(/^\/+/, '');
                    finalUrl = await uploadLocalFileToTos(avatarAbs, objectKey, 'image/webp') || url;
                    try { fs.unlinkSync(avatarAbs); } catch {}
                } catch (tosErr) {
                    console.error('TOS author avatar upload failed, fallback to local:', tosErr);
                    await logOp('upload_warn', 'AuthorAvatar', `TOS failed, fallback local: ${tosErr.message}`, req.user?.username);
                    notifyTosFallbackAlert(`Author avatar fallback: ${tosErr.message}`);
                    finalUrl = url;
                }
            }
            await logOp('upload', 'AuthorAvatar', `Uploaded avatar for user: ${userId}`, req.user?.username);
            const hashHex = crypto.createHash('sha256').update(originalBase).digest('hex');
            try {
                await FileNameMap.create({ originalName: originalBase, numericName: uniqueDigits + '2', directory: url.replace(/\/[^\/]+$/, ''), ext: 'webp', variant: 'avatar', hashHex });
            } catch (mapErr) {
                console.error('FileNameMap avatar create failed:', mapErr.message);
            }
            return res.json({ success: true, url: finalUrl });
        } catch (e) {
            console.error('Author upload error:', e);
            await logOp('upload_failed', 'AuthorAvatar', `Author upload processing failed: ${e.message}`, req.user?.username);
            return res.status(500).json({ success: false, error: '服务器内部错误' });
        }
    });
});

app.post('/api/upload', authRequired, requirePerm('upload:write'), uploadLimiter, (req, res) => {
    upload.single('file')(req, res, async (uploadErr) => {
        if (uploadErr) {
            const parsed = parseUploadError(uploadErr);
            console.error('Upload middleware error:', uploadErr);
            await logOp('upload_failed', 'Image', `Upload middleware failed: ${parsed.error}`, req.user?.username);
            return res.status(parsed.status).json({ success: false, error: parsed.error });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: '未检测到上传文件' });
            }
            const uploadedAbs = path.join(__dirname, 'public/uploads', req.file.filename);
            
            // Magic number validation for non-image files
            if (!(req.file.mimetype && req.file.mimetype.startsWith('image/'))) {
                const header = Buffer.alloc(8);
                try {
                    const fd = fs.openSync(uploadedAbs, 'r');
                    fs.readSync(fd, header, 0, 8, 0);
                    fs.closeSync(fd);
                } catch { /* file just written; fall through */ }
                const hex = header.toString('hex').toUpperCase();
                // PDF: %PDF  |  DOCX/XLSX/PPTX: PK (ZIP)  |  plain text: no binary marker
                const allowedDocs = ['PDF', 'ZIP', 'TEXT'];
                let magicType = null;
                if (hex.startsWith('25504446')) magicType = 'PDF';
                else if (hex.startsWith('504B0304') || hex.startsWith('504B0506') || hex.startsWith('504B0708')) magicType = 'ZIP';
                else if (!hex.match(/^(00|FF|[89A-F][0A-F])/)) magicType = 'TEXT'; // likely text file (not binary)
                
                if (!magicType) {
                    try { fs.unlinkSync(uploadedAbs); } catch {}
                    return res.status(400).json({ success: false, error: '不支持的文件格式，仅允许 PDF、Office 文档和图片' });
                }
            }
            
            // If image, do local processing: convert to webp + thumbnail, store in date-based directory
            if (req.file.mimetype && req.file.mimetype.startsWith('image/')) {
                const now = new Date();
                const year = String(now.getFullYear());
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const baseDir = path.join(__dirname, 'public/uploads/images', year, month);
                ensureDirSync(baseDir);
                const originalBase = path.basename(req.file.originalname).replace(/\.[^.]+$/, '');
                const digitsRaw = toDigitsFromSha256(originalBase + String(Date.now()));
                const digits30 = clipDigits(digitsRaw, 30);
                const uniqueDigits = ensureUniqueDigits(baseDir, digits30);
                const webpAbs = path.join(baseDir, uniqueDigits + '0.webp');
                const thumbAbs = path.join(baseDir, uniqueDigits + '1.webp');
                try {
                    await sharp(uploadedAbs).resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 82 }).toFile(webpAbs);
                    await sharp(uploadedAbs).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(thumbAbs);
                    try { fs.unlinkSync(uploadedAbs); } catch {}
                    const publicRoot = path.join(__dirname, 'public');
                    const url = webpAbs.replace(publicRoot, '').replace(/\\/g, '/');
                    const thumb = thumbAbs.replace(publicRoot, '').replace(/\\/g, '/');
                    let finalUrl = url;
                    let finalThumb = thumb;
                    if (useTosUpload) {
                        try {
                            const objectKey = url.replace(/^\/+/, '');
                            const thumbKey = thumb.replace(/^\/+/, '');
                            finalUrl = await uploadLocalFileToTos(webpAbs, objectKey, 'image/webp') || url;
                            finalThumb = await uploadLocalFileToTos(thumbAbs, thumbKey, 'image/webp') || thumb;
                            try { fs.unlinkSync(webpAbs); } catch {}
                            try { fs.unlinkSync(thumbAbs); } catch {}
                        } catch (tosErr) {
                            console.error('TOS upload failed, fallback to local image path:', tosErr);
                            await logOp('upload_warn', 'Image', `TOS failed, fallback local: ${tosErr.message}`, req.user?.username);
                            notifyTosFallbackAlert(`Image upload fallback: ${tosErr.message}`);
                            finalUrl = url;
                            finalThumb = thumb;
                        }
                    }
                    await logOp('upload', 'Image', `Image processed: ${url}`, req.user?.username);
                    const hashHex = crypto.createHash('sha256').update(originalBase).digest('hex');
                    try {
                        await FileNameMap.create({ originalName: originalBase, numericName: uniqueDigits + '0', directory: url.replace(/\/[^\/]+$/, ''), ext: 'webp', variant: 'main', hashHex });
                        await FileNameMap.create({ originalName: originalBase, numericName: uniqueDigits + '1', directory: thumb.replace(/\/[^\/]+$/, ''), ext: 'webp', variant: 'thumb', hashHex });
                    } catch (mapErr) {
                        console.error('FileNameMap image create failed:', mapErr.message);
                    }
                    return res.json({ success: true, url: finalUrl || url, thumb: finalThumb || thumb });
                } catch (sharpErr) {
                    console.error('Sharp process error, fallback to original:', sharpErr);
                    await logOp('upload_warn', 'Image', `Sharp failed, fallback original: ${req.file.filename}`, req.user?.username);
                    const localUrl = '/uploads/' + req.file.filename;
                    if (useTosUpload) {
                        try {
                            const uploadedKey = localUrl.replace(/^\/+/, '');
                            const tosUrl = await uploadLocalFileToTos(uploadedAbs, uploadedKey, req.file.mimetype || 'application/octet-stream');
                            try { fs.unlinkSync(uploadedAbs); } catch {}
                            return res.json({ success: true, url: tosUrl || localUrl });
                        } catch (tosErr) {
                            console.error('TOS upload failed in sharp fallback, use local path:', tosErr);
                            notifyTosFallbackAlert(`Sharp fallback upload: ${tosErr.message}`);
                            return res.json({ success: true, url: localUrl });
                        }
                    }
                    return res.json({ success: true, url: localUrl });
                }
            }
            // Non-image: keep original disk path
            await logOp('upload', 'File', `File uploaded: ${req.file.filename}`, req.user?.username);
            const localUrl = '/uploads/' + req.file.filename;
            if (useTosUpload) {
                try {
                    const fileKey = localUrl.replace(/^\/+/, '');
                    const tosUrl = await uploadLocalFileToTos(uploadedAbs, fileKey, req.file.mimetype || 'application/octet-stream');
                    try { fs.unlinkSync(uploadedAbs); } catch {}
                    return res.json({ success: true, url: tosUrl || localUrl });
                } catch (tosErr) {
                    console.error('TOS upload failed for non-image, use local path:', tosErr);
                    notifyTosFallbackAlert(`File upload fallback: ${tosErr.message}`);
                    return res.json({ success: true, url: localUrl });
                }
            }
            return res.json({ success: true, url: localUrl });
        } catch (e) {
            console.error('Upload processing error:', e);
            await logOp('upload_failed', 'Image', `Upload processing failed: ${e.message}`, req.user?.username);
            return res.status(500).json({ success: false, error: '上传处理失败，请稍后重试' });
        }
    });
});

app.post('/api/upload/fetch-url', authRequired, requirePerm('upload:write'), async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'No URL provided' });
        }

        // SSRF protection: validate URL
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch { return res.status(400).json({ error: 'Invalid URL' }); }
        
        if (parsedUrl.protocol !== 'https:') {
            return res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
        }

        // Block internal / private IP resolution (hostname-level)
        const { hostname } = parsedUrl;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' ||
            hostname.match(/^10\./) || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) || hostname.match(/^192\.168\./) ||
            hostname.match(/^169\.254\./) || hostname === '0.0.0.0' || hostname === '[::]' ||
            hostname.endsWith('.local') || hostname.endsWith('.internal')) {
            return res.status(400).json({ error: 'Internal URLs are not allowed' });
        }

        // DNS-level SSRF check: resolve A + AAAA records, validate not private
        try {
            const [ipv4, ipv6] = await Promise.all([
                new Promise((ok, fail) => dns.resolve4(hostname, (e, a) => (e ? fail(e) : ok(a)))).catch(() => []),
                new Promise((ok, fail) => dns.resolve6(hostname, (e, a) => (e ? fail(e) : ok(a)))).catch(() => [])
            ]);
            const allAddrs = [...ipv4, ...ipv6];
            if (allAddrs.length === 0) {
                return res.status(400).json({ error: 'DNS resolution produced no addresses' });
            }
            const privateRE = /^(10\.|127\.|0\.)|(^172\.(1[6-9]|2[0-9]|3[0-1])\.)|(^192\.168\.)|(^169\.254\.)|(^fc00:|^fd00:|^fe80:)|(^::1$)|(^::$)/;
            for (const addr of allAddrs) {
                if (privateRE.test(addr)) {
                    return res.status(400).json({ error: 'URL resolves to a private IP address' });
                }
            }
        } catch (_) {
            return res.status(400).json({ error: 'DNS resolution failed for the given URL' });
        }

        const fetch = (await import('node-fetch')).default;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
        clearTimeout(timeout);
        if (!response.ok) {
            return res.status(400).json({ error: 'Failed to fetch image from URL' });
        }

        // Limit response size: max 10MB
        const contentLength = parseInt(response.headers.get('content-length'), 10);
        if (contentLength && contentLength > 10 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image file exceeds maximum size of 10MB' });
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            return res.status(400).json({ error: 'URL does not point to a valid image' });
        }

        let ext = '';
        if (contentType === 'image/jpeg') ext = '.jpg';
        else if (contentType === 'image/png') ext = '.png';
        else if (contentType === 'image/gif') ext = '.gif';
        else if (contentType === 'image/webp') ext = '.webp';
        else ext = '.jpg';

        const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
        const dir = path.join(__dirname, 'public', 'uploads');
        ensureDirSync(dir);
        
        const filepath = path.join(dir, filename);
        
        // Stream with 10MB hard cap (accounts for missing Content-Length)
        const MAX_BYTES = 10 * 1024 * 1024;
        let received = 0;
        const hwm = 64 * 1024;
        const dest = fs.createWriteStream(filepath, { highWaterMark: hwm });
        response.body.on('data', (chunk) => {
            received += chunk.length;
            if (received > MAX_BYTES) {
                response.body.destroy();
                dest.destroy();
                try { fs.unlinkSync(filepath); } catch {}
            }
        });
        response.body.pipe(dest);

        await new Promise((resolve, reject) => {
            dest.on('finish', resolve);
            dest.on('error', reject);
        });

        if (received > MAX_BYTES) {
            return res.status(400).json({ error: 'Image file exceeds maximum size of 10MB' });
        }

        const localUrl = `/uploads/${filename}`;
        
        // If TOS is enabled, we could also upload it to TOS, but for now we just return the local URL 
        // to keep it simple and fulfill the requirement.
        res.json({ success: true, url: localUrl });
    } catch (e) {
        console.error('Fetch URL error:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- SMS Verification Code API ---
// 生成6位随机验证码
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送短信验证码
const smsLimiter = rateLimit({ 
    windowMs: 60 * 1000, 
    max: 20, // Allow 20 per minute per IP
    standardHeaders: true, 
    legacyHeaders: false,
    message: { error: '验证码请求过于频繁，请稍后再试' }
});

const https = require('https');
const http = require('http');

async function sendSmsWithRetry(url, payload, retries = 1, timeout = 5000) {
    let lastError;
    // Force IPv4 to prevent Node.js DNS resolution delays (common 30s timeout issue)
    const httpAgent = new http.Agent({ family: 4 });
    const httpsAgent = new https.Agent({ family: 4 });

    for (let i = 0; i <= retries; i++) {
        try {
            const startTime = Date.now();
            const response = await axios.post(url, payload, {
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                timeout: timeout,
                httpAgent,
                httpsAgent
            });
            const duration = Date.now() - startTime;
            console.log(`[SMS DEBUG] Attempt ${i + 1}: SMS API responded in ${duration}ms`);
            return response;
        } catch (error) {
            lastError = error;
            console.error(`[SMS ERROR] Attempt ${i + 1} failed: ${error.message}`);
            if (i < retries) {
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
            }
        }
    }
    throw lastError;
}

app.post('/api/send-verification-code', smsLimiter, async (req, res) => {
    try {
        const { phone, scene } = req.body;
        
        // 验证手机号格式
        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ error: '请输入有效的11位手机号码' });
        }
        
        // 防刷策略：单号码每日上限 (例如 10次/天)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const dailyCount = await VerificationCode.countDocuments({
            phone: phone,
            createdAt: { $gte: startOfDay }
        });
        
        if (dailyCount >= 10) {
            return res.status(429).json({ error: '该手机号今日验证码发送次数已达上限' });
        }

        // 检查是否在1分钟内已发送过验证码 (防并发/连点机制)
        const existingCode = await VerificationCode.findOne({
            phone: phone,
            createdAt: { $gt: new Date(Date.now() - 60 * 1000) }
        });
        
        if (existingCode) {
            const remainingTime = Math.ceil((existingCode.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000);
            return res.status(429).json({ 
                error: '验证码发送过于频繁，请稍后再试',
                remainingTime: remainingTime
            });
        }
        
        // 生成验证码
        const code = generateVerificationCode();
        
        // Check mock mode
        const isMockMode = process.env.SMS_MOCK_MODE === 'true';
        if (isMockMode) {
            console.log(`[SMS MOCK] Phone: ${phone}, Code: ${code}`);
            const verificationCode = new VerificationCode({
                phone: phone,
                code: code
            });
            await verificationCode.save();
            return res.json({
                success: true,
                message: '验证码已发送（模拟模式）',
                expiresIn: 180
            });
        }
        
        // 准备短信内容
        let smsContent = `【瑞华智策】验证码为：${code} 你正在预约新质组织白皮书，需要进行验证码校验（3分钟内有效），请勿向任何人提供此验证码。`;
        if (scene === 'activity') {
            smsContent = `【瑞华智策】验证码为：${code}，用于活动信息校验（3分钟内有效），请勿向任何人提供此验证码。`;
        } else if (scene === 'survey') {
            smsContent = `【瑞华智策】验证码为：${code} 你正在参与新质组织调研，需要进行验证码校验（3分钟内有效），请勿向任何人提供此验证码。`;
        } else if (scene === 'training') {
            smsContent = `【瑞华智策】验证码为：${code} 你正在提交课程咨询，需要进行验证码校验（3分钟内有效），请勿向任何人提供此验证码。`;
        } else if (scene === 'expert') {
            smsContent = `【瑞华智策】验证码为：${code} 你正在申请加入新质组织智库，需要进行验证码校验（3分钟内有效），请勿向任何人提供此验证码。`;
        }
        
        // 异步保存验证码到数据库以减少阻塞时间
        const dbSavePromise = new VerificationCode({
            phone: phone,
            code: code
        }).save();
        
        // 发送短信，带有重试和超时监控
        try {
            const maskedUser = (process.env.SMS_USERNAME || '').replace(/.(?=.{2})/g, '*');
            console.log(`[SMS DEBUG] Preparing to send SMS to ${phone}, User: ${maskedUser}`);
            
            const smsPayload = {
                loginname: process.env.SMS_USERNAME,
                password: process.env.SMS_PASSWORD,
                phone: phone,
                content: smsContent
            };
            
            // 限制最大重试 1 次，首次超时 5 秒，确保总体在 10s 内返回响应
            const smsResponse = await sendSmsWithRetry(process.env.SMS_API_URL, smsPayload, 1, 5000);
            
            console.log('[SMS DEBUG] SMS API Response Status:', smsResponse.status);
            console.log('[SMS DEBUG] SMS API Response Data:', JSON.stringify(smsResponse.data));
            
            if (smsResponse.data.retcode !== '0') {
                console.error('[SMS ERROR] SMS send failed. Retcode:', smsResponse.data.retcode);
                return res.status(500).json({ error: '短信发送失败：' + (smsResponse.data.pno || '未知错误') });
            }
            
            console.log('[SMS DEBUG] SMS sent successfully.');

            await dbSavePromise; // 确保数据库保存成功
            console.log('[SMS DEBUG] Verification code saved to DB.');
            
            res.json({ 
                success: true, 
                message: '验证码已发送',
                expiresIn: 180 // 3分钟
            });
            
        } catch (smsError) {
            console.error('[SMS ERROR] Exception occurred:', smsError.message);
            if (smsError.response) {
                console.error('[SMS ERROR] Response Data:', smsError.response.data);
            }
            return res.status(500).json({ error: '短信通道拥堵或超时，请稍后重试' });
        }
        
    } catch (error) {
        console.error('Send verification code error:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 验证验证码
async function verifyCode(phone, code) {
    try {
        const verificationCode = await VerificationCode.findOne({
            phone: phone,
            code: code,
            used: false,
            createdAt: { $gt: new Date(Date.now() - 3 * 60 * 1000) }
        });
        
        if (!verificationCode) {
            return { valid: false, message: '验证码无效或已过期' };
        }
        
        // 标记验证码为已使用
        verificationCode.used = true;
        await verificationCode.save();
        
        return { valid: true };
    } catch (error) {
        console.error('Verify code error:', error);
        return { valid: false, message: '验证失败' };
    }
}

// 钉钉通知函数
async function sendDingTalkNotification(appointment) {
    try {
        const finalUrl = buildSignedDingTalkWebhookUrl();
        if (!finalUrl) {
            console.log('DingTalk webhook URL not configured');
            return;
        }
        
        // 构建消息内容
        const message = {
            msgtype: 'markdown',
            markdown: {
                title: '新预约提醒',
                text: `## 🎯 新预约提醒\n\n` +
                      `**姓名：** ${appointment.name}\n\n` +
                      `**手机：** ${appointment.phone}\n\n` +
                      `**公司：** ${appointment.company || '未填写'}\n\n` +
                      `**职位：** ${appointment.title || '未填写'}\n\n` +
                      `**问题描述：** ${appointment.problem || '无'}\n\n` +
                      `**来源：** ${appointment.source || '未知'}\n\n` +
                      `**提交时间：** ${new Date(appointment.createdAt).toLocaleString('zh-CN')}\n\n` +
                      `> 请及时跟进处理！`
            }
        };
        
        // 发送钉钉消息
        const response = await axios.post(finalUrl, message, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        if (response.data.errcode === 0) {
            console.log('DingTalk notification sent successfully');
        } else {
            console.error('DingTalk notification failed:', response.data);
        }
        
    } catch (error) {
        console.error('DingTalk notification error:', error.message);
        throw error;
    }
}

// --- Appointments API ---
// Test DingTalk notification (temporary)
app.post('/api/test-dingtalk', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const testAppointment = {
            name: '测试用户',
            phone: '13800138000',
            company: '测试公司',
            title: 'CEO',
            problem: '测试钉钉通知功能',
            source: 'test',
            createdAt: new Date()
        };
        
        await sendDingTalkNotification(testAppointment);
        res.json({ success: true, message: '钉钉通知测试成功' });
    } catch (error) {
        console.error('Test DingTalk error:', error);
        res.status(500).json({ error: '钉钉通知测试失败' });
    }
});

// Public submission (no auth)
app.post('/api/appointments', async (req, res) => {
    try {
        let { name, phone, company, title, problem, source, verificationCode, ...utmParams } = req.body;
        
        // Channel Tracking: Read from cookies if not provided in body
        if (req.cookies) {
             if (!utmParams.utm_source && req.cookies.utm_source) utmParams.utm_source = req.cookies.utm_source;
             if (!utmParams.utm_medium && req.cookies.utm_medium) utmParams.utm_medium = req.cookies.utm_medium;
             if (!utmParams.utm_campaign && req.cookies.utm_campaign) utmParams.utm_campaign = req.cookies.utm_campaign;
             if (!utmParams.utm_term && req.cookies.utm_term) utmParams.utm_term = req.cookies.utm_term;
             if (!utmParams.utm_content && req.cookies.utm_content) utmParams.utm_content = req.cookies.utm_content;
        }

        // Basic validation
        if (!name || !phone) {
            return res.status(400).json({ error: '姓名和电话为必填项' });
        }

        // Phone validation
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            return res.status(400).json({ error: '请输入有效的11位手机号码' });
        }
        
        // 验证码验证
        if (!verificationCode) {
            return res.status(400).json({ error: '请输入验证码' });
        }
        
        const codeVerification = await verifyCode(phone, verificationCode);
        if (!codeVerification.valid) {
            return res.status(400).json({ error: codeVerification.message });
        }

        const newAppt = new Appointment({
            name,
            phone,
            company,
            title,
            problem,
            source,
            ...utmParams, // Store UTM params
            status: 'new',
            createdAt: new Date()
        });

        await newAppt.save();
        
        // 发送钉钉通知
        try {
            await sendDingTalkNotification(newAppt);
        } catch (dingTalkError) {
            console.error('DingTalk notification failed:', dingTalkError);
            // 钉钉通知失败不影响预约提交成功
        }
        
        // Log it (system)
        // await logOp('create', 'Appointment', `New appointment from ${name}`);
        
        res.json({ success: true, message: '提交成功' });
    } catch (e) {
        console.error('Appointment Error:', e);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

app.get('/api/appointments', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const sortOrder = parseInt(req.query.sort) || -1;
        
        const query = {};
        if (status) {
            query.status = status;
        }
        
        const skip = (page - 1) * limit;
        const total = await Appointment.countDocuments(query);
        const appointments = await Appointment.find(query)
            .sort({ createdAt: sortOrder })
            .skip(skip)
            .limit(limit);
            
        res.json({
            data: appointments,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.put('/api/appointments/:id', authRequired, requirePerm('appointment:edit'), async (req, res) => {
    try {
        const { status, remarks } = req.body;
        const appt = await Appointment.findByIdAndUpdate(
            req.params.id, 
            { status, remarks }, // Assuming we might want remarks later, or just status
            { new: true }
        );
        await logOp('update', 'Appointment', `Updated status to ${status} for: ${appt.name}`, req.user.username);
        res.json({ success: true, data: appt });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.delete('/api/appointments/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
    try {
        await Appointment.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Appointment', `Deleted appointment: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// Export appointments (CSV)
app.get('/api/appointments/export', authRequired, requirePerm('appointment:export'), async (req, res) => {
    try {
        const status = req.query.status;
        const sortOrder = parseInt(req.query.sort) || -1;
        
        const query = {};
        if (status) {
            query.status = status;
        }
        
        const appointments = await Appointment.find(query).sort({ createdAt: sortOrder });
        
        // Convert to CSV
        const fields = ['name', 'phone', 'company', 'title', 'problem', 'source', 'createdAt'];
        const header = ['姓名', '电话', '公司', '职位', '问题', '来源', '提交时间', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content'];
        
        let csv = header.join(',') + '\n';
        appointments.forEach(appt => {
            const row = [
                `"${appt.name || ''}"`,
                `"${appt.phone || ''}"`,
                `"${appt.company || ''}"`,
                `"${appt.title || ''}"`,
                `"${appt.problem || ''}"`,
                `"${appt.source || ''}"`,
                `"${appt.createdAt ? new Date(appt.createdAt).toLocaleString() : ''}"`,
                `"${appt.utm_source || ''}"`,
                `"${appt.utm_medium || ''}"`,
                `"${appt.utm_campaign || ''}"`,
                `"${appt.utm_term || ''}"`,
                `"${appt.utm_content || ''}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        // Add BOM for Excel Chinese support and send
        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('appointments.csv');
        const bom = Buffer.from('\xEF\xBB\xBF', 'binary');
        res.send(Buffer.concat([bom, Buffer.from(csv, 'utf-8')]));
        
    } catch (e) {
        return res.status(500).send('Internal Server Error');
    }
});

// --- Maturity Diagnostic API ---
app.post('/api/maturity/submit', async (req, res) => {
    try {
        const { userInfo, quizResult, userSelections } = req.body;
        
        if (!userInfo || !userInfo.name || !userInfo.phone) {
            return res.status(400).json({ error: 'Missing user info' });
        }

        const submission = new MaturitySubmission({
            name: userInfo.name,
            phone: userInfo.phone,
            company: userInfo.company,
            score: quizResult.score,
            level: quizResult.level,
            answers: userSelections,
            resultDetail: {
                summary: quizResult.summary,
                insight: quizResult.insight,
                currentStatus: quizResult.currentStatus,
                potential: quizResult.potential,
                action: quizResult.action
            }
        });

        await submission.save();
        await logOp('create', 'Maturity', `New submission from ${userInfo.name}`);
        res.json({ success: true });
    } catch (e) {
        console.error('Maturity Submit Error:', e);
        return sendInternalError(res, null, e);
    }
});

app.get('/api/maturity/list', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const total = await MaturitySubmission.countDocuments();
        const list = await MaturitySubmission.find()
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
            
        res.json({
            data: list,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// Get Quiz Config
app.get('/api/config/quiz', (req, res) => {
    res.json(quizData);
});

// Get Efficiency Quiz Config
app.get('/api/config/efficiency-quiz', (req, res) => {
    res.json(efficiencyQuizData);
});

// Export Maturity Data
app.get('/api/maturity/export', authRequired, requirePerm('appointment:export'), async (req, res) => {
    try {
        const { format = 'xlsx' } = req.query; // 'xlsx' or 'csv'
        
        // Fetch latest 1000 records
        const submissions = await MaturitySubmission.find()
            .sort({ createdAt: -1 })
            .limit(1000);

        // Prepare data for export
        const exportData = submissions.map(sub => {
            const row = {
                '提交时间': new Date(sub.createdAt).toLocaleString('zh-CN'),
                '姓名': sub.name,
                '手机': sub.phone,
                '公司': sub.company,
                '得分': sub.score,
                '等级': sub.level
            };

            // Add formatted answers
            Object.keys(quizData).forEach(qKey => {
                const q = quizData[qKey];
                const ansKeys = sub.answers[qKey] || [];
                const ansText = Array.isArray(ansKeys) 
                    ? ansKeys.map(k => `${k}. ${q.options[k] || ''}`).join('; ')
                    : `${ansKeys}. ${q.options[ansKeys] || ''}`; // Handle legacy single value if any (though schema is array mostly, wait, schema is Object, frontend sends array for q8, others?)
                    // Frontend sends array for all? Let's check frontend.
                    // diagnostic.html: userSelections[q] = [optKey] (single) or array (multi). Always array.
                
                // Format: "Q1. Question Text" -> "Answer"
                // But keys in Excel usually are just "Q1", "Q2" or full question. 
                // Full question is better for readability but might be long.
                // Let's use "Q{n}: {Title}" as header.
                const header = `${qKey.toUpperCase().replace('Q', 'Q')}. ${q.text}`;
                row[header] = ansText;
            });

            return row;
        });

        // Create Workbook
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "成熟度诊断数据");

        // Generate Buffer
        const type = format === 'csv' ? 'csv' : 'xlsx';
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: type });

        // Set Headers
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = encodeURIComponent(`成熟度诊断报告_批量_${dateStr}.${type}`);
        
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`);
        res.setHeader('Content-Type', type === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        res.send(buffer);

    } catch (e) {
        console.error('Export Error:', e);
        return sendInternalError(res, null, e);
    }
});

app.delete('/api/maturity/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
    try {
        await MaturitySubmission.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Maturity', `Deleted submission: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// --- Whitepaper Submission API ---
app.post('/api/whitepaper/submit', async (req, res) => {
    console.log('Received whitepaper submission:', req.body);
    try {
        const { name, phone, company, position, email, whitepaperName, source, ...utmParams } = req.body;

        if (!name || !phone || !company || !email || !whitepaperName) {
            console.log('Missing fields:', { name, phone, company, email, whitepaperName });
            return res.status(400).json({ error: '请填写所有必填项' });
        }

        // Validations
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            console.log('Invalid phone:', phone);
            return res.status(400).json({ error: '请输入有效的11位手机号码' });
        }
        if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            console.log('Invalid email:', email);
            return res.status(400).json({ error: '请输入有效的邮箱地址' });
        }

        // Check for duplicate submission (same phone & whitepaper within 24h)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existing = await WhitepaperSubmission.findOne({
            phone,
            whitepaperName,
            submittedAt: { $gte: yesterday }
        });

        if (existing) {
            console.log('Duplicate submission:', { phone, whitepaperName });
            return res.status(400).json({ error: '您已提交过申请，请勿重复提交' });
        }

        // Process UTM from cookies if not in body
        if (req.cookies) {
             if (!utmParams.utm_source && req.cookies.utm_source) utmParams.utm_source = req.cookies.utm_source;
             if (!utmParams.utm_medium && req.cookies.utm_medium) utmParams.utm_medium = req.cookies.utm_medium;
             if (!utmParams.utm_campaign && req.cookies.utm_campaign) utmParams.utm_campaign = req.cookies.utm_campaign;
             if (!utmParams.utm_term && req.cookies.utm_term) utmParams.utm_term = req.cookies.utm_term;
             if (!utmParams.utm_content && req.cookies.utm_content) utmParams.utm_content = req.cookies.utm_content;
        }

        const newSubmission = new WhitepaperSubmission({
            name, phone, company, position, email, whitepaperName, source,
            ...utmParams
        });

        const saved = await newSubmission.save();
        console.log('Submission saved successfully:', saved._id);

        res.json({ success: true });
    } catch (e) {
        console.error('Whitepaper Submit Error:', e);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

app.get('/api/whitepaper/list', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { page = 1, limit = 20, name, phone, whitepaperName, utm_source } = req.query;
        let query = {};

        if (name && name.length <= 100) query.name = new RegExp(escapeRegex(name), 'i');
        if (phone && phone.length <= 20) query.phone = new RegExp(escapeRegex(phone), 'i');
        if (whitepaperName && whitepaperName.length <= 100) query.whitepaperName = new RegExp(escapeRegex(whitepaperName), 'i');
        if (utm_source && utm_source.length <= 50) query.utm_source = new RegExp(escapeRegex(utm_source), 'i');

        const skip = (page - 1) * limit;
        const total = await WhitepaperSubmission.countDocuments(query);
        const list = await WhitepaperSubmission.find(query)
            .sort({ submittedAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        res.json({
            data: list,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

app.get('/api/whitepaper/export', authRequired, requirePerm('appointment:export'), async (req, res) => {
    try {
        const { name, phone, whitepaperName, utm_source } = req.query;
        let query = {};

        if (name && name.length <= 100) query.name = new RegExp(escapeRegex(name), 'i');
        if (phone && phone.length <= 20) query.phone = new RegExp(escapeRegex(phone), 'i');
        if (whitepaperName && whitepaperName.length <= 100) query.whitepaperName = new RegExp(escapeRegex(whitepaperName), 'i');
        if (utm_source && utm_source.length <= 50) query.utm_source = new RegExp(escapeRegex(utm_source), 'i');

        const submissions = await WhitepaperSubmission.find(query).sort({ submittedAt: -1 });
        
        // Convert to CSV
        const header = ['姓名', '电话', '公司', '职位', '邮箱', '白皮书名称', '来源', '提交时间', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content'];
        
        let csv = header.join(',') + '\n';
        submissions.forEach(sub => {
            const row = [
                `"${sub.name || ''}"`,
                `"${sub.phone || ''}"`,
                `"${sub.company || ''}"`,
                `"${sub.position || ''}"`,
                `"${sub.email || ''}"`,
                `"${sub.whitepaperName || ''}"`,
                `"${sub.source || ''}"`,
                `"${sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : ''}"`,
                `"${sub.utm_source || ''}"`,
                `"${sub.utm_medium || ''}"`,
                `"${sub.utm_campaign || ''}"`,
                `"${sub.utm_term || ''}"`,
                `"${sub.utm_content || ''}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('whitepaper_downloads.csv');
        const bom = Buffer.from('\xEF\xBB\xBF', 'binary');
        res.send(Buffer.concat([bom, Buffer.from(csv, 'utf-8')]));
    } catch (e) {
        return res.status(500).send('Internal Server Error');
    }
});

// --- Subscription API ---
app.post('/api/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: '邮箱地址不能为空' });
        
        // Basic email validation
        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
        if (!emailRegex.test(email)) {
             return res.status(400).json({ error: '请输入有效的邮箱地址' });
        }

        // Check existing
        const existing = await Subscription.findOne({ email });
        if (existing) {
            if (existing.status === 'unsubscribed') {
                existing.status = 'active';
                await existing.save();
                return res.json({ success: true, message: '重新订阅成功' });
            }
            return res.status(400).json({ error: '该邮箱已订阅' });
        }

        const newSub = new Subscription({ email });
        await newSub.save();
        
        await logOp('create', 'Subscription', `New subscription: ${email}`);
        
        res.json({ success: true, message: '订阅成功' });
    } catch (e) {
        console.error('Subscription Error:', e);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// === Efficiency Diagnosis Routes ===

// Submit Efficiency Diagnosis
app.post('/api/efficiency-diagnosis', async (req, res) => {
    console.log('Received efficiency diagnosis submission:', JSON.stringify(req.body, null, 2));
    try {
        const data = req.body;
        const answers = data.answers || {};
        const detailedAnswers = [];

        // Populate detailed answers using efficiencyQuizData
        const scoreMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
        
        for (const [key, value] of Object.entries(answers)) {
            const questionData = efficiencyQuizData[key];
            if (questionData) {
                detailedAnswers.push({
                    questionId: key,
                    questionText: questionData.question,
                    selectedOption: value,
                    optionText: questionData.options[value] || '',
                    score: scoreMap[value] || 0
                });
            }
        }

        const submission = new EfficiencySubmission({
            ...data,
            detailedAnswers
        });
        
        const saved = await submission.save();
        console.log('Efficiency diagnosis saved successfully:', saved._id);
        res.status(201).json({ success: true, message: '提交成功' });
    } catch (error) {
        console.error('Error saving efficiency diagnosis:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// Export Efficiency Diagnosis Data
app.get('/api/efficiency-diagnosis/export', authRequired, requirePerm('appointment:export'), async (req, res) => {
    try {
        const { format = 'xlsx' } = req.query;
        const submissions = await EfficiencySubmission.find().sort({ createdAt: -1 }).limit(1000);
        
        const data = submissions.map(sub => {
            const row = {
                '提交时间': new Date(sub.createdAt).toLocaleString(),
                '公司名称': sub.company,
                '行业': sub.industry,
                '员工人数': sub.employeeCount,
                '姓名': sub.name,
                '电话': sub.phone,
                '职位': sub.position,
                '邮箱': sub.email,
                '营业收入': sub.revenue,
                '毛利润': sub.grossProfit,
                '净利润': sub.netProfit,
                '人力总成本': sub.hrCost,
                '企业总成本': sub.totalCost,
            };

            // Map answers with full text
            // Priority: detailedAnswers > realtime mapping > raw value
            const questions = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
            
            questions.forEach(qKey => {
                let answerText = '';
                
                // Try to find in stored detailed answers
                if (sub.detailedAnswers && sub.detailedAnswers.length > 0) {
                    const detail = sub.detailedAnswers.find(d => d.questionId === qKey);
                    if (detail) {
                        answerText = `${detail.selectedOption}. ${detail.optionText}`;
                    }
                }

                // Fallback to real-time mapping if detailedAnswers is missing/empty
                if (!answerText && sub.answers && sub.answers[qKey]) {
                    const optionKey = sub.answers[qKey];
                    const config = efficiencyQuizData[qKey];
                    if (config && config.options && config.options[optionKey]) {
                        answerText = `${optionKey}. ${config.options[optionKey]}`;
                    } else {
                        answerText = optionKey; // Just the letter 'A'
                    }
                }

                const questionLabel = efficiencyQuizData[qKey] ? `${qKey}-${efficiencyQuizData[qKey].text}` : qKey;
                row[questionLabel] = answerText;
            });

            return row;
        });

        if (format === 'csv') {
             const ws = XLSX.utils.json_to_sheet(data);
             const csv = XLSX.utils.sheet_to_csv(ws);
             res.setHeader('Content-Disposition', 'attachment; filename="efficiency_diagnosis_export.csv"');
             res.setHeader('Content-Type', 'text/csv; charset=utf-8');
             res.send('\uFEFF' + csv);
        } else {
             const wb = XLSX.utils.book_new();
             const ws = XLSX.utils.json_to_sheet(data);
             XLSX.utils.book_append_sheet(wb, ws, 'Efficiency Diagnosis');
             const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
             res.setHeader('Content-Disposition', 'attachment; filename="efficiency_diagnosis_export.xlsx"');
             res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
             res.send(buffer);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).send('Export failed');
    }
});

// Get Efficiency Diagnosis Submissions (Admin)
app.get('/api/efficiency-diagnosis', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const total = await EfficiencySubmission.countDocuments();
        const list = await EfficiencySubmission.find()
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
            
        res.json({
            data: list,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching efficiency submissions:', error);
        res.status(500).json({ success: false, message: '获取数据失败' });
    }
});

// Get Single Efficiency Diagnosis Detail (Admin)
app.get('/api/efficiency-diagnosis/:id', authRequired, requirePerm('appointment:list'), async (req, res) => {
    try {
        const submission = await EfficiencySubmission.findById(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Not found' });
        res.json(submission);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Efficiency Diagnosis
app.delete('/api/efficiency-diagnosis/:id', authRequired, requirePerm('appointment:delete'), async (req, res) => {
    try {
        await EfficiencySubmission.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Efficiency', `Deleted submission: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// --- Video Module ---
// Legacy Video Categories (replaced by the dynamic tree in routes/videoRoutes.js)
// But we keep this for legacy frontend compatibility if needed, or remove it to avoid conflicts
// Since videoRoutes.js handles /api/video-categories for POST/PUT/DELETE, this GET route 
// was likely causing conflicts or masking the POST route in videoRoutes.js if not ordered correctly.
// We have moved the full Video module logic to routes/videoRoutes.js

// Public: List videos (with optional pagination)
app.get('/api/videos', async (req, res) => {
    try {
        const { keyword, category, featured, page, limit } = req.query;
        const query = {};
        if (keyword && keyword.length <= 200) {
            const regex = new RegExp(escapeRegex(keyword), 'i');
            query.$or = [{ title: regex }, { description: regex }];
        }
        if (category && category !== 'all') {
            if (mongoose.Types.ObjectId.isValid(category)) {
                query.$or = [{ category: category }, { videoCategories: category }];
            } else {
                query.category = category;
            }
        }
        if (featured === 'true') {
            query.isRecommended = true;
        }
        let sort = { publishDate: -1 };
        if (featured === 'true') {
            sort = { recommendedAt: -1, publishDate: -1 };
        }
        if (page && limit) {
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const total = await Video.countDocuments(query);
            const data = await Video.find(query).sort(sort).skip(skip).limit(parseInt(limit));
            return res.json({
                data,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        }
        const list = await Video.find(query).sort(sort);
        res.json(list);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// Public: Get video detail by slug
app.get('/api/videos/detail/query', async (req, res) => {
    try {
        const { slug } = req.query;
        if (!slug) return res.status(400).json({ error: 'Slug is required' });
        await Video.updateOne({ slug, status: 'published' }, { $inc: { views: 1 } });
        const video = await Video.findOne({ slug, status: 'published' }).populate('speakers.authorId');
        if (!video) return res.status(404).json({ error: 'Video not found' });
        res.json(video);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// Video Detail Redirects & Serving
app.get('/video/:slug/', async (req, res) => {
    try {
        await Video.updateOne({ slug: req.params.slug, status: 'published' }, { $inc: { views: 1 } });
        const video = await Video.findOne({ slug: req.params.slug, status: 'published' }).populate('speakers.authorId');
        if (!video) return res.status(404).sendFile(path.join(__dirname, '404.html'));

        // SEO SSR logic for Video detail
        const fs = require('fs');
        const { JSDOM } = require('jsdom');
        let html = await fs.promises.readFile(path.join(__dirname, 'video-detail.html'), 'utf8');
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // SSR Render Footer
        try {
            injectFooterHTML(document);
        } catch (compErr) {
            console.warn('SSR components rendering skipped:', compErr.message);
        }

        // Title Rule Update
        const titleText = (video.metaTitle || video.title || '视频详情') + ' - 瑞华智策';
        document.title = titleText;

        const SITE_URL = process.env.SITE_URL || 'https://www.ruihuaconsulting.com';
        
        // Canonical Tag
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = 'canonical';
            document.head.appendChild(canonical);
        }
        canonical.href = `${SITE_URL}/video/${video.slug}/`;

        // Meta Tags
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = 'description';
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = (video.metaDescription || video.description || video.title).replace(/\r?\n/g, ' ');

        if (video.seoKeywords && video.seoKeywords.length > 0) {
            let metaKw = document.createElement('meta');
            metaKw.name = 'keywords';
            metaKw.content = video.seoKeywords.join(',');
            document.head.appendChild(metaKw);
        }

        if (video.geoSummary) {
            let metaAi = document.createElement('meta');
            metaAi.name = 'ai-summary';
            metaAi.content = video.geoSummary.replace(/\r?\n/g, ' ');
            document.head.appendChild(metaAi);
        }

        // Schema.org JSON-LD: VideoObject + FAQPage + BreadcrumbList
        let schemaScript = document.createElement('script');
        schemaScript.type = 'application/ld+json';
        
        const thumbnailUrl = video.thumbnail
            ? (video.thumbnail.startsWith('http') ? video.thumbnail : `${SITE_URL}${video.thumbnail}`)
            : `${SITE_URL}/images/default-video.jpg`;

        // Gather author info for schema
        let authorName = video.speakerName || '瑞华智策';
        if (video.speakers && video.speakers.length > 0 && video.speakers[0].authorId) {
            authorName = video.speakers[0].authorId.name || authorName;
        }

        const schemas = [
            {
                "@context": "https://schema.org",
                "@type": "VideoObject",
                "name": video.title,
                "description": video.geoSummary || video.description || video.title,
                "thumbnailUrl": thumbnailUrl,
                "uploadDate": video.publishDate || video.createdAt,
                "duration": video.durationSeconds
                    ? `PT${Math.floor(video.durationSeconds / 3600)}H${Math.floor((video.durationSeconds % 3600) / 60)}M${video.durationSeconds % 60}S`
                    : undefined,
                "author": { "@type": "Person", "name": authorName },
                "publisher": {
                    "@type": "Organization",
                    "name": "瑞华智策",
                    "logo": { "@type": "ImageObject", "url": `${SITE_URL}/images/logo.png` }
                }
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "首页", "item": SITE_URL },
                    { "@type": "ListItem", "position": 2, "name": "视频中心", "item": `${SITE_URL}/videos/` },
                    { "@type": "ListItem", "position": 3, "name": video.title }
                ]
            }
        ];

        // Filter out undefined duration
        if (!schemas[0].duration) delete schemas[0].duration;

        // FAQPage if faqs exist
        if (video.faqs && video.faqs.length > 0) {
            schemas.push({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": video.faqs.map(f => ({
                    "@type": "Question",
                    "name": f.question,
                    "acceptedAnswer": { "@type": "Answer", "text": f.answer }
                }))
            });
        }

        schemaScript.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": schemas });
        document.head.appendChild(schemaScript);

        // OG tags for social sharing
        const ogVideoTags = [
            ['og:title', titleText],
            ['og:description', video.geoSummary || video.description || video.title],
            ['og:image', thumbnailUrl],
            ['og:type', 'video.other'],
            ['og:url', `${SITE_URL}/video/${video.slug}/`]
        ];
        ogVideoTags.forEach(([prop, content]) => {
            if (!content) return;
            let tag = document.querySelector(`meta[property="${prop}"]`);
            if (!tag) {
                tag = document.createElement('meta');
                tag.setAttribute('property', prop);
                document.head.appendChild(tag);
            }
            tag.setAttribute('content', content);
        });

        // Pre-render core visual content
        const titleEl = document.getElementById('video-title');
        if (titleEl) titleEl.textContent = video.title;
        
        const dateEl = document.getElementById('video-date');
        if (dateEl && video.publishDate) {
            dateEl.textContent = new Date(video.publishDate).toLocaleDateString('zh-CN');
        }

        const viewsEl = document.getElementById('video-views');
        if (viewsEl) viewsEl.textContent = (video.views || 0).toLocaleString();

        const durationEl = document.getElementById('video-duration');
        if (durationEl) durationEl.textContent = video.duration || '00:00';

        // Pre-render Author / Speaker Info
        const speakerSection = document.getElementById('speaker-section');
        if (speakerSection) {
            if (video.speakers && video.speakers.length > 0 && video.speakers[0].authorId) {
                const author = video.speakers[0].authorId;
                speakerSection.classList.remove('hidden');
                speakerSection.classList.add('flex');
                
                const avatarEl = document.getElementById('speaker-avatar');
                if (avatarEl) {
                    avatarEl.src = author.avatar || '/images/vincent.png';
                    avatarEl.alt = author.name;
                }
                const nameEl = document.getElementById('speaker-name');
                if (nameEl) nameEl.textContent = author.name;
                const titleEl2 = document.getElementById('speaker-title');
                if (titleEl2) titleEl2.textContent = author.desc || video.speakers[0].role || '专家讲师';
                const descEl = document.getElementById('speaker-desc');
                if (descEl) {
                    let detailText = author.detail ? author.detail.replace(/<[^>]*>?/gm, '') : '';
                    descEl.textContent = detailText || `本次视频由 ${author.name} 担任讲师，深入解析行业洞见。`;
                }
            } else if (video.speakerName) {
                speakerSection.classList.remove('hidden');
                speakerSection.classList.add('flex');
                
                const avatarEl = document.getElementById('speaker-avatar');
                if (avatarEl) {
                    avatarEl.src = video.speakerAvatar || '/images/vincent.png';
                    avatarEl.alt = video.speakerName;
                }
                const nameEl = document.getElementById('speaker-name');
                if (nameEl) nameEl.textContent = video.speakerName;
                const titleEl2 = document.getElementById('speaker-title');
                if (titleEl2) titleEl2.textContent = video.speakerTitle || '特邀嘉宾';
                const descEl = document.getElementById('speaker-desc');
                if (descEl) descEl.textContent = video.speakerDesc || `本次视频由 ${video.speakerName} 担任讲师/分享嘉宾，深入解析行业洞见。`;
            }
        }

        const contentEl = document.getElementById('video-content');
        if (contentEl) {
            let fullContent = '';
            
            // Inject GEO Summary at the beginning if available
            if (video.geoSummary) {
                fullContent += `
                    <div class="bg-gradient-to-r from-brand-50 to-purple-50 rounded-xl p-5 mb-6 border border-brand-100 shadow-sm relative">
                        <div class="flex items-center gap-1.5 mb-2">
                            <i class="far fa-lightbulb text-brand-600 text-xs"></i>
                            <h3 class="text-brand-800 font-bold text-xs m-0 leading-none">内容摘要</h3>
                        </div>
                        <p class="text-slate-700 text-xs leading-relaxed m-0">${escapeHtml(video.geoSummary)}</p>
                    </div>
                `;
            }
            
            fullContent += video.content || video.description || '暂无详细介绍';
            contentEl.innerHTML = fullContent;
        }

        // Render AI Generated Video FAQs (independent from global FAQs)
        const faqSection = document.getElementById('faq-section');
        console.log('[SSR DEBUG] video faqs:', video.faqs);
        if (faqSection && video.faqs && video.faqs.length > 0) {
            const faqAccordion = document.getElementById('faq-accordion');
            if (faqAccordion) {
                faqAccordion.innerHTML = video.faqs.map((faq, index) => {
                    const isHidden = index >= 3 ? 'hidden video-faq-extra' : '';
                    return `
                        <div class="border border-slate-200 rounded-xl overflow-hidden bg-white faq-item ${isHidden}">
                            <button class="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-slate-50 transition-colors" onclick="window.VideoDetail.toggleFaq(this)">
                                <span class="font-bold text-slate-800 text-[15px] pr-4">${escapeHtml(faq.question)}</span>
                                <i class="fas fa-chevron-down text-slate-400 transition-transform duration-300 transform"></i>
                            </button>
                            <div class="faq-content overflow-hidden transition-all duration-300 ease-in-out max-h-0">
                                <div class="p-5 pt-0 text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none prose-slate border-t border-slate-100 mt-2">
                                    ${escapeHtml(faq.answer)}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                if (video.faqs.length > 3) {
                    faqAccordion.innerHTML += `
                        <div class="mt-4 text-center video-faq-more-container">
                            <button class="text-brand-600 text-sm font-medium hover:text-brand-700" onclick="window.VideoDetail.showAllFaqs(this)">查看更多问答 <i class="fas fa-angle-double-down ml-1"></i></button>
                        </div>
                    `;
                }
                faqSection.classList.remove('hidden');
                faqSection.setAttribute('data-ssr-rendered', 'true');
            }
        }

        // Fetch and pre-render related videos
        try {
            let query = { _id: { $ne: video._id }, status: 'published' };
            let relatedVideos = [];
            const limit = 4;
            
            if (video.tags && video.tags.length > 0) {
                const tagQuery = { ...query, tags: { $in: video.tags } };
                relatedVideos = await Video.find(tagQuery).sort({ publishDate: -1 }).limit(limit);
            }
            
            if (relatedVideos.length < limit) {
                const excludeIds = [video._id, ...relatedVideos.map(v => v._id)];
                let catQuery = { _id: { $nin: excludeIds }, status: 'published' };
                if (video.videoCategories && video.videoCategories.length > 0) {
                    catQuery.videoCategories = { $in: video.videoCategories };
                } else if (video.category) {
                    catQuery.category = video.category;
                }
                const moreVideos = await Video.find(catQuery).sort({ publishDate: -1 }).limit(limit - relatedVideos.length);
                relatedVideos = relatedVideos.concat(moreVideos);
            }
            
            if (relatedVideos.length < limit) {
                const excludeIds = [video._id, ...relatedVideos.map(v => v._id)];
                const newestVideos = await Video.find({ _id: { $nin: excludeIds }, status: 'published' })
                                              .sort({ publishDate: -1 })
                                              .limit(limit - relatedVideos.length);
                relatedVideos = relatedVideos.concat(newestVideos);
            }

            const relatedContainer = document.getElementById('related-videos');
            if (relatedContainer && relatedVideos.length > 0) {
                relatedContainer.innerHTML = relatedVideos.map(v => `
                  <a href="/video/${v.slug}/" class="group flex gap-3 items-start p-2 rounded-xl hover:bg-white transition-colors">
                    <div class="relative w-24 h-16 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                      <img src="${v.thumbnail || `https://picsum.photos/seed/${v.slug}/240/160`}" alt="${v.title}" class="w-full h-full object-cover transition-transform group-hover:scale-110">
                      <div class="absolute bottom-1 right-1 px-1 bg-black/60 text-[10px] text-white rounded">${v.duration || '00:00'}</div>
                    </div>
                    <div class="min-w-0">
                      <h4 class="text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-brand-600 transition-colors">${v.title}</h4>
                      <p class="text-[10px] text-slate-500 mt-1">${v.publishDate ? new Date(v.publishDate).toLocaleDateString('zh-CN') : '--'}</p>
                    </div>
                  </a>
                `).join('');
                relatedContainer.setAttribute('data-ssr-rendered', 'true');
            }
        } catch (relatedErr) {
            console.error('SSR Related Videos Error:', relatedErr);
        }

        // Inject pre-rendered data for hydration
        const scriptData = document.createElement('script');
        scriptData.textContent = `window.__VIDEO_DATA__ = ${JSON.stringify(video)};`;
        document.body.insertBefore(scriptData, document.body.firstChild);

        res.send(dom.serialize());
    } catch (e) {
        console.error('SSR Error:', e);
        res.status(500).sendFile(path.join(__dirname, '500.html'));
    }
});

app.get('/video/:slug.html', (req, res) => res.redirect(301, '/video/' + req.params.slug + '/'));

// Public: Get video detail by id and increment views
app.get('/api/videos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(404).json({ error: 'Invalid video id' });
        }
        await Video.updateOne({ _id: id, status: 'published' }, { $inc: { views: 1 } });
        const video = await Video.findOne({ _id: id, status: 'published' }).populate('speakers.authorId');
        if (!video) return res.status(404).json({ error: 'Video not found' });
        res.json(video);
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// Public: Get related videos by id (Semantic / Tags / Category based)
app.get('/api/videos/:id/related', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 4;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid video id' });
        }
        
        const currentVideo = await Video.findById(id);
        if (!currentVideo) return res.status(404).json({ error: 'Video not found' });
        
        // Match conditions for recommendations:
        // 1. Must be published
        // 2. Not the current video
        let query = {
            _id: { $ne: id },
            status: 'published'
        };
        
        // Try to match by tags first
        let relatedVideos = [];
        if (currentVideo.tags && currentVideo.tags.length > 0) {
            const tagQuery = { ...query, tags: { $in: currentVideo.tags } };
            relatedVideos = await Video.find(tagQuery).sort({ publishDate: -1 }).limit(limit);
        }
        
        // If not enough videos by tags, fill with same category
        if (relatedVideos.length < limit) {
            const excludeIds = [id, ...relatedVideos.map(v => v._id)];
            let catQuery = { _id: { $nin: excludeIds }, status: 'published' };
            
            if (currentVideo.videoCategories && currentVideo.videoCategories.length > 0) {
                catQuery.videoCategories = { $in: currentVideo.videoCategories };
            } else if (currentVideo.category) {
                catQuery.category = currentVideo.category;
            }
            
            const moreVideos = await Video.find(catQuery).sort({ publishDate: -1 }).limit(limit - relatedVideos.length);
            relatedVideos = relatedVideos.concat(moreVideos);
        }
        
        // If still not enough, fill with newest published videos
        if (relatedVideos.length < limit) {
            const excludeIds = [id, ...relatedVideos.map(v => v._id)];
            const newestVideos = await Video.find({ _id: { $nin: excludeIds }, status: 'published' })
                                          .sort({ publishDate: -1 })
                                          .limit(limit - relatedVideos.length);
            relatedVideos = relatedVideos.concat(newestVideos);
        }
        
        res.json({ success: true, data: relatedVideos });
    } catch (e) {
        console.error('[Related Videos Error]', e);
        return sendInternalError(res, null, e);
    }
});

// Admin: Create video
app.post('/api/videos', authRequired, requirePerm('video:create'), async (req, res) => {
    try {
        const { slug } = req.body;
        if (slug) {
            const existing = await Video.findOne({ slug });
            if (existing) return res.status(400).json({ error: 'URL (Slug) 已存在，请更换' });
        }
        
        if (req.body.content) {
            req.body.content = xss(req.body.content);
        }

        if (req.body.faqs && Array.isArray(req.body.faqs)) {
            req.body.faqs = req.body.faqs.map(faq => ({
                question: faq.question,
                answer: xss(faq.answer)
            }));
        }
        
        const video = new Video(req.body);
        if (!video.slug) video.slug = 'vid-' + Date.now();
        if (!video.publishDate) video.publishDate = new Date();
        if (video.isRecommended) video.recommendedAt = new Date();
        await video.save();
        await logOp('create', 'Video', `Created video: ${video.title}`, req.user.username);
        res.json({ success: true, data: video });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: 'URL (Slug) 已存在' });
        return sendInternalError(res, null, e);
    }
});

// Admin: Update video
app.put('/api/videos/:id', authRequired, requirePerm('video:edit'), async (req, res) => {
    try {
        const { slug } = req.body;
        if (slug) {
            const existing = await Video.findOne({ slug, _id: { $ne: req.params.id } });
            if (existing) return res.status(400).json({ error: 'URL (Slug) 已存在，请更换' });
        }
        
        const existingVideo = await Video.findById(req.params.id);
        if (!existingVideo) return res.status(404).json({ error: 'Video not found' });
        
        if (req.body.content) {
            req.body.content = xss(req.body.content);
        }

        if (req.body.faqs && Array.isArray(req.body.faqs)) {
            req.body.faqs = req.body.faqs.map(faq => ({
                question: faq.question,
                answer: xss(faq.answer)
            }));
        }
        
        const updateData = { ...req.body, updatedAt: new Date() };
        
        // Handle recommendedAt timestamp
        if (updateData.isRecommended && !existingVideo.isRecommended) {
            updateData.recommendedAt = new Date();
        } else if (updateData.isRecommended === false) {
            updateData.recommendedAt = null;
        }

        const updated = await Video.findByIdAndUpdate(req.params.id, updateData, { new: true });
        await logOp('update', 'Video', `Updated video: ${updated?.title || req.params.id}`, req.user.username);
        res.json({ success: true, data: updated });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// Admin: Delete video
app.delete('/api/videos/:id', authRequired, requirePerm('video:delete'), async (req, res) => {
    try {
        await Video.findByIdAndDelete(req.params.id);
        await logOp('delete', 'Video', `Deleted video: ${req.params.id}`, req.user.username);
        res.json({ success: true });
    } catch (e) {
        return sendInternalError(res, null, e);
    }
});

// Inject modular video routes (AI tools, category tree APIs, metadata parsing)
require('./routes/videoRoutes')(app, authRequired, requirePerm, logOp, generateDeepseekText);
require('./routes/videoEmbedRoutes')(app, authRequired, requirePerm, logOp);
require('./routes/activityRoutes')(app, authRequired, requirePerm, logOp);
require('./routes/activityTemplateRoutes')(app, authRequired, requirePerm, logOp);
require('./routes/surveyRoutes')(app, authRequired, requirePerm, logOp);

// 404 Handler
app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.xhr) {
        return res.status(404).json({ error: 'Not Found' });
    }
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    // If headers are already sent, delegate to the default Express error handler
    if (res.headersSent) {
        return next(err);
    }
    // Check if it's an API request or Page request
    if (req.path.startsWith('/api') || req.xhr) {
        res.status(err.status || 500).json({ 
            error: '服务器内部错误', 
            message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error' 
        });
    } else {
        res.status(err.status || 500).send('<h1>500 - 服务器内部错误</h1><p>请稍后再试。</p>');
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
