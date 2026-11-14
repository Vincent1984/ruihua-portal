const fs = require('fs');
const path = require('path');
const xss = require('xss');

const NqocBanner = require('../models/NqocBanner');
const NqocInsight = require('../models/NqocInsight');
const NqocCase = require('../models/NqocCase');
const NqocVideo = require('../models/NqocVideo');

const ROOT = path.join(__dirname, '..');
const VIEW_ROOT = path.join(ROOT, 'views/nqoc');
const REPORTS = require('../config/nqocReports.json');
const SITE_URL = 'https://www.ruihuaconsulting.com';
const DEFAULT_REPORTS = REPORTS.map(report => ({
    ...report,
    cover: String(report.cover || '').replace(/^\/img\//, '/nqoc/img/'),
    status: report.status || 'published'
}));
// 后台尚未配置 Banner 时，首页首屏使用默认内容（与旧版首页 Hero 一致）
const DEFAULT_BANNERS = [{
    titlePrefix: '中国',
    titleHighlight: '新质组织',
    highlightOnNewLine: false,
    titleLine2: '研究项目',
    desc: '洞察 AI 时代组织发展趋势，赋能中国企业组织进化',
    primaryText: '参与调研',
    primaryAction: 'link',
    primaryUrl: '/nqoc/survey',
    secondaryText: '评选申报',
    secondaryUrl: '/nqoc/awards',
    image: 'https://ruihua-portal.tos-cn-shanghai.volces.com/nqoc/nqoc-banner.png',
    imageAlt: '中国新质组织研究体系',
    stats: [
        { value: '5大', label: '维度组织模型' },
        { value: '50+', label: '智库专家（持续更新中）' },
        { value: '500+', label: '企业参与研究' }
    ]
}];

const postSanitizer = new xss.FilterXSS({
    whiteList: {
        p: [], h2: ['id'], h3: ['id'], ul: [], ol: [], li: [],
        blockquote: [], strong: [], em: [], u: [], br: [],
        a: ['href'], img: ['src', 'alt'], figure: [], figcaption: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
    onTagAttr(tag, name, value) {
        if (tag === 'a' && name === 'href') {
            return /^(\/nqoc(?:\/|$)|https:\/\/)/i.test(value) ? `href="${xss.safeAttrValue(value)}"` : '';
        }
        if (tag === 'img' && name === 'src') {
            const publicUrl = String(process.env.TOS_PUBLIC_URL || '').replace(/\/+$/, '');
            const allowed = value.startsWith('/uploads/') || value.startsWith('/images/') ||
                value.startsWith('/img/') || (publicUrl && value.startsWith(publicUrl + '/'));
            return allowed ? `src="${xss.safeAttrValue(value)}"` : '';
        }
        return undefined;
    }
});

function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

function readView(file) {
    return fs.readFileSync(path.join(VIEW_ROOT, file), 'utf8');
}

function parseTemplate(source) {
    const root = [];
    const stack = [{ node: { children: root }, target: root }];
    const tokens = source.match(/\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g) || [];
    let cursor = 0;
    const parts = source.split(/\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g);

    parts.forEach((text, index) => {
        if (text) stack[stack.length - 1].target.push({ type: 'text', value: text });
        if (index >= tokens.length) return;
        const token = tokens[index];
        const raw = token.startsWith('{{{');
        const expression = token.slice(raw ? 3 : 2, raw ? -3 : -2).trim();
        if (expression.startsWith('#if ') || expression.startsWith('#each ')) {
            const kind = expression.startsWith('#if ') ? 'if' : 'each';
            const node = { type: kind, expression: expression.slice(kind.length + 2).trim(), yes: [], no: [] };
            stack[stack.length - 1].target.push(node);
            stack.push({ node, target: node.yes });
        } else if (expression === 'else') {
            const current = stack[stack.length - 1];
            current.target = current.node.no;
        } else if (expression === '/if' || expression === '/each') {
            stack.pop();
        } else {
            stack[stack.length - 1].target.push({ type: 'value', expression, raw });
        }
        cursor += text.length + token.length;
    });
    return root;
}

function lookup(expression, frames) {
    if (expression === '@first') return frames[frames.length - 1].meta.first;
    if (expression === '@index') return frames[frames.length - 1].meta.index;
    const parts = expression === 'this' ? [] : expression.replace(/^this\./, '').split('.');
    for (let i = frames.length - 1; i >= 0; i -= 1) {
        let value = frames[i].value;
        if (!parts.length) return value;
        let found = true;
        for (const part of parts) {
            if (value == null || !Object.prototype.hasOwnProperty.call(Object(value), part)) {
                found = false;
                break;
            }
            value = value[part];
        }
        if (found) return value;
    }
    return '';
}

function truthy(value) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== '' && value !== null && value !== undefined && value !== false;
}

function renderNodes(nodes, frames) {
    return nodes.map(node => {
        if (node.type === 'text') return node.value;
        if (node.type === 'value') {
            const value = lookup(node.expression, frames);
            return node.raw ? String(value == null ? '' : value) : esc(value);
        }
        const value = lookup(node.expression, frames);
        if (node.type === 'if') return renderNodes(truthy(value) ? node.yes : node.no, frames);
        if (node.type === 'each') {
            const list = Array.isArray(value) ? value : [];
            if (!list.length) return renderNodes(node.no, frames);
            return list.map((item, index) => renderNodes(node.yes, frames.concat({
                value: item,
                meta: { first: index === 0, index }
            }))).join('');
        }
        return '';
    }).join('');
}

function renderTemplate(source, data) {
    return renderNodes(parseTemplate(source), [{ value: data, meta: {} }]);
}

function pathAssets(html) {
    return html.replace(/(["'(=])\/img\//g, '$1/nqoc/img/');
}

function dateOnly(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function dateText(value) {
    return dateOnly(value).replace(/-/g, '.');
}

function addToc(html) {
    const toc = [];
    const bodyHtml = postSanitizer.process(String(html || '')).replace(/<h2(?:\s+id="[^"]*")?>([\s\S]*?)<\/h2>/gi, (_, title) => {
        const id = `sec-${toc.length + 1}`;
        const text = title.replace(/<[^>]+>/g, '').trim();
        toc.push({ id, text });
        return `<h2 id="${id}">${title}</h2>`;
    });
    return { bodyHtml, toc: toc.length >= 3 ? toc : [] };
}

function decorate(item, extra = {}) {
    const clean = item.toObject ? item.toObject() : { ...item };
    clean.id = String(clean._id || clean.id || '');
    delete clean._id;
    delete clean.__v;
    clean.publishDate = dateOnly(clean.publishDate);
    clean.updatedAt = dateOnly(clean.updatedAt);
    const body = addToc(clean.body);
    clean.rel = {
        dateText: dateText(clean.publishDate),
        bodyHtml: body.bodyHtml,
        toc: body.toc,
        ...extra
    };
    return clean;
}

function sortPublished(items, withTop = false) {
    return items.filter(item => item.status === 'published').sort((a, b) =>
        (withTop ? Number(!!b.top) - Number(!!a.top) : 0) ||
        dateOnly(b.publishDate).localeCompare(dateOnly(a.publishDate))
    );
}

function decorateRelated(item, items, type) {
    const links = {
        insight: '/nqoc/insights/',
        case: '/nqoc/cases/',
        video: '/nqoc/worth-seeing/',
        report: '/nqoc/whitepaper/'
    };
    const extraFor = (x) => {
        if (type === 'insight') return { byline: x.source || x.author || '' };
        if (type === 'video') return { guestNames: (x.guests || []).map(g => g.name).filter(Boolean).join('、'), coverAlt: `《值得看见》${x.episode} 封面` };
        return {};
    };
    item.rel.related = items.filter(x => x.slug !== item.slug).slice(0, 3).map(x => decorate(x, extraFor(x)));
    item.rel.detailPath = links[type] + item.slug;
    return item;
}

function activeNav(html, activeKey) {
    return html.replace(/<a\b[^>]*data-nav-key="([^"]+)"[^>]*>/g, (tag, key) => {
        if (key !== activeKey) return tag;
        return tag.replace(/\bclass="([^"]*)"/, (_, classes) => `class="${classes} act"`);
    });
}

function renderNav(activeKey, latestReport) {
    const config = {
        logo: '/nqoc/img/nqoc-logo.png',
        icp: '沪ICP备12042344号-24',
        reportName: latestReport.title || '',
        reportSubtitle: latestReport.subtitle || '',
        reportSlug: latestReport.slug || ''
    };
    const replaceConfig = source => source
        .replaceAll('<!--CONFIG_LOGO-->', esc(config.logo))
        .replaceAll('<!--CONFIG_ICP-->', esc(config.icp))
        .replaceAll('<!--CONFIG_REPORT_SLUG-->', esc(config.reportSlug));
    return {
        nav: activeNav(replaceConfig(readView('partials/nav.html')), activeKey),
        mobile: activeNav(replaceConfig(readView('partials/mobile-nav.html')), activeKey)
    };
}

function buildSeoMeta({ pathName, title, description, image, noindex, pageType }) {
    const canonical = `${SITE_URL}${pathName}`;
    const safeImage = image && /^https:\/\//i.test(image) ? image : `${SITE_URL}${image || '/nqoc/img/share.jpg'}`;
    return [
        noindex
            ? '<meta name="robots" content="noindex, nofollow">'
            : '<meta name="robots" content="index, follow, max-image-preview:large">',
        `<link rel="canonical" href="${esc(canonical)}">`,
        '<meta property="og:site_name" content="中国新质组织研究中心">',
        '<meta property="og:locale" content="zh_CN">',
        `<meta property="og:type" content="${noindex ? 'website' : (pageType || 'article')}">`,
        `<meta property="og:title" content="${esc(title)}">`,
        `<meta property="og:description" content="${esc(description)}">`,
        `<meta property="og:url" content="${esc(canonical)}">`,
        `<meta property="og:image" content="${esc(safeImage)}">`
    ].filter(Boolean).join('\n');
}

// 栏目路径 → 面包屑名称与详情页标题用词
const NQOC_SECTIONS = {
    whitepaper: { name: '研究成果', path: '/nqoc/whitepaper', detailLabel: '新质组织研究报告' },
    insights: { name: '新质观点', path: '/nqoc/insights', detailLabel: '新质观点' },
    cases: { name: '案例研究', path: '/nqoc/cases', detailLabel: '新质组织案例' },
    'worth-seeing': { name: '值得看见', path: '/nqoc/worth-seeing', detailLabel: '值得看见' }
};

function sectionOf(pathName) {
    return Object.values(NQOC_SECTIONS).find(section =>
        pathName === section.path || pathName.startsWith(`${section.path}/`)) || null;
}

// 详情页标题：标题过长时只保留品牌后缀，避免被搜索结果截断
function detailTitle(item, label) {
    const base = String((item && item.title) || '').trim();
    return base.length > 18
        ? `${base} - 中国新质组织研究中心`
        : `${base} - ${label} - 中国新质组织研究中心`;
}

function breadcrumbList(entries) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: entries.map((entry, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: entry.name,
            item: entry.item
        }))
    };
}

function structuredData({ type, item, pathName, title, description, listItems }) {
    const organization = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': `${SITE_URL}/nqoc#organization`,
        name: '中国新质组织研究中心',
        url: `${SITE_URL}/nqoc`,
        logo: `${SITE_URL}/nqoc/img/nqoc-logo.png`
    };
    const website = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${SITE_URL}/nqoc#website`,
        name: '中国新质组织研究中心',
        url: `${SITE_URL}/nqoc`,
        inLanguage: 'zh-CN',
        publisher: { '@id': `${SITE_URL}/nqoc#organization` }
    };
    const graph = [organization, website];
    const section = sectionOf(pathName);

    if (section && item) {
        if (type === 'video' && !item.videoUrl) return graph;
        const data = type === 'report'
            ? { '@type': 'Report', headline: item.title, description: item.summary, datePublished: item.publishDate, dateModified: item.updatedAt }
            : type === 'video'
                ? { '@type': 'VideoObject', name: item.title, description: item.summary, thumbnailUrl: item.cover, contentUrl: item.videoUrl, uploadDate: item.publishDate }
                : { '@type': 'Article', headline: item.title, description: item.summary, datePublished: item.publishDate, dateModified: item.updatedAt, articleSection: section.name };
        data.publisher = { '@id': `${SITE_URL}/nqoc#organization` };
        data.mainEntityOfPage = `${SITE_URL}${item.rel.detailPath}`;
        if (item.cover) data.image = item.cover;
        graph.push(data, breadcrumbList([
            { name: '首页', item: `${SITE_URL}/nqoc` },
            { name: section.name, item: `${SITE_URL}${section.path}` },
            { name: item.title, item: `${SITE_URL}${item.rel.detailPath}` }
        ]));
        return graph;
    }

    if (section && listItems && listItems.length) {
        graph.push({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            '@id': `${SITE_URL}${pathName}#collection`,
            name: title,
            description,
            url: `${SITE_URL}${pathName}`,
            inLanguage: 'zh-CN',
            isPartOf: { '@id': `${SITE_URL}/nqoc#website` },
            mainEntity: {
                '@type': 'ItemList',
                itemListElement: listItems.map((entry, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    name: entry.title,
                    url: entry.url
                }))
            }
        }, breadcrumbList([
            { name: '首页', item: `${SITE_URL}/nqoc` },
            { name: section.name, item: `${SITE_URL}${section.path}` }
        ]));
    }
    return graph;
}

function renderShell({ pathName, activeKey, title, description, content, latestReport, item, itemType, noindex, prescript, pageType, listItems }) {
    const nav = renderNav(activeKey, latestReport);
    const footer = readView('partials/footer.html').replace('<!--CONFIG_ICP-->', '沪ICP备12042344号-24');
    const drawer = readView('partials/drawer.html')
        .replaceAll('<!--CONFIG_REPORT_NAME-->', esc(latestReport.title || '领取报告'))
        .replaceAll('<!--CONFIG_REPORT_SUBTITLE-->', esc(latestReport.subtitle || ''))
        .replaceAll('<!--CONFIG_REPORT_SLUG-->', esc(latestReport.slug || ''))
        .replaceAll('<!--CONFIG_REPORT_COVER-->', esc(latestReport.cover || ''))
        .replaceAll('<!--CONFIG_REPORT_COVER_ALT-->', esc(latestReport.coverAlt || ''));
    const seoImage = item && item.cover ? item.cover : '/nqoc/img/share.jpg';
    const meta = buildSeoMeta({ pathName, title, description, image: seoImage, noindex, pageType });
    const jsonLd = JSON.stringify(structuredData({ type: itemType, item, pathName, title, description, listItems })).replace(/</g, '\\u003c');
    const shell = readView('base.html')
        .replace('<!--TITLE-->', esc(title))
        .replace('<!--DESCRIPTION-->', esc(description))
        .replace('<!--SEO_META-->', meta)
        .replace('<!--STRUCTURED_DATA-->', `<script type="application/ld+json">${jsonLd}</script>`)
        .replace('<!--HEAD_EXTRA-->', '<meta name="theme-color" content="#07090f">')
        .replace('<!--NAV-->', nav.nav)
        .replace('<!--MOBILE_NAV-->', nav.mobile)
        .replace('<!--CONTENT-->', content)
        .replace('<!--FOOTER-->', footer)
        .replace('<!--DRAWER-->', drawer)
        .replace('<!--PRESCRIPT-->', prescript || '')
        .replace('/css/app.build.css?v=20261110-2', '/nqoc/css/app.build.css?v=20261114a')
        .replace('/js/app.js?v=20261110-2', '/nqoc/js/app-20261110.js?v=20261114a');
    return pathAssets(shell);
}

async function getCollections() {
    const [bannerDocs, insights, cases, videos] = await Promise.all([
        NqocBanner.find({ isOnline: true }).sort({ sort: 1, _id: 1 }).limit(3).lean(),
        NqocInsight.find({ status: 'published' }).sort({ top: -1, publishDate: -1 }).lean(),
        NqocCase.find({ status: 'published' }).sort({ top: -1, publishDate: -1 }).lean(),
        NqocVideo.find({ status: 'published' }).sort({ publishDate: -1 }).lean()
    ]);
    const banners = bannerDocs.length ? bannerDocs : DEFAULT_BANNERS;
    const reports = sortPublished(DEFAULT_REPORTS);
    return { banners, insights: sortPublished(insights, true), cases: sortPublished(cases, true), videos: sortPublished(videos), reports };
}

function detailData(items, slug, type) {
    const found = items.find(item => item.slug === slug);
    if (!found) return null;
    const related = items.filter(item => item.slug !== slug).slice(0, 3);
    let extra = {};
    if (type === 'insight') extra.byline = found.source || found.author || '';
    if (type === 'video') {
        extra.guestNames = (found.guests || []).map(g => g.name).filter(Boolean).join('、');
        extra.coverAlt = `《值得看见》${found.episode} 封面`;
    }
    if (type === 'report') {
        extra.isForm = found.accessMode === 'form';
        extra.isDirect = found.accessMode === 'direct';
    }
    const item = decorate(found, extra);
    item.rel.related = related.map(entry => decorate(entry, type === 'insight'
        ? { byline: entry.source || entry.author || '' }
        : type === 'video'
            ? { guestNames: (entry.guests || []).map(g => g.name).filter(Boolean).join('、'), coverAlt: `《值得看见》${entry.episode} 封面` }
            : {}));
    item.rel.detailPath = ({ insight: '/nqoc/insights/', case: '/nqoc/cases/', video: '/nqoc/worth-seeing/', report: '/nqoc/whitepaper/' })[type] + slug;
    return item;
}

function renderBlock(name, data) {
    return renderTemplate(readView(`page-blocks/${name}.html`), data);
}

function pageHandler(config, queryData) {
    return async (req, res) => {
        try {
            const collections = await getCollections();
            const latestReport = collections.reports[0] || {};
            const payload = await queryData(req, collections);
            if (!payload) return res.status(404).send('Not Found');
            const content = renderBlock(config.block, {
                ...payload.data,
                collections,
                view: payload.view || {},
                page: {}
            }).replace('class="page"', 'class="page on"');
            res.type('html').send(renderShell({
                pathName: req.path,
                activeKey: config.activeKey,
                title: payload.title || config.title,
                description: payload.description || config.description,
                content,
                latestReport,
                item: payload.item,
                itemType: payload.itemType,
                noindex: payload.noindex,
                pageType: config.pageType || (payload.item
                    ? (payload.itemType === 'video' ? 'video.other' : 'article')
                    : 'website'),
                listItems: payload.listItems || [],
                prescript: config.block === 'home'
                    ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/particles.js/2.0.0/particles.min.js" defer></script>'
                    : ''
            }));
        } catch (error) {
            console.error('NQOC frontend render error:', error);
            res.status(500).send('页面暂时无法加载，请稍后重试。');
        }
    };
}

function decorateList(items, type) {
    return items.map(item => {
        let extra = {};
        if (type === 'insight') extra.byline = item.source || item.author || '';
        if (type === 'video') {
            extra.guestNames = (item.guests || []).map(g => g.name).filter(Boolean).join('、');
            extra.coverAlt = `《值得看见》${item.episode} 封面`;
        }
        return decorate(item, extra);
    });
}

function renderLegacyPage(page, latestReport, activeKey) {
    let html = fs.readFileSync(path.join(ROOT, `public/nqoc/${page}.html`), 'utf8');
    const nav = renderNav(activeKey, latestReport);
    html = html.replace(/<nav class="nqoc-nav\b[\s\S]*?<\/nav>/i, nav.nav)
        .replace(/<nav id="nqocMobileMenu"[\s\S]*?<\/nav>/i, nav.mobile)
        .replace(/<footer\b[\s\S]*?<\/footer>/i, readView('partials/footer.html').replace('<!--CONFIG_ICP-->', '沪ICP备12042344号-24'));
    html = html.replace(/<head>/i, '<head><link rel="stylesheet" href="/nqoc/css/app.build.css?v=20261114a">');
    html = html.replace('</body>', `${readView('partials/drawer.html')
        .replaceAll('<!--CONFIG_REPORT_NAME-->', esc(latestReport.title || '领取报告'))
        .replaceAll('<!--CONFIG_REPORT_SUBTITLE-->', esc(latestReport.subtitle || ''))
        .replaceAll('<!--CONFIG_REPORT_SLUG-->', esc(latestReport.slug || ''))
        .replaceAll('<!--CONFIG_REPORT_COVER-->', esc(latestReport.cover || ''))
        .replaceAll('<!--CONFIG_REPORT_COVER_ALT-->', esc(latestReport.coverAlt || ''))}
<div class="toast" role="status" data-toast hidden></div>
<script src="/nqoc/js/app-20261110.js?v=20261114a" defer></script></body>`);
    if (page === 'expert-apply') html = html.replace('<head>', '<head><meta name="robots" content="noindex, nofollow">');
    return html;
}

function initNqocFrontend(app) {
    app.get('/nqoc', pageHandler({
        block: 'home', activeKey: 'home', title: '新质组织研究 - AI时代组织进化 - 中国新质组织研究中心',
        description: '中国新质组织研究项目由人瑞人才与瑞华智策联合发起，中国经营报联合主办，洞察 AI 时代组织发展趋势，赋能中国企业组织进化。'
    }, async (_req, c) => {
        const banners = c.banners.map((banner, index) => ({
            ...banner,
            rel: {
                label: `第 ${index + 1} 张，共 ${c.banners.length} 张`,
                current: String(index === 0),
                primaryHref: banner.primaryAction === 'report'
                    ? '/nqoc/whitepaper-apply'
                    : banner.primaryUrl
            }
        }));
        const insights = decorateList(c.insights, 'insight');
        const cases = decorateList(c.cases, 'case');
        const reports = decorateList(c.reports, 'report');
        const videos = decorateList(c.videos, 'video');
        return {
            data: {},
            view: {
                banners,
                bannerMulti: banners.length > 1,
                insightFeatured: insights.slice(0, 1),
                insightRest: insights.slice(1),
                reportFeatured: reports.slice(0, 1),
                reportRest: reports.slice(1),
                videoFeatured: videos.slice(0, 1),
                videoRest: videos.slice(1),
                videoMoreClass: (() => {
                    const count = Math.max(videos.length - 1, 0);
                    return `is-d${3 - (count % 3)} is-t${2 - (count % 2)}`;
                })()
            }
        };
    }));

    app.get('/nqoc/whitepaper', pageHandler({
        block: 'reports', activeKey: 'whitepaper', title: '新质组织研究报告 - 免费下载 - 中国新质组织研究中心',
        description: '中国新质组织研究中心发布的研究报告、行业报告与案例集，呈现中国企业新质组织的发展现状、演进路径与行动方向。'
    }, async (_req, c) => {
        const reports = decorateList(c.reports, 'report');
        return {
            data: {},
            view: { reportFeatured: reports.slice(0, 1), reportRest: reports.slice(1) },
            listItems: reports.map(report => ({ title: report.title, url: `${SITE_URL}/nqoc/whitepaper/${report.slug}` }))
        };
    }));

    app.get('/nqoc/whitepaper/:slug', pageHandler({
        block: 'report-detail', activeKey: 'whitepaper', title: '研究成果'
    }, async (req, c) => {
        const item = detailData(c.reports, req.params.slug, 'report');
        if (!item) return null;
        return {
            data: item,
            view: {},
            item,
            itemType: 'report',
            title: detailTitle(item, NQOC_SECTIONS.whitepaper.detailLabel),
            description: item.summary
        };
    }));

    // 报告下载凭证失效 / 过期 / 超次后的落地页（noindex，不进 sitemap）
    app.get('/nqoc/report-expired', pageHandler({
        block: 'report-expired', activeKey: '', title: '报告链接已失效 - 中国新质组织研究中心',
        description: '报告下载链接仅在领取成功后 24 小时内有效，超时后请重新领取。'
    }, async () => ({ data: {}, noindex: true })));

    app.get('/nqoc/insights', pageHandler({
        block: 'insights', activeKey: 'insights', title: '新质观点 - AI时代组织重构洞察 - 中国新质组织研究中心',
        description: '汇聚管理学者与企业实战专家对 AI 时代组织重构、人机协同与人力资本价值经营的观点与洞察。'
    }, async (_req, c) => {
        const items = decorateList(c.insights, 'insight');
        return {
            data: {},
            view: { insightFeatured: items.slice(0, 1), insightRest: items.slice(1) },
            listItems: items.map(insight => ({ title: insight.title, url: `${SITE_URL}/nqoc/insights/${insight.slug}` }))
        };
    }));

    app.get('/nqoc/insights/:slug', pageHandler({
        block: 'insight-detail', activeKey: 'insights', title: '新质观点'
    }, async (req, c) => {
        const item = detailData(c.insights, req.params.slug, 'insight');
        return item ? { data: item, item, itemType: 'insight', title: detailTitle(item, NQOC_SECTIONS.insights.detailLabel), description: item.summary } : null;
    }));

    app.get('/nqoc/cases', pageHandler({
        block: 'cases', activeKey: 'cases', title: '新质组织案例研究 - 标杆企业实践 - 中国新质组织研究中心',
        description: '深度剖析各行业标杆企业在核心价值观、商业模式、生产方式、管理范式与生态协同五个维度上的新质组织实践。'
    }, async (_req, c) => {
        const cases = decorateList(c.cases, 'case');
        return {
            data: { cases },
            listItems: cases.map(item => ({ title: item.title, url: `${SITE_URL}/nqoc/cases/${item.slug}` }))
        };
    }));

    app.get('/nqoc/cases/:slug', pageHandler({
        block: 'case-detail', activeKey: 'cases', title: '案例研究'
    }, async (req, c) => {
        const item = detailData(c.cases, req.params.slug, 'case');
        return item ? { data: item, item, itemType: 'case', title: detailTitle(item, NQOC_SECTIONS.cases.detailLabel), description: item.summary } : null;
    }));

    app.get('/nqoc/worth-seeing', pageHandler({
        block: 'videos', activeKey: 'worth-seeing', title: '值得看见 - 新质组织系列对谈视频 - 中国新质组织研究中心',
        description: '「中国新质组织研究」系列对谈栏目《值得看见》：对话学者与企业实践者，讨论 AI 时代的组织进化。'
    }, async (_req, c) => {
        const items = decorateList(c.videos, 'video');
        return {
            data: {},
            view: {
                videoFeatured: items.slice(0, 1),
                videoRest: items.slice(1),
                videoMoreClass: `is-d${3 - (Math.max(items.length - 1, 0) % 3)} is-t${2 - (Math.max(items.length - 1, 0) % 2)}`
            },
            listItems: items.map(video => ({ title: video.title, url: `${SITE_URL}/nqoc/worth-seeing/${video.slug}` }))
        };
    }));

    app.get('/nqoc/worth-seeing/:slug', pageHandler({
        block: 'video-detail', activeKey: 'worth-seeing', title: '值得看见'
    }, async (req, c) => {
        const item = detailData(c.videos, req.params.slug, 'video');
        return item ? { data: item, item, itemType: 'video', title: detailTitle(item, NQOC_SECTIONS['worth-seeing'].detailLabel), description: item.summary } : null;
    }));

    const legacy = {
        survey: 'survey',
        awards: 'awards',
        events: 'events',
        about: 'about',
        'expert-apply': 'expert-apply',
        'whitepaper-apply': 'whitepaper'
    };
    Object.entries(legacy).forEach(([page, key]) => {
        app.get(`/nqoc/${page}`, async (_req, res) => {
            try {
                const reports = sortPublished(DEFAULT_REPORTS);
                res.type('html').send(renderLegacyPage(page, reports[0] || {}, key));
            } catch (error) {
                console.error(`NQOC legacy page render error (${page}):`, error);
                res.status(500).send('页面暂时无法加载，请稍后重试。');
            }
        });
    });

    ['debate-vote', 'flyer', 'poster'].forEach(page => {
        app.get(`/nqoc/${page}`, (req, res) => res.sendFile(path.join(ROOT, `public/nqoc/${page}.html`)));
    });
}

module.exports = initNqocFrontend;
