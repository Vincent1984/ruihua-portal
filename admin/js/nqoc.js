/**
 * 新质组织（迷你站 /nqoc）后台业务模块
 * ---------------------------------------------------------------------------
 * 挂在 admin/console.html 自研 SPA 壳里，与【官网运营】共用 admin-2026.css 的自研组件，
 * 不使用 Bootstrap。依赖 admin-2026.js 暴露的全局：json / authHeaders / esc / toast /
 * hasPermission / ago / shortDateTime。
 *
 * 接口前缀 /api （server.js: app.use('/api', apiRouter)）：
 *   GET/POST        /api/admin/nqoc/banners            PUT/DELETE /api/admin/nqoc/banners/:id
 *   PUT             /api/admin/nqoc/banners/sort       body: { ids: [...] }
 *   GET/POST        /api/admin/nqoc/insights           PUT/DELETE /api/admin/nqoc/insights/:id
 *   GET/POST        /api/admin/nqoc/cases              PUT/DELETE /api/admin/nqoc/cases/:id
 *   GET/POST        /api/admin/nqoc/videos             PUT/DELETE /api/admin/nqoc/videos/:id
 *   GET             /api/admin/nqoc/report-leads       只读
 *   GET             /api/admin/nqoc/report-leads/export  服务端生成 xlsx
 *
 * 列表接口支持 ?q=&status=，但后台数据量小，这里统一「一次拉全量 + 前端过滤」，
 * 输入即时反馈、不用防抖；导出走服务端按当前筛选重新生成。
 *
 * 视图 / 菜单 data-target / 权限点三处同名：nqoc-banner、nqoc-insights、nqoc-cases、
 * nqoc-videos、nqoc-report-leads。观点 / 案例的编辑走「创作工作台」(#studioModal)，
 * 由 article-management.js 的 window.openStudio 扩展 nqoc-insight / nqoc-case 两种 type。
 */
(function () {
    'use strict';

    const API = '/api/admin/nqoc';
    const DAY = 86400000;

    const NQ_TYPES = {
        banner: { res: 'banners', view: 'nqoc-banner', name: 'Banner' },
        insight: { res: 'insights', view: 'nqoc-insights', name: '观点', path: '/nqoc/insights/', pre: 'insight', rows: 'nqInsRows', cols: 8, studio: 'nqoc-insight' },
        case: { res: 'cases', view: 'nqoc-cases', name: '案例', path: '/nqoc/cases/', pre: 'case', rows: 'nqCasRows', cols: 7, studio: 'nqoc-case' },
        video: { res: 'videos', view: 'nqoc-videos', name: '节目', path: '/nqoc/worth-seeing/', pre: 'ep' }
    };
    const NQ_STATUS = { draft: '草稿', published: '已发布', archived: '已下架' };
    const NQ_STATUS_OPTS = [
        ['draft', '草稿 — 仅后台可见'],
        ['published', '发布 — 前台可见'],
        ['archived', '下架 — 前台不可见，数据保留']
    ];
    const NQ_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const NQ_FILTERS = {
        'nqoc-insights': { q: '', status: '' },
        'nqoc-cases': { q: '', status: '' },
        'nqoc-videos': { q: '', status: '' },
        'nqoc-report-leads': { q: '', range: '', dup: '', bin: '', mailStatus: '' }
    };
    const NQ_FILTER_OK = { status: ['', 'draft', 'published', 'archived'], range: ['', '1', '7', '30'], dup: ['', '1'], bin: ['', '1'], mailStatus: ['', 'unsent', 'queued', 'unopened', 'opened', 'failed', 'uncertain'] };

    let nqBanners = [];
    let nqPosts = { insight: [], case: [] };
    let nqVideos = [];
    let nqLeads = [];
    const reportMailSelected = new Set();
    let nqLeadDup = {};   // 归一化手机号 -> 提交次数（仅 ≥2 次的手机号）
    let nqLeadStats = { today: 0, week7: 0, all: 0, companies: 0, delivered: 0, opened: 0 };
    let nqLeadDetailState = null;   // 报告领取记录详情：{ id, from, lead }
    let nqEd = null;   // 弹窗（banner / video）上下文
    let nqPend = {};   // 弹窗里刚选好、尚未保存的图片

    /* ------------------------------ 小工具 ------------------------------ */

    const $ = id => document.getElementById(id);
    const todayStr = () => new Date().toISOString().slice(0, 10);

    function nqThumb(src, cls, label) {
        if (!src) return `<span class="thumb none ${cls || ''}">无图</span>`;
        return `<span class="thumb ${cls || ''}"><img src="${esc(src)}" alt="${esc(label || '')}"></span>`;
    }
    function nqVideoBox(url) {
        return url
            ? `<div class="sub" style="word-break:break-all"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></div>`
            : '<div class="sub">尚未上传视频</div>';
    }
    function nqChip(st) { return `<span class="chip ${esc(st)}">${NQ_STATUS[st] || st}</span>`; }
    function nqOps(t, o, view) {
        return `<button type="button" data-action="edit" data-type="${t}" data-id="${esc(o.id)}" data-permission="${view}:update">编辑</button>` +
            `<button type="button" data-action="preview" data-type="${t}" data-id="${esc(o.id)}">预览</button>` +
            `<button type="button" data-action="delete" data-type="${t}" data-id="${esc(o.id)}" data-permission="${view}:delete">删除</button>`;
    }
    function nqOkUrl(u) { return /^\/nqoc(\/|$)/.test(u) || /^https:\/\//i.test(u); }
    function nqAutoSlug(pre) {
        const d = new Date(), p = n => String(n).padStart(2, '0');
        return `${pre}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 6)}`;
    }
    function nqApplyPerms(root) {
        root.querySelectorAll('[data-permission]').forEach(el => { if (!hasPermission(el.dataset.permission)) el.hidden = true; });
    }
    function nqFind(t, id) {
        const list = t === 'banner' ? nqBanners : t === 'video' ? nqVideos : nqPosts[t];
        return (list || []).find(x => String(x.id) === String(id)) || null;
    }
    function nqNextEpisode() {
        let max = 0;
        nqVideos.forEach(v => { const m = /^E(\d{2,3})$/.exec(v.episode || ''); if (m) max = Math.max(max, +m[1]); });
        return 'E' + String(max + 1).padStart(2, '0');
    }

    /* ------------------------------ 筛选同步 ------------------------------ */

    function nqSyncFilterUi(view) {
        const f = NQ_FILTERS[view];
        const box = document.querySelector(`[data-view="${view}"]`);
        if (!f || !box) return;
        const q = box.querySelector('input[data-filter="q"]');
        if (q && document.activeElement !== q) q.value = f.q;
        box.querySelectorAll('.segments[data-filter]').forEach(seg => {
            const key = seg.dataset.filter;
            seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.value || '') === (f[key] || '')));
        });
        box.querySelectorAll('select[data-filter]').forEach(s => { s.value = f[s.dataset.filter] || ''; });
    }
    function nqSyncUrl(view) {
        const f = NQ_FILTERS[view];
        if (!f || nqLeadDetailState) return;   // 详情页保留 /admin/nqoc-report-leads/<id>
        const qs = Object.keys(f).filter(k => f[k]).map(k => k + '=' + encodeURIComponent(f[k])).join('&');
        try { history.replaceState(null, '', `/admin/${view}${qs ? '?' + qs : ''}`); } catch (e) { /* 忽略 */ }
    }
    function nqRestoreFilters(view, search) {
        const f = NQ_FILTERS[view];
        if (!f) return;
        Object.keys(f).forEach(k => { f[k] = ''; });
        new URLSearchParams(search == null ? location.search : search).forEach((v, k) => {
            if (!(k in f)) return;
            if (NQ_FILTER_OK[k] && NQ_FILTER_OK[k].indexOf(v) < 0) return;
            f[k] = v.slice(0, 60);
        });
    }

    /* ------------------------------ 首页 Banner ------------------------------ */

    function nqBanTitle(b) {
        return `${esc(b.titlePrefix)}${b.highlightOnNewLine ? '<br>' : ''}<em>${esc(b.titleHighlight)}</em>${b.titleLine2 ? '<br>' + esc(b.titleLine2) : ''}`;
    }
    function bindSort(box, done) {
        if (!box) return;
        let dragEl = null;
        box.querySelectorAll('.sort-item').forEach(it => {
            it.ondragstart = e => { dragEl = it; it.classList.add('dragging'); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; };
            it.ondragend = () => { it.classList.remove('dragging'); done([...box.querySelectorAll('.sort-item')].map(x => x.dataset.id)); };
            it.ondragover = e => {
                e.preventDefault();
                if (!dragEl || dragEl === it) return;
                const r = it.getBoundingClientRect();
                box.insertBefore(dragEl, (e.clientY - r.top) / r.height > 0.5 ? it.nextSibling : it);
            };
        });
    }
    function renderNqBan() {
        const list = nqBanners, online = list.filter(b => b.isOnline).length;
        $('nqBanCount').textContent = `共 ${list.length} / 3 张 · 展示中 ${online} 张 · 顺序即轮播顺序`;
        const add = $('nqBanAdd');
        add.disabled = list.length >= 3;
        add.title = list.length >= 3 ? '最多 3 张，先删除一张' : '';
        $('nqBanList').innerHTML = list.length ? list.map((b, i) => `
            <div class="sort-item" draggable="true" data-id="${esc(b.id)}">
              <span class="rank">${i + 1}</span>
              ${nqThumb(b.image, '', '配图')}
              <span class="copy">
                <b>${nqBanTitle(b)}</b>
                <span class="sub">${esc(b.desc)}</span>
                <span class="intent-tag">主按钮：${esc(b.primaryText)} → ${b.primaryAction === 'report' ? '领取最新报告' : b.primaryAction === 'latest-video' ? '「值得看见」最新一期（自动跟随）' : esc(b.primaryUrl)}</span>
                ${b.secondaryText ? `<span class="intent-tag">次按钮：${esc(b.secondaryText)} → ${esc(b.secondaryUrl)}</span>` : ''}
                ${(b.stats || []).length ? `<span class="intent-tag">数据锚点 ${b.stats.length} 组</span>` : ''}
                ${b.isOnline ? '' : '<span class="chip archived">未展示</span>'}
              </span>
              <button type="button" class="switch ${b.isOnline ? 'on' : ''}" data-action="toggle" data-type="banner" data-id="${esc(b.id)}" data-permission="nqoc-banner:update" title="展示 / 隐藏" aria-label="展示 / 隐藏"></button>
              <button type="button" data-action="edit" data-type="banner" data-id="${esc(b.id)}" data-permission="nqoc-banner:update">编辑</button>
              <button type="button" data-action="delete" data-type="banner" data-id="${esc(b.id)}" data-permission="nqoc-banner:delete">删除</button>
            </div>`).join('') : '<p class="empty-cell"><b>还没有 Banner</b>前台首屏会显示默认图，建议至少配置 1 张</p>';
        const box = $('nqBanList');
        nqApplyPerms(box);
        bindSort(box, ids => {
            const map = new Map(nqBanners.map(b => [String(b.id), b]));
            nqBanners = ids.map(id => map.get(id)).filter(Boolean);
            renderNqBan();
            json(`${API}/banners/sort`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ ids }) })
                .then(() => toast('轮播顺序已更新'))
                .catch(e => { toast(e.message); loadBanners(); });
        });
    }
    async function loadBanners() {
        try {
            const data = await json(`${API}/banners`, { headers: authHeaders() });
            nqBanners = Array.isArray(data) ? data : [];
            renderNqBan();
        } catch (e) {
            $('nqBanList').innerHTML = `<p class="empty-cell">${esc(e.message)}</p>`;
        }
    }

    /* ---------------------- 新质观点 / 案例研究（同构列表） ---------------------- */

    function renderNqPosts(t) {
        const T = NQ_TYPES[t], f = NQ_FILTERS[T.view], q = f.q.trim().toLowerCase();
        const rows = (nqPosts[t] || []).filter(a => (!f.status || a.status === f.status) &&
            (!q || `${a.title || ''}${a.author || ''}${a.source || ''}`.toLowerCase().includes(q)))
            .sort((a, b) => (Number(b.top) - Number(a.top)) ||
                String(b.publishDate || '').localeCompare(String(a.publishDate || '')) ||
                String(b.id).localeCompare(String(a.id)));
        $(T.rows).innerHTML = rows.length ? rows.map(a => `
            <tr>
              <td><button type="button" class="star ${a.top ? 'on' : ''}" data-action="top" data-type="${t}" data-id="${esc(a.id)}" data-permission="${T.view}:update" title="${a.top ? '取消置顶' : '置顶'}" aria-label="${a.top ? '取消置顶' : '置顶'}">★</button></td>
              <td>${nqThumb(a.cover, '', '封面')}</td>
              <td><div class="person">${a.status === 'published' ? '' : '<span style="opacity:.6">'}<b>${esc(a.title)}</b>${a.status === 'published' ? '' : '</span>'}
                  ${a.top ? '<span class="chip top">置顶</span>' : ''}</div>
                <div class="sub">${t === 'insight' && (a.tags || []).length ? a.tags.map(x => `<span class="intent-tag">${esc(x)}</span>`).join('') : (a.slug ? esc(T.path + a.slug) : '网址待生成')}</div></td>
              ${t === 'insight' ? `<td><div>${esc(a.author) || '—'}</div><div class="sub">${esc(a.source)}</div></td>` : ''}
              <td style="white-space:nowrap">${esc(a.publishDate)}</td>
              <td>${nqChip(a.status)}</td>
              <td><button type="button" class="switch ${a.status === 'published' ? 'on' : ''}" data-action="toggle" data-type="${t}" data-id="${esc(a.id)}" data-permission="${T.view}:update" title="发布 / 下架" aria-label="发布 / 下架"></button></td>
              <td style="white-space:nowrap">${nqOps(t, a, T.view)}</td>
            </tr>`).join('') : `<tr><td colspan="${T.cols}" class="empty-cell"><b>没有${T.name}</b>换个筛选条件，或新建一篇</td></tr>`;
        nqSyncFilterUi(T.view);
        nqApplyPerms($(T.rows).closest('table'));
    }
    async function loadPosts(t) {
        const T = NQ_TYPES[t];
        try {
            const data = await json(`${API}/${T.res}`, { headers: authHeaders() });
            nqPosts[t] = Array.isArray(data) ? data : [];
            renderNqPosts(t);
        } catch (e) {
            $(T.rows).innerHTML = `<tr><td colspan="${T.cols}" class="empty-cell">${esc(e.message)}</td></tr>`;
        }
    }

    /* ------------------------------ 值得看见 ------------------------------ */

    function renderNqVids() {
        const f = NQ_FILTERS['nqoc-videos'], q = f.q.trim().toLowerCase();
        const all = (nqVideos || []).slice().sort((a, b) =>
            String(b.publishDate || '').localeCompare(String(a.publishDate || '')) || String(b.id).localeCompare(String(a.id)));
        const latest = all.find(v => v.status === 'published');
        const rows = all.filter(v => (!f.status || v.status === f.status) &&
            (!q || `${v.episode || ''}${v.title || ''}${(v.guests || []).map(g => g.name).join('')}`.toLowerCase().includes(q)));
        $('nqVidRows').innerHTML = rows.length ? rows.map(v => `
            <tr>
              <td>${nqThumb(v.cover, '', '封面')}</td>
              <td><div class="person">${esc(v.episode)}</div></td>
              <td><div class="person">${v.status === 'published' ? '' : '<span style="opacity:.6">'}<b>${esc(v.title)}</b>${v.status === 'published' ? '' : '</span>'}
                  ${latest && latest.id === v.id ? '<span class="chip featured">列表页头条</span>' : ''}</div>
                <div class="sub">${v.slug ? esc(NQ_TYPES.video.path + v.slug) : '网址待生成'}</div></td>
              <td>${(v.guests || []).map(g => `<div>${esc(g.name)}</div><div class="sub">${esc([g.company, g.title].filter(Boolean).join(' · '))}</div>`).join('') || '<span class="sub">—</span>'}</td>
              <td>${v.videoUrl ? `<span class="chip published">已配置</span><div class="sub">${esc(v.duration)}</div>` : '<span class="chip draft">未配置</span>'}</td>
              <td style="white-space:nowrap">${esc(v.publishDate)}</td>
              <td>${nqChip(v.status)}</td>
              <td><button type="button" class="switch ${v.status === 'published' ? 'on' : ''}" data-action="toggle" data-type="video" data-id="${esc(v.id)}" data-permission="nqoc-videos:update" title="发布 / 下架" aria-label="发布 / 下架"></button></td>
              <td style="white-space:nowrap">${nqOps('video', v, 'nqoc-videos')}</td>
            </tr>`).join('') : '<tr><td colspan="9" class="empty-cell"><b>没有节目</b>换个筛选条件，或新建一期</td></tr>';
        nqSyncFilterUi('nqoc-videos');
        nqApplyPerms($('nqVidRows').closest('table'));
    }
    async function loadVideos() {
        try {
            const data = await json(`${API}/videos`, { headers: authHeaders() });
            nqVideos = Array.isArray(data) ? data : [];
            renderNqVids();
        } catch (e) {
            $('nqVidRows').innerHTML = `<tr><td colspan="9" class="empty-cell">${esc(e.message)}</td></tr>`;
        }
    }

    /* --------------------------- 报告领取记录（只读） --------------------------- */

    // 与后端一致的手机号归一化：去空格 / 横线等非数字
    const nqPhoneKey = v => String(v || '').replace(/\D/g, '') || String(v || '').trim();

    // 记录级邮件状态 6 档：与后端 leadMailCategory 同口径（列表筛选 / 导出 / 看板统一）
    // unsent 未发送 / queued 待发送 / unopened 已发送·未打开 / opened 已发送·已打开 / failed 发送失败 / uncertain 结果待核实
    const LEAD_MAIL_LABELS = { unsent: '未发送', queued: '待发送', unopened: '已发送·未打开', opened: '已发送·已打开', failed: '发送失败', uncertain: '结果待核实' };
    function nqLeadMailCategory(lead) {
        const status = lead && lead.mail && lead.mail.status;
        if (!status || status === 'cancelled') return 'unsent';
        if (status === 'pending' || status === 'sending') return 'queued';
        if (status === 'accepted') return Number(lead.reportOpenCount) >= 1 ? 'opened' : 'unopened';
        if (status === 'failed' || status === 'uncertain') return status;
        return 'unsent';
    }

    function nqLeadRows() {
        const f = NQ_FILTERS['nqoc-report-leads'], q = f.q.trim().toLowerCase(), days = +f.range || 0, dupOnly = f.dup === '1';
        const cutoff = days ? Date.now() - days * DAY : 0;
        return (nqLeads || []).filter(l => (!f.mailStatus || nqLeadMailCategory(l) === f.mailStatus) && (!cutoff || new Date(l.createdAt).getTime() >= cutoff) &&
            (!dupOnly || !!nqLeadDup[nqPhoneKey(l.phone)]) &&
            (!q || [l.name, l.company, l.phone, l.email, l.position].map(v => String(v || '')).join(' ').toLowerCase().includes(q)))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    function mailFailure(value) {
        const labels = { EAUTH: '发件邮箱认证失败，请联系管理员', EDNS: '邮件服务器地址解析失败', ECONNREFUSED: '无法连接邮件服务器', ETIMEDOUT: '邮件连接超时，请核实发送结果', ECONNECTION: '邮件连接中断，请核实发送结果', ESOCKET: '邮件连接异常，请核实发送结果', EENVELOPE: '邮件服务拒绝收件地址', REPORT_CHANGED: '报告版本已更新，请重新确认后发送' };
        const raw = String(value || ''), code = raw.split(' ')[0];
        return labels[code] ? `${labels[code]}（${raw}）` : raw;
    }
    function nqPhoneDisplay(value) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.length === 11 ? `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}` : String(value || '');
    }
    function nqMailTone(cat) {
        return cat === 'opened' ? 'ok' : cat === 'failed' ? 'err' : cat === 'uncertain' ? 'warn' : (cat === 'queued' || cat === 'unopened') ? 'info' : 'idle';
    }
    // 列表只展示记录级邮件状态与打开情况；发送、发送记录、删除都收进详情页
    function nqMailStatus(lead) {
        const cat = nqLeadMailCategory(lead);
        const mail = lead.mail || {};
        const opens = Number(lead.reportOpenCount) || 0;
        const openLine = cat === 'opened' && Number.isFinite(lead.reportOpenCount)
            ? `<div class="sub">已打开 ${opens} 次${lead.lastReportOpenAt ? ` · 最近 ${shortDateTime(lead.lastReportOpenAt)}` : ''}</div>`
            : '';
        return `<div class="mail-head"><span class="chip ${nqMailTone(cat)}">${esc(LEAD_MAIL_LABELS[cat])}</span>${mail.acceptedAt ? `<span class="mail-time">${shortDateTime(mail.acceptedAt)}</span>` : ''}</div>${openLine}`;
    }
    // 回收站剩余天数：purgeAt 到期后由 MongoDB TTL 线程物理清除
    function nqLeadBinDays(lead) {
        if (!lead.purgeAt) return 0;
        return Math.max(0, Math.ceil((new Date(lead.purgeAt).getTime() - Date.now()) / DAY));
    }
    function nqLeadDupChip(lead) {
        const dup = nqLeadDup[nqPhoneKey(lead.phone)];
        return dup ? ` <span class="chip featured">重复 ${dup} 次</span>` : '';
    }
    // 详情页链接：把列表当前的筛选条件带进 ?from=，返回时原样恢复
    function nqLeadDetailHref(id) {
        const inDetail = /\/admin\/nqoc-report-leads\//.test(location.pathname);
        const from = inDetail ? (nqLeadDetailState?.from || '') : (location.search || '');
        return `/admin/nqoc-report-leads/${encodeURIComponent(id)}${from ? '?from=' + encodeURIComponent(from) : ''}`;
    }
    function leadDetailFromParam() {
        return (new URLSearchParams(location.search).get('from') || '').slice(0, 300);
    }
    function leadListViewUrl() {
        const f = NQ_FILTERS['nqoc-report-leads'];
        const qs = Object.keys(f).filter(k => f[k]).map(k => k + '=' + encodeURIComponent(f[k])).join('&');
        return `/admin/nqoc-report-leads${qs ? '?' + qs : ''}`;
    }
    // 列表可能已被筛选或切换回收站，动作需回退到详情页缓存的记录
    function nqLeadById(id) {
        return (nqLeads || []).find(l => String(l.id) === String(id))
            || (nqLeadDetailState && String(nqLeadDetailState.lead?.id) === String(id) ? nqLeadDetailState.lead : null);
    }
    async function openLeadDetail(id, options = {}) {
        const from = options.from != null ? options.from : (location.search || '');
        nqLeadDetailState = { id: String(id), from, lead: null };
        const section = document.querySelector('[data-view="nqoc-report-leads"]');
        if (section) section.classList.add('lead-detail-open');
        const box = $('nqLeadDetail');
        if (box) { box.hidden = false; box.innerHTML = '<p class="sub">正在加载记录…</p>'; }
        try {
            const url = `/admin/nqoc-report-leads/${encodeURIComponent(id)}${from ? '?from=' + encodeURIComponent(from) : ''}`;
            if (options.replace) history.replaceState(null, '', url);
            else if (options.push !== false) history.pushState(null, '', url);
        } catch (e) { /* 忽略 */ }
        await loadLeadDetail();
        if (box) box.scrollIntoView({ block: 'start' });
    }
    async function loadLeadDetail() {
        const state = nqLeadDetailState;
        if (!state) return;
        try {
            const data = await json(`${API}/report-leads/${encodeURIComponent(state.id)}`, { headers: authHeaders() });
            if (nqLeadDetailState !== state) return;
            state.lead = data.lead;
            await renderLeadDetail();
        } catch (e) {
            if (nqLeadDetailState !== state) return;
            const box = $('nqLeadDetail');
            if (box) box.innerHTML = `<p class="empty-cell">${esc(e.message)}</p><p><button type="button" class="btn-sm" data-action="lead-detail-back">返回列表</button></p>`;
        }
    }
    async function renderLeadDetail() {
        const state = nqLeadDetailState, lead = state?.lead, box = $('nqLeadDetail');
        if (!state || !lead || !box) return;
        const mail = lead.mail || {}, inBin = !!lead.deletedAt;
        const mailCat = nqLeadMailCategory(lead);
        const dup = nqLeadDup[nqPhoneKey(lead.phone)];
        const summary = lead.mailSummary || {};
        const opens = Number(lead.reportOpenCount) || 0;
        const canResend = ['accepted', 'failed'].includes(mail.status);
        const openText = Number.isFinite(lead.reportOpenCount)
            ? (opens ? `${opens} 次${lead.firstReportOpenAt ? ` · 首次 ${mailDate(lead.firstReportOpenAt)}` : ''}${lead.lastReportOpenAt ? ` · 最近 ${mailDate(lead.lastReportOpenAt)}` : ''}` : '尚未打开')
            : '无统计数据';
        box.innerHTML = `
            <div class="lead-detail-head">
              <button type="button" class="btn-sm" data-action="lead-detail-back">← 返回列表</button>
              <div class="lead-detail-title">
                <h2>${esc(lead.name)}${dup ? ` <span class="chip featured">重复 ${dup} 次</span>` : ''}${inBin ? ' <span class="chip err">回收站</span>' : ''}</h2>
                <p class="sub mono">${esc(lead.email)}</p>
              </div>
              ${inBin ? '' : `<button type="button" class="primary" data-action="send-lead-email" data-id="${esc(lead.id)}" data-permission="${canResend ? 'nqoc-report-leads:resend' : 'nqoc-report-leads:send'}">${mail.status ? '再次发送报告' : '发送报告'}</button>`}
            </div>
            <section class="lead-detail-card">
              <h3>领取信息</h3>
              <dl class="lead-detail-meta">
                <dt>姓名</dt><dd>${esc(lead.name)}</dd>
                <dt>手机号码</dt><dd class="mono">${esc(nqPhoneDisplay(lead.phone))}</dd>
                <dt>公司 / 职位</dt><dd>${esc(lead.company)} · ${esc(lead.position)}</dd>
                <dt>邮箱</dt><dd>${esc(lead.email)}</dd>
                <dt>领取的报告</dt><dd>${esc(lead.reportTitle || '—')}</dd>
                <dt>提交页面</dt><dd>${esc(lead.sourcePage || '—')}</dd>
                <dt>领取次数</dt><dd>${Number(lead.downloadCount) || 0} 次</dd>
                <dt>最近领取</dt><dd>${lead.lastDownloadedAt ? mailDate(lead.lastDownloadedAt) : '—'}</dd>
                <dt>提交时间</dt><dd>${mailDate(lead.createdAt)}</dd>
              </dl>
            </section>
            <section class="lead-detail-card">
              <h3>邮件投递</h3>
              <dl class="lead-detail-meta">
                <dt>邮件状态</dt><dd><span class="chip ${nqMailTone(mailCat)}">${esc(LEAD_MAIL_LABELS[mailCat])}</span></dd>
                <dt>最近接收</dt><dd>${mail.acceptedAt ? mailDate(mail.acceptedAt) : '—'}</dd>
                <dt>累计接收</dt><dd>${Number(summary.acceptedCount) || 0} 次${summary.lastAcceptedAt ? ` · 最近 ${mailDate(summary.lastAcceptedAt)}` : ''}</dd>
                <dt>报告打开</dt><dd>${openText}</dd>
                ${mail.status === 'pending' && mail.nextAttemptAt ? `<dt>预计发送</dt><dd>${mailDate(mail.nextAttemptAt)}</dd>` : ''}
                ${mail.attempts ? `<dt>发送尝试</dt><dd>${Number(mail.attempts)} 次</dd>` : ''}
                ${mail.linkExpiresAt ? `<dt>链接到期</dt><dd>${mailDate(mail.linkExpiresAt)}</dd>` : ''}
                ${mail.lastError ? `<dt>失败原因</dt><dd class="lead-detail-error">${esc(mailFailure(mail.lastError))}</dd>` : ''}
                ${mail.messageId ? `<dt>邮件编号</dt><dd class="mono">${esc(mail.messageId)}</dd>` : ''}
              </dl>
            </section>
            <section class="lead-detail-card">
              <h3>发送记录</h3>
              <div id="leadDetailHistory" class="lead-detail-history"><p class="sub">正在加载…</p></div>
              <p class="lead-detail-card-foot"><button type="button" class="btn-sm" data-action="mail-history" data-id="${esc(lead.id)}">查看全部发送记录</button></p>
            </section>
            ${inBin ? `<section class="lead-detail-card">
              <h3>回收站信息</h3>
              <dl class="lead-detail-meta">
                <dt>删除时间</dt><dd>${lead.deletedAt ? mailDate(lead.deletedAt) : '—'}</dd>
                <dt>删除人</dt><dd>${esc(lead.deletedBy || '—')}</dd>
                <dt>剩余天数</dt><dd><span class="chip ${nqLeadBinDays(lead) <= 7 ? 'err' : 'idle'}">${nqLeadBinDays(lead)} 天</span></dd>
                <dt>到期时间</dt><dd>${lead.purgeAt ? mailDate(lead.purgeAt) : '—'}</dd>
              </dl>
            </section>` : ''}
            <section class="lead-detail-danger">
              <div>
                <h3>${inBin ? '彻底删除' : '移入回收站'}</h3>
                <p class="sub">${inBin ? '彻底删除后无法恢复，会立即从回收站移除。' : '移入回收站后 30 天内可恢复，到期自动彻底删除；统计与导出不再计入。'}</p>
              </div>
              <div class="lead-detail-danger-actions">${inBin
                ? `<button type="button" class="btn-sm" data-action="restore-lead" data-id="${esc(lead.id)}" data-permission="nqoc-report-leads:restore">恢复记录</button><button type="button" class="btn-sm danger" data-action="purge-lead" data-id="${esc(lead.id)}" data-permission="nqoc-report-leads:purge">彻底删除</button>`
                : `<button type="button" class="btn-sm danger" data-action="delete-lead" data-id="${esc(lead.id)}" data-permission="nqoc-report-leads:delete">移入回收站</button>`}</div>
            </section>`;
        nqApplyPerms(box);
        loadLeadDetailHistory(state);
    }
    async function loadLeadDetailHistory(state) {
        const box = $('leadDetailHistory');
        if (!box) return;
        try {
            const data = await json(`${API}/report-leads/${encodeURIComponent(state.id)}/email-history?page=1`, { headers: authHeaders() });
            if (nqLeadDetailState !== state) return;
            box.innerHTML = reportHistoryHtml(data, { detail: true });
        } catch (e) {
            if (nqLeadDetailState !== state) return;
            box.textContent = e.message;
        }
    }
    function closeLeadDetail() {
        const state = nqLeadDetailState;
        nqLeadDetailState = null;
        const section = document.querySelector('[data-view="nqoc-report-leads"]');
        if (section) section.classList.remove('lead-detail-open');
        const box = $('nqLeadDetail');
        if (box) { box.hidden = true; box.innerHTML = ''; }
        if (state?.from) nqRestoreFilters('nqoc-report-leads', state.from);
        return state?.from || '';
    }
    // 关详情回列表：同时把 URL 换回列表地址，避免刷新详情页时记录已不存在
    async function leaveLeadDetail() {
        closeLeadDetail();
        try { history.replaceState(null, '', leadListViewUrl()); } catch (e) { /* 忽略 */ }
        nqSyncFilterUi('nqoc-report-leads');
        await loadLeads();
        window.scrollTo({ top: 0 });
    }
    function renderNqLeads() {
        const f = NQ_FILTERS['nqoc-report-leads'], inBin = f.bin === '1';
        const rows = nqLeadRows(), total = nqLeads.length, now = Date.now();
        if (inBin) reportMailSelected.clear();
        if ($('reportBatchControls')) $('reportBatchControls').hidden = inBin || !hasPermission('nqoc-report-leads:batch-send');
        updateBatchSelection();
        const between = (from, to) => nqLeads.filter(l => { const t = now - new Date(l.createdAt).getTime(); return t >= from && t < to; }).length;
        $('nqLTd').textContent = nqLeadStats.today;
        $('nqLYd').textContent = between(DAY, 2 * DAY);
        $('nqL7').textContent = nqLeadStats.week7;
        $('nqL30').textContent = between(0, 30 * DAY);
        $('nqLAll').textContent = nqLeadStats.all;
        $('nqLCo').textContent = nqLeadStats.companies;
        const up = nqLeadStats.uniquePhones || {};
        $('nqLUniq').textContent = up.all || 0;
        // 报告打开率看板：已发送 = 邮件服务已接收；已打开 = 送达且打开过 ≥1 次
        const delivered = Number(nqLeadStats.delivered) || 0, opened = Number(nqLeadStats.opened) || 0;
        if ($('nqLOpen')) $('nqLOpen').textContent = delivered ? `${Math.round(opened / delivered * 100)}%` : '—';
        if ($('nqLOpenSub')) $('nqLOpenSub').textContent = delivered ? `已发送 ${delivered} 条 · 打开 ${opened} 条` : '暂无已发送记录';
        const badge = $('nqLeadBadge');
        if (badge) badge.textContent = nqLeadStats.today;

        const table = $('nqLeadRows').closest('table');
        if (table) {
            table.querySelectorAll('[data-bin-head]').forEach(tr => { tr.hidden = (tr.dataset.binHead === '1') !== inBin; });
            const exp = table.closest('.view')?.querySelector('[data-action="export"]');
            // 回收站不支持导出（导出接口只输出正常记录），且沿用导出权限
            if (exp) exp.hidden = inBin || !hasPermission('nqoc-report-leads:export');
        }

        $('nqLeadRows').innerHTML = rows.length ? rows.map(l => inBin ? `
            <tr>
              <td><div class="person"><a class="lead-name" href="${nqLeadDetailHref(l.id)}">${esc(l.name)}</a>${nqLeadDupChip(l)}</div></td>
              <td class="mono">${esc(nqPhoneDisplay(l.phone))}</td>
              <td><div>${esc(l.company)}</div><div class="sub">${esc(l.position)}</div></td>
              <td><div class="ellip" title="${esc(l.email)}">${esc(l.email)}</div></td>
              <td><div>${l.deletedAt ? ago(l.deletedAt) : '—'}</div><div class="sub">${l.deletedAt ? shortDateTime(l.deletedAt) : ''}</div></td>
              <td><span class="chip ${nqLeadBinDays(l) <= 7 ? 'err' : 'idle'}">${nqLeadBinDays(l)} 天</span></td>
            </tr>` : `
            <tr>
              <td><div class="person">${hasPermission('nqoc-report-leads:batch-send') ? `<input class="report-mail-selection" type="checkbox" data-mail-select="${esc(l.id)}" aria-label="选择 ${esc(l.name)} 的报告申请" ${reportMailSelected.has(l.id) ? 'checked' : ''}>` : ''}<a class="lead-name" href="${nqLeadDetailHref(l.id)}">${esc(l.name)}</a>${nqLeadDupChip(l)}</div></td>
              <td class="mono">${esc(nqPhoneDisplay(l.phone))}</td>
              <td><div>${esc(l.company)}</div><div class="sub">${esc(l.position)}</div></td>
              <td><div class="ellip" title="${esc(l.email)}">${esc(l.email)}</div></td>
              <td>${nqMailStatus(l)}</td>
              <td><div>${ago(l.createdAt)}</div><div class="sub">${shortDateTime(l.createdAt)}</div></td>
            </tr>`).join('') : `<tr><td colspan="6" class="empty-cell"><b>${inBin ? '回收站是空的' : '没有符合条件的记录'}</b><p>${inBin ? '删除的记录会在这里保留 30 天' : '换个筛选条件，或清空当前筛选'}</p>${inBin ? '' : '<button type="button" class="btn-sm" data-action="reset-lead-filters">清空筛选</button>'}</td></tr>`;
        $('nqLeadCount').textContent = inBin
            ? `回收站共 ${rows.length} 条记录，到期后自动彻底删除`
            : `共 ${rows.length} 条记录${rows.length !== total ? `（总计 ${total} 条）` : ''}`;
        nqSyncFilterUi('nqoc-report-leads');
        nqApplyPerms($('nqLeadRows').closest('table'));
    }
    async function loadLeads() {
        try {
            const qs = new URLSearchParams();
            if (NQ_FILTERS['nqoc-report-leads'].bin) qs.set('bin', NQ_FILTERS['nqoc-report-leads'].bin);
            const data = await json(`${API}/report-leads${qs.toString() ? '?' + qs : ''}`, { headers: authHeaders() });
            nqLeads = Array.isArray(data.leads) ? data.leads : [];
            nqLeadStats = Object.assign({ today: 0, week7: 0, all: 0, companies: 0, uniquePhones: {}, delivered: 0, opened: 0 }, data.stats || {});
            nqLeadDup = (data.stats && data.stats.duplicatePhones) || {};
            renderNqLeads();
        } catch (e) {
            $('nqLeadRows').innerHTML = `<tr><td colspan="6" class="empty-cell">${esc(e.message)}</td></tr>`;
        }
    }
    async function nqExportLeads() {
        if (!nqLeadRows().length) { toast('当前筛选下没有记录可导出'); return; }
        const f = NQ_FILTERS['nqoc-report-leads'];
        const qs = new URLSearchParams();
        if (f.q.trim()) qs.set('q', f.q.trim());
        if (f.range) qs.set('range', f.range);
        if (f.dup) qs.set('dup', f.dup);
        if (f.mailStatus) qs.set('mailStatus', f.mailStatus);
        try {
            const response = await fetch(`${API}/report-leads/export${qs.toString() ? '?' + qs : ''}`, { headers: authHeaders() });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw Error(data.error || '导出失败');
            }
            const cd = response.headers.get('content-disposition') || '';
            const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) || /filename="?([^";]+)"?/i.exec(cd);
            const name = m ? decodeURIComponent(m[1]) : `新质组织_报告领取记录_${todayStr()}.xlsx`;
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = name;
            link.click();
            URL.revokeObjectURL(link.href);
            toast('已导出 Excel');
        } catch (e) {
            toast(e.message);
        }
    }

    /* ============================== 弹窗 #editorModal ============================== */
    /* 用于 Banner 与节目（观点 / 案例走创作工作台）。 */

    const NQ_IMG_HINT = 'JPG / PNG / WebP，≤ 2MB';
    const NQ_PERSON = [['name', '姓名', 12], ['title', '职位，如 组织与战略管理系教授', 30], ['company', '机构，如 北京大学光华管理学院', 30]];
    const NQ_FIELDS = {
        banner: [
            { k: 'titlePrefix', label: '标题前段', hint: '白色字，可留空', max: 14, ph: '中国', half: 1 },
            { k: 'titleHighlight', label: '标题高亮词', req: 1, hint: '渐变色字', max: 14, ph: '新质组织', half: 1 },
            { k: 'highlightOnNewLine', label: '高亮词位置', type: 'select', num: 1, options: [['0', '紧跟在前段后面'], ['1', '另起一行']], half: 1 },
            { k: 'titleLine2', label: '标题第二行', hint: '可留空', max: 14, ph: '研究项目', half: 1 },
            { k: 'desc', label: '描述', type: 'textarea', rows: 2, max: 70, count: 1 },
            { tip: '按钮' },
            { k: 'primaryText', label: '主按钮文字', req: 1, max: 8, ph: '领取报告', half: 1 },
            { k: 'primaryAction', label: '主按钮点击后', type: 'select', options: [['link', '跳转到链接'], ['latest-video', '跳转到「值得看见」最新一期（自动跟随）'], ['report', '弹出领取表单（领取最新报告）']], half: 1 },
            { k: 'primaryUrl', label: '主按钮链接', req: 1, hint: '站内以 /nqoc 开头；站外需 https://', ph: '/nqoc/whitepaper', showIf: o => o.primaryAction === 'link' },
            { k: 'secondaryText', label: '次按钮文字', hint: '留空则不显示次按钮', max: 8, half: 1 },
            { k: 'secondaryUrl', label: '次按钮链接', ph: '/nqoc/…', half: 1 },
            { tip: '配图' },
            { k: 'image', label: '右侧配图', req: 1, type: 'image', hint: NQ_IMG_HINT + '；建议宽 ≥ 1200px' },
            { k: 'imageAlt', label: '图片说明', hint: '给搜索引擎和读屏软件看，一句话描述画面', max: 60 },
            { tip: '数据锚点（可选，最多 3 组；显示在按钮下方，如「5大 / 维度组织模型」）' },
            { k: 'stats', type: 'rows', n: 3, cols: [['value', '数字，如 50+', 6], ['label', '说明，如 智库专家', 14]] },
            { k: 'isOnline', label: '展示状态', type: 'select', num: 1, options: [['1', '展示 — 参与轮播'], ['0', '隐藏 — 暂不轮播']] }
        ],
        video: [
            { k: 'episode', label: '期数', req: 1, max: 4, ph: 'E01', half: 1 },
            { k: 'publishDate', label: '发布日期', type: 'date', hint: '最新一期为列表页头条', half: 1 },
            { k: 'title', label: '标题', req: 1, max: 60, count: 1 },
            { k: 'summary', label: '节目简介', hint: '显示在播放器下方和列表卡片上', type: 'textarea', rows: 3, max: 300, count: 1 },
            { tip: '视频与封面' },
            { k: 'videoUrl', label: '视频文件', req: 1, type: 'video', hint: 'MP4 / MOV / WebM，≤ 3GB；浏览器直传对象存储 nqoc/zdkj/' },
            { k: 'duration', label: '时长', hint: '格式 mm:ss 或 h:mm:ss，可留空', ph: 'mm:ss', max: 8 },
            { k: 'cover', label: '封面图', req: 1, type: 'image', hint: '横版 16:9，建议 1280×720；' + NQ_IMG_HINT },
            { tip: '对谈嘉宾（至少 1 位，最多 2 位；显示在播放器右侧）' },
            { k: 'guests', type: 'rows', n: 2, cols: NQ_PERSON },
            { tip: '主持人' },
            { k: 'host', type: 'rows', n: 1, single: 1, cols: NQ_PERSON },
            { k: 'slug', label: '网址别名', type: 'slug', half: 1 },
            { k: 'status', label: '状态', hint: '无需审核', type: 'select', options: NQ_STATUS_OPTS, half: 1 }
        ]
    };
    const NQ_NEW = {
        banner: () => ({
            titlePrefix: '', titleHighlight: '', highlightOnNewLine: 0, titleLine2: '', desc: '',
            primaryText: '', primaryAction: 'link', primaryUrl: '', secondaryText: '', secondaryUrl: '',
            image: '', imageAlt: '', isOnline: 1, stats: []
        }),
        video: () => ({
            slug: '', episode: nqNextEpisode(), title: '', summary: '', cover: '', videoUrl: '', duration: '',
            guests: [], host: { name: '高燕', title: '副总裁、新质组织研究中心主任', company: '瑞华智策' },
            publishDate: todayStr(), status: 'draft', slugLocked: false
        })
    };

    function nqFieldHtml(f, o) {
        if (f.tip) return `<p class="config-tip">${esc(f.tip)}</p>`;
        const v = o[f.k];
        const lab = f.label
            ? `<label>${esc(f.label)}${f.req ? ' <b class="required">*</b>' : ''}${f.hint ? ` <span class="hint">${esc(f.hint)}</span>` : ''}${f.count ? ` <span class="count" data-count="${f.k}"></span>` : ''}</label>`
            : '';
        const at = `name="${f.k}"${f.max ? ` maxlength="${f.max}"` : ''}${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}`;
        let c;
        if (f.type === 'textarea') c = `<textarea ${at} rows="${f.rows || 3}">${esc(v)}</textarea>`;
        else if (f.type === 'select') c = `<select name="${f.k}">${f.options.map(p => `<option value="${p[0]}"${String(v) === p[0] ? ' selected' : ''}>${esc(p[1])}</option>`).join('')}</select>`;
        else if (f.type === 'date') c = `<input type="date" name="${f.k}" value="${esc(v)}">`;
        else if (f.type === 'image') c = `<div class="upload-row"><span data-thumb="${f.k}">${nqThumb(v, 'lg', '已上传')}</span><input type="file" name="${f.k}" data-upload="image" accept="image/png,image/jpeg,image/webp"></div>`;
        else if (f.type === 'video') c = `<div class="upload-row"><input type="file" name="${f.k}" data-upload="video" accept="video/mp4,video/quicktime,video/webm,video/x-m4v"></div><div data-video-box="${f.k}">${nqVideoBox(v)}</div>`;
        else if (f.type === 'rows') {
            const list = f.single ? [v || {}] : (v || []);
            c = `<div class="${f.cols.length === 2 ? 'grid2' : 'row3'}">${Array.from({ length: f.n }, (_, i) => f.cols.map(col =>
                `<input name="${f.k}.${i}.${col[0]}" value="${esc((list[i] || {})[col[0]])}" maxlength="${col[2]}" placeholder="${esc(col[1])}">`).join('')).join('')}</div>`;
        }
        else if (f.type === 'slug') c = `<input name="slug" value="${esc(v)}" maxlength="80" placeholder="留空自动生成"${o.slugLocked ? ' disabled' : ''}><span class="sub">${o.slugLocked ? '已发布过，为避免旧链接失效不可再改' : '小写英文、数字、连字符'}</span>`;
        else c = `<input ${at} value="${esc(v)}">`;
        return `<div class="config-field" data-field="${f.k}">${lab}${c}</div>`;
    }

    function openModalEditor(type, id) {
        if (type === 'banner' && !id && nqBanners.length >= 3) { toast('最多 3 张，先删除一张'); return; }
        const o = id ? nqFind(type, id) : NQ_NEW[type]();
        if (!o) { toast('数据已过期，请刷新后重试'); return; }
        nqEd = { type, id: id ? String(id) : null, o };
        nqPend = {};
        let html = '', half = [];
        const flush = () => { if (half.length) { html += `<div class="grid2">${half.join('')}</div>`; half = []; } };
        NQ_FIELDS[type].forEach(f => { if (f.half) half.push(nqFieldHtml(f, o)); else { flush(); html += nqFieldHtml(f, o); } });
        flush();
        $('editorTitle').textContent = (id ? '编辑' : '新建') + (type === 'video' ? '节目' : ' Banner');
        $('editorForm').innerHTML = html;
        nqEditorSync();
        const modal = $('editorModal');
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => { const el = $('editorForm').querySelector('input:not([type=file]):not([disabled]),textarea'); if (el) el.focus(); }, 60);
    }
    function closeModalEditor() {
        $('editorModal').classList.remove('show');
        $('editorModal').setAttribute('aria-hidden', 'true');
        nqEd = null;
        nqPend = {};
    }
    function nqEditorRead() {
        const F = $('editorForm');
        const val = n => { const e = F.elements[n]; return e ? String(e.value).trim() : ''; };
        const o = {};
        NQ_FIELDS[nqEd.type].forEach(f => {
            if (f.tip) return;
            if (f.type === 'image' || f.type === 'video') o[f.k] = nqPend[f.k] || nqEd.o[f.k] || '';
            else if (f.type === 'rows') {
                const rows = Array.from({ length: f.n }, (_, i) => { const r = {}; f.cols.forEach(c => { r[c[0]] = val(`${f.k}.${i}.${c[0]}`); }); return r; });
                o[f.k] = f.single ? rows[0] : rows.filter(r => r[f.cols[0][0]] || r[f.cols[1][0]]);
            }
            else if (f.type === 'slug') o.slug = nqEd.o.slugLocked ? (nqEd.o.slug || '') : val('slug');
            else o[f.k] = f.num ? +val(f.k) : val(f.k);
        });
        return o;
    }
    function nqEditorSync() {
        if (!nqEd) return;
        const F = $('editorForm'), cur = nqEditorRead();
        NQ_FIELDS[nqEd.type].forEach(f => {
            if (f.showIf) { const el = F.querySelector(`[data-field="${f.k}"]`); if (el) el.hidden = !f.showIf(cur); }
            if (f.count) { const c = F.querySelector(`[data-count="${f.k}"]`); if (c && F.elements[f.k]) c.textContent = F.elements[f.k].value.length + ' / ' + f.max; }
        });
    }
    function nqFmtDur(s) {
        s = Math.round(s);
        const p = n => String(n).padStart(2, '0'), h = Math.floor(s / 3600);
        return (h ? h + ':' : '') + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60);
    }
    function nqPickFile(inp, done) {
        const file = inp.files && inp.files[0];
        if (!file) return;
        if (!/^image\/(png|jpe?g|webp)$/.test(file.type || '')) { toast('只支持 JPG / PNG / WebP 图片'); inp.value = ''; return; }
        if (file.size > 2 * 1024 * 1024) { toast('图片超过 2MB，先压缩一下'); inp.value = ''; return; }
        const fd = new FormData();
        fd.append('file', file);
        fetch('/api/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') }, body: fd })
            .then(async r => {
                const d = await r.json().catch(() => ({}));
                if (!r.ok || d.error) throw Error(d.error || ('上传失败 (HTTP ' + r.status + ')'));
                done(d.url || '');
            })
            .catch(e => { toast(e.message); inp.value = ''; });
    }
    function nqPickVideo(inp, done) {
        const file = inp.files && inp.files[0];
        if (!file) return;
        if (!/\.(mp4|m4v|mov|webm)$/i.test(file.name || '')) { toast('只支持 MP4 / MOV / WebM 视频'); inp.value = ''; return; }
        const MAX = 3 * 1024 * 1024 * 1024;
        if (file.size > MAX) { toast('视频超过 3GB，请先压缩后再上传'); inp.value = ''; return; }
        const key = inp.name;
        const box = document.querySelector(`#editorForm [data-video-box="${key}"]`);
        const setBox = html => { if (box) box.innerHTML = html; };
        const mb = (file.size / 1024 / 1024).toFixed(1);
        const tip = pct => `<div class="sub">正在上传 ${esc(file.name)}（${mb}MB）…${pct == null ? '' : ' ' + pct + '%'}</div>`;
        const fail = msg => { inp.disabled = false; setBox(nqVideoBox('')); inp.value = ''; toast(msg); };
        const ok = url => { inp.disabled = false; setBox(nqVideoBox(url)); done(url); };
        const tk = sessionStorage.getItem('token');
        inp.disabled = true;
        setBox(`<div class="sub">正在获取上传地址…</div>`);

        // 回退：直传被浏览器拦截（多为 TOS 未配置 CORS）时，退回 Node 中转上传
        function legacyUpload() {
            setBox(tip(null));
            const fd = new FormData();
            fd.append('file', file);
            const x = new XMLHttpRequest();
            x.open('POST', '/api/upload/nqoc-video');
            if (tk) x.setRequestHeader('Authorization', 'Bearer ' + tk);
            x.upload.onprogress = e => { if (e.lengthComputable) setBox(tip(Math.min(100, Math.round(e.loaded / e.total * 100)))); };
            x.onload = () => {
                let d = {};
                try { d = JSON.parse(x.responseText || '{}'); } catch (e) { d = {}; }
                if (x.status >= 200 && x.status < 300 && d.url) return ok(d.url);
                fail(d.error || ('上传失败 (HTTP ' + x.status + ')'));
            };
            x.onerror = () => fail('网络中断，视频上传失败，请重试');
            x.send(fd);
        }

        // 直传：先向服务端要预签名 PUT 地址，再由浏览器直接传到 TOS，视频流不经过 Node
        fetch('/api/upload/nqoc-video/presign', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, tk ? { Authorization: 'Bearer ' + tk } : {}),
            body: JSON.stringify({ filename: file.name, contentType: file.type })
        }).then(async r => {
            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d.uploadUrl) throw Error(d.error || ('获取上传地址失败 (HTTP ' + r.status + ')'));
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', d.uploadUrl);
            // Content-Type 已写入签名，必须与签名一致
            xhr.setRequestHeader('Content-Type', d.contentType || file.type || 'video/mp4');
            xhr.upload.onprogress = e => { if (e.lengthComputable) setBox(tip(Math.min(100, Math.round(e.loaded / e.total * 100)))); };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) return ok(d.url);
                fail('上传失败 (HTTP ' + xhr.status + ')');
            };
            xhr.onerror = () => { setBox(nqVideoBox('')); legacyUpload(); };
            setBox(tip(0));
            xhr.send(file);
        }).catch(e => fail(e.message || '获取上传地址失败，请稍后重试'));
    }
    async function saveModalEditor() {
        if (!nqEd) return;
        const type = nqEd.type, id = nqEd.id, T = NQ_TYPES[type];
        const payload = nqEditorRead();
        const url = id ? `${API}/${T.res}/${id}` : `${API}/${T.res}`;
        try {
            await json(url, { method: id ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
            closeModalEditor();
            if (type === 'banner') await loadBanners(); else await loadVideos();
            toast(type === 'banner'
                ? (id ? 'Banner 已保存' : 'Banner 已新增')
                : (payload.status === 'published' ? '已保存并发布，前台立即可见' : payload.status === 'archived' ? '已保存（下架状态）' : '已存为草稿'));
        } catch (e) {
            toast(e.message);
        }
    }

    /* ============================== 视图路由 ============================== */

    function nqRenderView(view) {
        ({ 'nqoc-banner': renderNqBan, 'nqoc-insights': () => renderNqPosts('insight'), 'nqoc-cases': () => renderNqPosts('case'), 'nqoc-videos': renderNqVids, 'nqoc-report-leads': renderNqLeads })[view]();
    }

    window.nqocLoad = function (view) {
        nqRestoreFilters(view);
        if (view === 'nqoc-banner') return loadBanners();
        if (view === 'nqoc-insights') return loadPosts('insight');
        if (view === 'nqoc-cases') return loadPosts('case');
        if (view === 'nqoc-videos') return loadVideos();
        if (view === 'nqoc-report-leads') return loadLeads();
    };
    // 创作工作台保存后回调（article-management.js 扩展 nqoc-insight / nqoc-case 时调用）
    window.nqocRefresh = function (kind) {
        if (kind === 'insight' || kind === 'nqoc-insight') return loadPosts('insight');
        if (kind === 'case' || kind === 'nqoc-case') return loadPosts('case');
        if (kind === 'video') return loadVideos();
    };

    /* ------------------------------ 事件委托 ------------------------------ */

    const MAIL_LABELS = { pending: '待发送', sending: '发送中', accepted: '邮件服务已接收', failed: '发送失败', uncertain: '结果待核实', cancelled: '已取消' };
    let reportMailDialog = null, reportMailPolling = false;
    function mailDate(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未知'; }
    function showReportMail(title, state) {
        reportMailDialog = { ...state, focus: document.activeElement };
        $('reportMailTitle').textContent = title;
        $('reportMailFeedback').textContent = '';
        $('reportMailBody').textContent = '正在加载…';
        $('reportMailConfirm').hidden = true;
        $('reportMailModal').classList.add('show');
        $('reportMailModal').setAttribute('aria-hidden', 'false');
        $('reportMailModal').querySelector('[data-mail-action="close"]').focus();
        return reportMailDialog;
    }
    function closeReportMail() {
        const previous = reportMailDialog?.focus;
        reportMailDialog = null;
        $('reportMailModal').classList.remove('show');
        $('reportMailModal').setAttribute('aria-hidden', 'true');
        if (previous?.isConnected) previous.focus();
    }
    async function openReportMail(id) {
        const state = showReportMail('确认发送报告', { id, mode: 'preview', requestKey: crypto.randomUUID(), busy: false });
        try {
            const p = await json(`${API}/report-leads/${encodeURIComponent(id)}/email-preview`, { headers: authHeaders() });
            if (reportMailDialog !== state) return;
            state.preview = p;
            $('reportMailTitle').textContent = p.hasPrevious ? '确认再次发送报告' : '确认发送报告';
            $('reportMailBody').innerHTML = `<dl class="report-mail-meta"><dt>申请人</dt><dd>${esc(p.name)}</dd><dt>收件邮箱</dt><dd>${esc(p.email)}</dd><dt>发件邮箱</dt><dd>${esc(p.sender || '—')}</dd><dt>报告</dt><dd>${esc(p.reportTitle)} · ${esc(p.reportVersion)}</dd><dt>链接有效期</dt><dd>发送时起 7 天</dd><dt>邮件主题</dt><dd>${esc(p.subject)}</dd></dl><pre>${esc(p.text)}</pre>${p.hasPrevious ? `<p class="report-mail-note">已有发送记录，邮件服务累计接收 ${p.acceptedCount} 次。再次发送可能使收件人收到重复邮件。</p>` : ''}<label>发送原因${p.hasPrevious ? '（必填）' : '（选填）'}<textarea id="reportMailReason" maxlength="300" ${p.hasPrevious ? 'required' : ''} placeholder="例如：收件人反馈未收到，已核实后补发"></textarea></label><label class="report-mail-check"><input type="checkbox" id="reportMailAcknowledged">我已核对收件邮箱和报告，确认发送</label><p class="report-mail-note">邮件服务接收不等于已进入收件箱；发送结果可在“发送记录”中查看。</p>`;
            const confirm = $('reportMailConfirm');
            confirm.textContent = p.hasPrevious ? '确认再次发送' : '确认发送';
            confirm.hidden = false;
            confirm.disabled = p.busy || !p.enabled || !hasPermission(p.hasPrevious ? 'nqoc-report-leads:resend' : 'nqoc-report-leads:send');
            if (p.busy) $('reportMailFeedback').textContent = '该记录已有待发或发送中任务';
            else if (!p.enabled) $('reportMailFeedback').textContent = '邮件服务尚未启用';
        } catch (e) { if (reportMailDialog === state) $('reportMailBody').textContent = e.message; }
    }
    async function submitReportMail() {
        if (reportMailDialog?.mode === 'campaign-import') return confirmCampaignImport(reportMailDialog);
        if (reportMailDialog?.mode === 'campaign-test') return confirmCampaignTest(reportMailDialog);
        if (reportMailDialog?.mode === 'batch-preview') return submitReportBatch();
        const state = reportMailDialog, p = state?.preview;
        if (!p || state.busy) return;
        const reason = $('reportMailReason').value.trim();
        if (p.hasPrevious && !reason) { $('reportMailFeedback').textContent = '请填写再次发送的原因'; $('reportMailReason').focus(); return; }
        if (!$('reportMailAcknowledged').checked) { $('reportMailFeedback').textContent = '请勾选确认收件邮箱和报告'; return; }
        state.busy = true; $('reportMailConfirm').disabled = true; $('reportMailFeedback').textContent = '正在加入发送队列…';
        try {
            await json(`${API}/report-leads/${encodeURIComponent(state.id)}/${p.hasPrevious ? 'resend-email' : 'send-email'}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ requestKey: state.requestKey, expectedEmail: p.email, reportSlug: p.reportSlug, reportVersion: p.reportVersion, reason }) });
            await loadLeads();
            if (nqLeadDetailState && String(nqLeadDetailState.id) === String(state.id)) await loadLeadDetail();
            if (reportMailDialog === state) await openReportHistory(state.id);
            toast('已加入发送队列，状态会自动更新');
        } catch (e) {
            if (reportMailDialog === state) { $('reportMailFeedback').textContent = e.message; $('reportMailConfirm').disabled = false; }
        } finally { state.busy = false; }
    }
    // 发送记录 HTML：弹窗与详情页共用。详情页只读，翻页与取消待发仍在弹窗里操作
    function reportHistoryHtml(data, opts = {}) {
        const detail = opts.detail === true;
        const head = `<p>共 ${data.total} 条发送记录 · 邮件服务接收 ${data.acceptedCount} 次 · 最近接收：${mailDate(data.lastAcceptedAt)}</p><p class="report-mail-note">每次人工发送单独留痕，自动重试归于同一条记录。历史导入只保留当时已有快照，未知信息不作推断。</p>`;
        const events = data.jobs.map(j => `<article class="report-mail-event"><h3>${esc(MAIL_LABELS[j.status] || j.status)} ${j.imported ? '· 历史导入' : ''}</h3><dl class="report-mail-meta"><dt>收件邮箱</dt><dd>${esc(j.recipient)}</dd><dt>报告</dt><dd>${esc(j.reportTitle)} · ${esc(j.reportVersion || '未知')}</dd><dt>触发方式</dt><dd>${({ auto: '自动发送', manual: '人工发送', batch: '批量补发', legacy: '旧状态快照' })[j.origin] || '未知'}</dd><dt>操作人</dt><dd>${esc(j.origin === 'auto' ? '系统' : j.requestedBy || '未知')}</dd><dt>请求时间</dt><dd>${mailDate(j.requestedAt)}</dd><dt>发送原因</dt><dd>${esc(j.reason || '—')}</dd>${j.batchId ? `<dt>所属批次</dt><dd>${!detail && hasPermission('nqoc-report-leads:batch-send') ? `<button type="button" data-mail-action="batch" data-batch-id="${esc(j.batchId)}">查看此批次</button>` : esc(j.batchId)}</dd>` : ''}<dt>服务接收</dt><dd>${j.acceptedAt ? mailDate(j.acceptedAt) : '—'}</dd><dt>链接到期</dt><dd>${j.linkExpiresAt ? mailDate(j.linkExpiresAt) : '—'}</dd></dl>${j.lastError ? `<p>${esc(mailFailure(j.lastError))}</p>` : ''}${j.messageId ? `<p class="report-mail-note">邮件编号：${esc(j.messageId)}</p>` : ''}<ol>${(j.attempts || []).map(a => `<li>第 ${a.number} 次尝试 · ${mailDate(a.startedAt)} → ${a.endedAt ? mailDate(a.endedAt) : '处理中'} · ${esc(MAIL_LABELS[a.status] || a.status)} ${esc(mailFailure(a.error))}</li>`).join('')}</ol>${j.imported ? '<p class="report-mail-note">此记录导入自旧发送状态，无法还原更早的发送过程。</p>' : ''}${!detail && j.status === 'pending' && (hasPermission('nqoc-report-leads:send') || hasPermission('nqoc-report-leads:resend')) ? `<button type="button" data-mail-action="cancel" data-job-id="${esc(j._id)}">取消待发</button>` : ''}${j.status === 'sending' ? '<p class="report-mail-note">任务已开始处理，不能保证取消或撤回。</p>' : ''}</article>`).join('') || '<p>尚无发送记录。</p>';
        if (detail) return head + events + (data.hasMore ? '<p class="report-mail-note">此处只显示最近 30 条，完整记录请点「查看全部发送记录」。</p>' : '');
        return head + events + `<div class="report-mail-pages"><button type="button" data-mail-action="page" data-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>上一页</button><span>第 ${data.page} 页</span><button type="button" data-mail-action="page" data-page="${data.page + 1}" ${!data.hasMore ? 'disabled' : ''}>下一页</button></div>`;
    }
    async function renderReportHistory(state) {
        const data = await json(`${API}/report-leads/${encodeURIComponent(state.id)}/email-history?page=${state.page}`, { headers: authHeaders() });
        if (reportMailDialog !== state) return;
        state.hasActive = data.jobs.some(j => ['pending', 'sending'].includes(j.status));
        $('reportMailBody').innerHTML = reportHistoryHtml(data);
    }
    async function openReportHistory(id) {
        const state = showReportMail('报告发送记录', { id, mode: 'history', page: 1 });
        try { await renderReportHistory(state); } catch (e) { if (reportMailDialog === state) $('reportMailBody').textContent = e.message; }
    }
    document.addEventListener('click', async event => {
        const el = event.target.closest('#reportMailModal [data-mail-action]');
        if (!el) { if (event.target.id === 'reportMailModal') closeReportMail(); return; }
        event.preventDefault(); event.stopImmediatePropagation();
        const action = el.dataset.mailAction;
        if (action === 'close') return closeReportMail();
        if (action === 'submit') return submitReportMail();
        if (action === 'resume') return resumeReportBatch();
        if (action === 'record') return openReportHistory(el.dataset.leadId);
        if (action === 'batch') return openBatchResult(el.dataset.batchId);
        const state = reportMailDialog;
        if (!state) return;
        try {
            if (action === 'page') state.page = Math.max(1, Number(el.dataset.page) || 1);
            if (action === 'cancel') {
                el.disabled = true;
                await json(`${API}/report-leads/${encodeURIComponent(state.id)}/cancel-email`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ jobId: el.dataset.jobId }) });
                await loadLeads();
            }
            await renderReportHistory(state);
        } catch (e) { if (reportMailDialog === state) $('reportMailFeedback').textContent = e.message; }
    }, true);
    document.addEventListener('change', event => {
        const selectedId = event.target.dataset.mailSelect;
        if (selectedId) {
            if (event.target.checked && reportMailSelected.size >= 50) { event.target.checked = false; toast('每批最多选择 50 条'); return; }
            if (event.target.checked) reportMailSelected.add(selectedId); else reportMailSelected.delete(selectedId);
            updateBatchSelection();
        }
        if (event.target.id === 'reportMailAcknowledged' && event.target.checked) $('reportMailFeedback').textContent = '';
    });
    document.addEventListener('keydown', event => {
        if (!reportMailDialog) return;
        if (event.key === 'Escape') { event.stopImmediatePropagation(); closeReportMail(); return; }
        if (event.key === 'Tab') {
            const controls = [...$('reportMailModal').querySelectorAll('button:not([disabled]),textarea,input')].filter(el => !el.hidden && el.offsetParent !== null);
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }, true);
    setInterval(async () => {
        if (document.hidden || reportMailPolling) return;
        const visible = document.querySelector('[data-view="nqoc-report-leads"].active');
        if (!visible && !reportMailDialog && !nqLeadDetailState) return;
        const pending = nqLeads.some(l => ['pending', 'sending'].includes(l.mail?.status))
            || (nqLeadDetailState?.lead && ['pending', 'sending'].includes(nqLeadDetailState.lead.mail?.status));
        if (!pending && !reportMailDialog?.hasActive) return;
        reportMailPolling = true;
        try {
            await loadLeads();
            if (nqLeadDetailState) await loadLeadDetail();
            if (reportMailDialog?.mode === 'history') await renderReportHistory(reportMailDialog);
            else if (reportMailDialog?.mode === 'batch-result') await renderBatchResult(reportMailDialog);
        } catch (_) {}
        finally { reportMailPolling = false; }
    }, 5000);

    function updateBatchSelection() {
        if ($('reportBatchCount')) $('reportBatchCount').textContent = `已选 ${reportMailSelected.size} 条`;
        if ($('reportLastBatch')) $('reportLastBatch').hidden = !sessionStorage.getItem('reportLastBatch');
    }
    async function openReportBatch(ids = [...reportMailSelected], templateId = '') {
        ids = [...new Set(ids)];
        if (ids.length > 50) return toast('每批最多选择 50 条记录');
        if (!ids.length) return toast('请先勾选需要补发的申请记录');
        const state = showReportMail('确认批量补发报告', { mode: 'batch-preview', requestKey: crypto.randomUUID(), busy: false });
        try {
            const preview = await json(`${API}/report-leads/email-batch-preview`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ids, templateId }) });
            if (reportMailDialog !== state) return;
            state.batchPreview = preview;
            if (preview.requestKey) state.requestKey = preview.requestKey;
            $('reportMailBody').innerHTML = `<p><b>模板 ${esc(preview.template?.name || '系统报告模板')}</b></p><p><b>本次将向 ${preview.eligibleCount} 个邮箱补发报告，排除 ${preview.excludedCount} 条。</b></p><p class="report-mail-note">同一邮箱和报告在本批只发送一次；已接收、待发、发送中、待核实及回收站记录默认排除。链接有效期为 7 天。</p><table><thead><tr><th>申请人</th><th>收件邮箱</th><th>确认结果</th></tr></thead><tbody>${preview.rows.map(r => `<tr><td>${esc(r.name || '—')}</td><td>${esc(r.email || '—')}</td><td>${r.eligible ? `将发送 · ${esc(r.reportTitle)} · ${esc(r.reportVersion)}` : `已排除：${esc(r.message)}`}</td></tr>`).join('')}</tbody></table><label>批量补发原因（必填）<textarea id="reportMailReason" maxlength="300" placeholder="例如：向历史申请但尚未发送的用户补发正式报告"></textarea></label><label class="report-mail-check"><input type="checkbox" id="reportMailAcknowledged">我已核对上述名单，同意向标记“将发送”的 ${preview.eligibleCount} 个邮箱发送报告</label>`;
            $('reportMailConfirm').hidden = false; $('reportMailConfirm').disabled = preview.eligibleCount === 0;
            $('reportMailConfirm').textContent = `确认补发 ${preview.eligibleCount} 封`;
        } catch (e) { if (reportMailDialog === state) $('reportMailBody').textContent = e.message; }
    }
    async function submitReportBatch() {
        const state = reportMailDialog;
        if (!state?.batchPreview || state.busy) return;
        const reason = $('reportMailReason').value.trim();
        if (!reason) { $('reportMailFeedback').textContent = '请填写批量补发原因'; $('reportMailReason').focus(); return; }
        if (!$('reportMailAcknowledged').checked) { $('reportMailFeedback').textContent = '请勾选确认本次收件名单'; return; }
        state.busy = true; $('reportMailConfirm').disabled = true;
        sessionStorage.setItem('reportLastBatch', state.requestKey); updateBatchSelection();
        $('reportMailFeedback').textContent = '正在逐条创建发送任务，请勿重复操作…';
        try {
            await json(`${API}/report-leads/email-batches`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ requestKey: state.requestKey, previewToken: state.batchPreview.previewToken, reason, acknowledged: true }) });
            reportMailSelected.clear(); await loadLeads();
            if (reportMailDialog === state) await openBatchResult(state.requestKey);
        } catch (e) { if (reportMailDialog === state) { $('reportMailFeedback').textContent = `${e.message}。如网络中断，请查看最近批次，避免重复创建。`; $('reportMailConfirm').disabled = false; } }
        finally { state.busy = false; }
    }
    async function renderBatchResult(state) {
        const batch = await json(`${API}/report-leads/email-batches/${encodeURIComponent(state.batchId)}`, { headers: authHeaders() });
        if (reportMailDialog !== state) return;
        state.hasActive = batch.status === 'processing' || batch.results.some(r => ['pending', 'sending'].includes(r.deliveryStatus));
        const byId = new Map(batch.items.map(i => [i.id, i]));
        $('reportMailBody').innerHTML = `<p><b>已入队 ${batch.queuedCount} / ${batch.items.length} 条 · 邮件服务已接收 ${batch.acceptedCount} 封</b></p><p>操作人：${esc(batch.requestedBy)} · 原因：${esc(batch.reason)}</p><p class="report-mail-note">批次编号：${esc(batch._id)}。只处理本批已确认的名单，不会自动加入其他历史记录。入队不等于已送达。</p>${batch.status === 'interrupted' ? '<p>处理曾中断，可继续同一批次；已创建的任务不会重复创建。</p><button type="button" data-mail-action="resume">继续处理此批次</button>' : ''}<table><thead><tr><th>收件邮箱</th><th>处理结果</th><th>发送记录</th></tr></thead><tbody>${batch.results.map(r => `<tr><td>${esc(byId.get(r.id)?.expectedEmail || '—')}</td><td>${r.status === 'queued' ? esc(MAIL_LABELS[r.deliveryStatus] || '已入队') : `已跳过：${esc(r.message)}`}</td><td><button type="button" data-mail-action="record" data-lead-id="${esc(r.id)}">查看记录</button></td></tr>`).join('')}</tbody></table>${batch.status === 'processing' ? '<p>正在处理剩余条目，结果会自动刷新。</p>' : ''}`;
    }
    async function openBatchResult(id) {
        if (!id) return toast('暂无批次记录');
        const state = showReportMail('批量补发结果', { mode: 'batch-result', batchId: id });
        try { await renderBatchResult(state); } catch (e) { if (reportMailDialog === state) $('reportMailBody').textContent = e.message; }
    }
    async function resumeReportBatch() {
        const state = reportMailDialog;
        if (!state || state.busy) return;
        state.busy = true;
        try { await json(`${API}/report-leads/email-batches`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ requestKey: state.batchId, acknowledged: true }) }); await renderBatchResult(state); await loadLeads(); }
        catch (e) { if (reportMailDialog === state) $('reportMailFeedback').textContent = e.message; }
        finally { state.busy = false; }
    }

    const campaign = { templates: [], sourcePage: 1, contactPage: 1, sourceMore: false, contactMore: false };
    const campaignApi = `${API}/report-mail`;
    function campaignRequest(path, options = {}) {
        const headers = new Headers(authHeaders());
        if (options.body instanceof FormData) headers.delete('Content-Type');
        return json(campaignApi + path, { ...options, headers });
    }
    function campaignPost(path, body, method = 'POST') {
        return campaignRequest(path, { method, body: JSON.stringify(body) });
    }
    setInterval(() => {
        if (!$('reportCampaign')?.open || document.hidden) return;
        loadCampaignQuota().catch(() => {});
        if (!selectedCampaignRows('contact').length && document.querySelector('#campaignContactsRows [data-pending]')) {
            loadCampaignContacts(campaign.contactPage).catch(() => {});
        }
    }, 15000);
    function campaignNotice(message) { $('reportCampaignNotice').textContent = message; }
    function campaignTemplateFields() {
        return Object.fromEntries(new FormData($('campaignTemplateForm')));
    }
    function useCampaignTemplate(id = '') {
        const template = campaign.templates.find(item => item._id === id);
        $('campaignEditTemplate').value = id;
        const defaults = {
            subject: '您申请的《{{报告名称}}》已准备好',
            body: '您好！感谢关注瑞华智策。请点击下方按钮下载《{{报告名称}}》。\n\n{{下载链接}}\n\n链接有效期为 {{有效期}}。',
            button: '下载报告', signature: '瑞华智策·新质组织研究中心'
        };
        const form = $('campaignTemplateForm');
        for (const key of ['name', 'subject', 'preheader', 'body', 'button', 'signature', 'replyTo']) {
            form.elements.namedItem(key).value = (template || defaults)[key] || '';
        }
    }
    async function loadCampaignTemplates() {
        const data = await campaignRequest('/templates');
        campaign.templates = data.templates;
        const send = $('campaignTemplate'), edit = $('campaignEditTemplate'), source = $('campaignSource');
        const selected = send.value, editing = edit.value, sourceKey = source.value;
        const options = items => items.map(item => `<option value="${esc(item._id)}">${esc(item.name)} · ${({ draft: '草稿', published: '已发布', archived: '已停用' })[item.status]}</option>`).join('');
        send.innerHTML = '<option value="">系统报告模板</option>' + options(data.templates.filter(item => item.status === 'published'));
        edit.innerHTML = '<option value="">新模板</option>' + options(data.templates);
        source.innerHTML = data.sources.map(item => `<option value="${esc(item.key)}">${esc(item.label)}</option>`).join('');
        send.value = [...send.options].some(option => option.value === selected) ? selected : '';
        edit.value = editing;
        if (sourceKey) source.value = sourceKey;
    }
    async function loadCampaignQuota() {
        const q = await campaignRequest('/quota');
        const paused = q.pausedUntil && new Date(q.pausedUntil) > new Date();
        const reserveNote = q.remainingToday <= q.autoReserve && q.resetsAt ? ` · 补发额度次日恢复（${mailDate(q.resetsAt)}）` : '';
        $('reportCampaignQuota').textContent = q.enabled
            ? `账号限速每分钟 ${q.perMinute} 封、每日 ${q.perDay} 封 · 今日余量 ${q.remainingToday} 封（预留 ${q.autoReserve} 封给新申请）${paused ? ` · 暂停至 ${mailDate(q.pausedUntil)}` : ''}${reserveNote}`
            : '报告邮件服务尚未启用';
    }
    function renderCampaignRows(container, rows, kind) {
        $(container).innerHTML = rows.length ? `<table><thead><tr><th>选择</th><th>姓名 / 邮箱</th><th>来源 / 状态</th></tr></thead><tbody>${rows.map(row => `<tr>
            <td ${kind === 'contact' && ['pending', 'sending'].includes(row.status) ? 'data-pending' : ''}><input type="checkbox" data-campaign-kind="${kind}" value="${esc(row.id)}" aria-label="选择 ${esc(row.email)}"></td>
            <td>${esc(row.name || '—')}<div class="sub">${esc(row.email)}</div></td>
            <td>${esc(row.source || (row.submittedAt ? mailDate(row.submittedAt) : '—'))}
            ${kind === 'contact' ? `<div class="sub">${esc(MAIL_LABELS[row.status] || '未安排发送')}${row.status === 'pending' && row.nextAttemptAt ? ' · 最早 ' + esc(mailDate(row.nextAttemptAt)) : ''}</div><button type="button" data-campaign="contact-history" data-id="${esc(row.id)}">发送记录</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="sub">暂无记录</p>';
    }
    async function loadCampaignContacts(page = 1, chooseBatch) {
        const batch = $('campaignBatch');
        const key = chooseBatch ?? batch.value;
        const params = new URLSearchParams({ page });
        if (key) params.set('batch', key);
        const data = await campaignRequest('/contacts?' + params);
        if (key && !data.batches.some(item => item._id === key)) return loadCampaignContacts(1, '');
        if (key) {
            const item = data.batches.find(row => row._id === key);
            if (![...batch.options].some(option => option.value === key)) batch.add(new Option(`${item.source} · ${item.count} 条`, key));
        } else {
            batch.innerHTML = '<option value="">全部名单批次</option>' + data.batches.map(item => `<option value="${esc(item._id)}">${esc(item.source)} · ${item.count} 条</option>`).join('');
        }
        batch.value = key;
        campaign.contactPage = data.page;
        campaign.contactMore = data.more;
        renderCampaignRows('campaignContactsRows', data.rows, 'contact');
    }
    async function loadCampaignSource(page = 1) {
        const key = $('campaignSource').value;
        const params = new URLSearchParams({ page, q: $('campaignSearch').value });
        const data = await campaignRequest('/source/' + encodeURIComponent(key) + '?' + params);
        campaign.loadedSource = key;
        campaign.sourcePage = data.page;
        campaign.sourceMore = data.more;
        renderCampaignRows('campaignSourceRows', data.rows, 'source');
    }
    function selectedCampaignRows(kind) {
        return [...document.querySelectorAll(`[data-campaign-kind="${kind}"]:checked`)].map(el => el.value);
    }
    function campaignBasis() {
        const basis = $('campaignBasis').value.trim();
        const confirmed = $('campaignBasisConfirmed').checked;
        if (!confirmed || !basis) throw new Error('请填写并确认报告发放依据');
        return { basis, confirmed };
    }
    async function previewCampaignImport() {
        campaignBasis();
        if (!$('campaignImportLabel').value.trim()) throw new Error('请先填写活动或批次名称');
        const file = $('campaignFile').files[0];
        if (!file) throw new Error('请先选择 Excel 文件');
        const form = new FormData();
        form.set('file', file);
        const data = await campaignRequest('/import-preview', { method: 'POST', body: form });
        const valid = data.rows.filter(row => !row.error).length;
        const state = showReportMail('核对 Excel 名单', { mode: 'campaign-import', file, requestKey: crypto.randomUUID() });
        $('reportMailBody').innerHTML = `<p>有效 ${valid} 条，排除 ${data.rows.length - valid} 条。</p>
            <table><thead><tr><th>记录</th><th>姓名</th><th>邮箱</th><th>结果</th></tr></thead><tbody>${data.rows.map(row => `<tr><td>${row.row}</td><td>${esc(row.name)}</td><td>${esc(row.email)}</td><td>${esc(row.error || '可导入')}</td></tr>`).join('')}</tbody></table>`;
        if (valid && reportMailDialog === state) {
            const action = $('reportMailConfirm');
            action.hidden = false; action.disabled = false; action.textContent = '确认导入名单';
        }
    }
    async function confirmCampaignImport(state) {
        if (state.busy) return;
        try {
            const label = $('campaignImportLabel').value.trim();
            if (!label) throw new Error('请先在名单区填写活动或批次名称');
            const basis = campaignBasis();
            const form = new FormData();
            for (const [key, value] of Object.entries({ file: state.file, label, ...basis, requestKey: state.requestKey })) form.set(key, value);
            state.busy = true;
            $('reportMailConfirm').disabled = true;
            const data = await campaignRequest('/import', { method: 'POST', body: form });
            closeReportMail();
            await loadCampaignContacts(1, data.rows[0]?.importKey);
            campaignNotice(`已导入 ${data.rows.length} 条，等待选择并确认发送。`);
        } catch (error) {
            $('reportMailFeedback').textContent = error.message;
            $('reportMailConfirm').disabled = false;
        } finally { state.busy = false; }
    }
    const campaignActions = {
        'template-preview': async () => {
            const data = await campaignPost('/template-preview', campaignTemplateFields());
            showReportMail('模板预览', { mode: 'template-preview' });
            $('reportMailBody').innerHTML = `<h3>${esc(data.subject)}</h3><pre>${esc(data.text)}</pre>`;
        },
        'template-copy': () => {
            $('campaignEditTemplate').value = '';
            campaignNotice('已复制内容，修改名称后保存为新草稿。');
        },
        'template-save': async () => {
            const id = $('campaignEditTemplate').value;
            const data = await campaignPost(id ? '/templates/' + encodeURIComponent(id) : '/templates', campaignTemplateFields(), id ? 'PUT' : 'POST');
            await loadCampaignTemplates();
            useCampaignTemplate(data._id);
            campaignNotice('草稿已保存。');
        },
        'template-publish': async () => {
            const id = $('campaignEditTemplate').value;
            if (!id) throw new Error('请先保存草稿');
            await campaignPost('/templates/' + encodeURIComponent(id) + '/publish', {});
            await loadCampaignTemplates();
            useCampaignTemplate(id);
            $('campaignTemplate').value = id;
            campaignNotice('模板已发布，可用于确认发送。');
        },
        'template-archive': async () => {
            const id = $('campaignEditTemplate').value;
            if (!id) throw new Error('请选择要停用的模板');
            await campaignPost('/templates/' + encodeURIComponent(id) + '/archive', {});
            await loadCampaignTemplates();
            campaignNotice('模板已停用。');
        },
        'template-test': async () => {
            const email = $('campaignTestEmail').value.trim();
            if (!email || !$('campaignTestEmail').checkValidity()) throw new Error('请输入有效的试发邮箱');
            const template = campaignTemplateFields();
            const preview = await campaignPost('/template-preview', template);
            showReportMail('确认试发报告邮件', { mode: 'campaign-test', email, template, requestKey: crypto.randomUUID() });
            $('reportMailBody').innerHTML = `<p>试发收件邮箱 ${esc(email)}</p><h3>${esc(preview.subject)}</h3><pre>${esc(preview.text)}</pre>`;
            const confirm = $('reportMailConfirm');
            confirm.hidden = false; confirm.disabled = false; confirm.textContent = '确认试发一封';
        },
        'import-preview': previewCampaignImport,
        'source-load': () => loadCampaignSource(),
        'source-prev': () => loadCampaignSource(Math.max(1, campaign.sourcePage - 1)),
        'source-next': () => campaign.sourceMore && loadCampaignSource(campaign.sourcePage + 1),
        'source-stage': async () => {
            const ids = selectedCampaignRows('source'), source = $('campaignSource').value;
            if (!ids.length || campaign.loadedSource !== source) throw new Error('请查询当前表单并勾选记录');
            const result = await campaignPost('/stage', { ids, source, ...campaignBasis(), requestKey: crypto.randomUUID() });
            await loadCampaignContacts(1, result.rows[0]?.importKey);
            campaignNotice(`已加入 ${result.rows.length} 条，跳过 ${result.skipped} 条。`);
        },
        'contacts-load': () => loadCampaignContacts(),
        'contacts-prev': () => loadCampaignContacts(Math.max(1, campaign.contactPage - 1)),
        'contacts-next': () => campaign.contactMore && loadCampaignContacts(campaign.contactPage + 1),
        'contacts-preview': () => openReportBatch([...selectedCampaignRows('contact'), ...reportMailSelected], $('campaignTemplate').value),
        'contact-history': el => openReportHistory(el.dataset.id),
        'last-batch': () => openBatchResult(sessionStorage.getItem('reportLastBatch') || '')
    };
    async function confirmCampaignTest(state) {
        if (state.busy) return;
        state.busy = true;
        $('reportMailConfirm').disabled = true;
        try {
            const data = await campaignPost('/test', { email: state.email, template: state.template, requestKey: state.requestKey, confirmed: true });
            if (reportMailDialog === state) await openReportHistory(data.id);
            await loadCampaignQuota();
        } catch (error) {
            $('reportMailFeedback').textContent = error.message;
            $('reportMailConfirm').disabled = false;
        } finally { state.busy = false; }
    }
    const campaignPanel = $('reportCampaign');
    if (campaignPanel) {
        campaignPanel.addEventListener('toggle', async () => {
            if (!campaignPanel.open) return;
            try {
                await Promise.all([loadCampaignTemplates(), loadCampaignQuota(), loadCampaignContacts()]);
                if (!$('campaignTemplateForm').elements.namedItem('body').value) useCampaignTemplate();
            } catch (error) { campaignNotice(error.message); }
        });
        campaignPanel.addEventListener('submit', event => event.preventDefault());
        campaignPanel.addEventListener('change', event => {
            if (event.target.id === 'campaignEditTemplate') useCampaignTemplate(event.target.value);
            if (event.target.id === 'campaignSource') $('campaignSourceRows').textContent = '';
            if (event.target.id === 'campaignBatch') loadCampaignContacts().catch(error => campaignNotice(error.message));
        });
        campaignPanel.addEventListener('click', async event => {
            const button = event.target.closest('[data-campaign]');
            const action = button && campaignActions[button.dataset.campaign];
            if (!action || button.disabled) return;
            button.disabled = true;
            try { await action(button); }
            catch (error) { campaignNotice(error.message); }
            finally { button.disabled = false; }
        });
    }

    const NQ_ACTIONS = {
        new: t => { if (NQ_TYPES[t].studio) window.openStudio(NQ_TYPES[t].studio, null); else openModalEditor(t, null); },
        edit: (t, id) => { if (NQ_TYPES[t].studio) window.openStudio(NQ_TYPES[t].studio, id); else openModalEditor(t, id); },
        delete: async (t, id) => {
            const T = NQ_TYPES[t], o = nqFind(t, id);
            if (!o) return;
            if (!confirm(`确认删除这条${T.name}？前台将立即不再展示。`)) return;
            try {
                await json(`${API}/${T.res}/${id}`, { method: 'DELETE', headers: authHeaders() });
                if (t === 'banner') await loadBanners(); else if (t === 'video') await loadVideos(); else await loadPosts(t);
                toast(T.name + '已删除');
            } catch (e) { toast(e.message); }
        },
        toggle: async (t, id) => {
            const o = nqFind(t, id);
            if (!o) return;
            const T = NQ_TYPES[t];
            const body = t === 'banner' ? { isOnline: !o.isOnline } : { status: o.status === 'published' ? 'archived' : 'published' };
            try {
                await json(`${API}/${T.res}/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
                if (t === 'banner') { await loadBanners(); toast(body.isOnline ? '已加入轮播' : '已从轮播中隐藏'); }
                else { if (t === 'video') await loadVideos(); else await loadPosts(t); toast(body.status === 'published' ? '已发布，前台立即可见' : '已下架，前台立即不可见（数据保留）'); }
            } catch (e) { toast(e.message); }
        },
        top: async (t, id) => {
            const o = nqFind(t, id);
            if (!o) return;
            if (!o.top && o.status !== 'published') { toast('只有已发布的内容可以置顶'); return; }
            const T = NQ_TYPES[t];
            try {
                await json(`${API}/${T.res}/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ top: !o.top }) });
                await loadPosts(t);
                toast(o.top ? '已取消置顶' : '已置顶到列表首位');
            } catch (e) { toast(e.message); }
        },
        preview: (t, id) => {
            const o = nqFind(t, id);
            if (!o || !o.slug) { toast('先保存一次再预览'); return; }
            window.open(NQ_TYPES[t].path + o.slug + '?preview=1', '_blank', 'noopener');
        },
        filter: (t, id, el) => {
            const view = el.closest('[data-view]').dataset.view;
            const box = el.closest('.segments');
            if (box) {
                box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
                NQ_FILTERS[view][box.dataset.filter] = el.dataset.value || '';
            }
            // 正常记录 / 回收站属于服务端数据源切换，需要重新拉取
            if (view === 'nqoc-report-leads' && box && box.dataset.filter === 'bin') {
                nqSyncUrl(view);
                return loadLeads();
            }
            nqRenderView(view);
            nqSyncUrl(view);
        },
        export: () => nqExportLeads(),
        'reset-lead-filters': () => {
            const view = 'nqoc-report-leads';
            Object.keys(NQ_FILTERS[view]).forEach(k => { NQ_FILTERS[view][k] = ''; });
            nqSyncFilterUi(view);
            nqSyncUrl(view);
            loadLeads();
        },
        'select-mail-rows': () => { for (const lead of nqLeadRows().slice(0, 50)) { if (reportMailSelected.size >= 50) break; reportMailSelected.add(lead.id); } renderNqLeads(); },
        'clear-mail-rows': () => { reportMailSelected.clear(); renderNqLeads(); },
        'batch-mail': () => openReportBatch(),
        'last-mail-batch': () => openBatchResult(sessionStorage.getItem('reportLastBatch') || ''),
        'send-lead-email': (t, id) => openReportMail(id),
        'mail-history': (t, id) => openReportHistory(id),
        'lead-detail-back': () => leaveLeadDetail(),
        'delete-lead': async (t, id) => {
            const lead = nqLeadById(id);
            if (!lead) return;
            if (!confirm(`确认将「${lead.name}」的这条报告领取记录移入回收站？30 天内可在回收站恢复。`)) return;
            try {
                const inDetail = nqLeadDetailState && String(nqLeadDetailState.id) === String(id);
                await json(`${API}/report-leads/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
                if (inDetail) await leaveLeadDetail(); else await loadLeads();
                toast('记录已移入回收站');
            } catch (e) { toast(e.message); }
        },
        'restore-lead': async (t, id) => {
            const lead = nqLeadById(id);
            if (!lead) return;
            if (!confirm(`确认将「${lead.name}」的这条记录恢复到正常列表？`)) return;
            try {
                const inDetail = nqLeadDetailState && String(nqLeadDetailState.id) === String(id);
                await json(`${API}/report-leads/${encodeURIComponent(id)}/restore`, { method: 'POST', headers: authHeaders() });
                if (inDetail) await loadLeadDetail(); else await loadLeads();
                toast('记录已恢复');
            } catch (e) { toast(e.message); }
        },
        'purge-lead': async (t, id) => {
            const lead = nqLeadById(id);
            if (!lead) return;
            if (!confirm(`确认彻底删除「${lead.name}」的这条记录？此操作不可撤销，也无法再恢复。`)) return;
            try {
                const inDetail = nqLeadDetailState && String(nqLeadDetailState.id) === String(id);
                await json(`${API}/report-leads/${encodeURIComponent(id)}/purge`, { method: 'DELETE', headers: authHeaders() });
                if (inDetail) await leaveLeadDetail(); else await loadLeads();
                toast('记录已彻底删除');
            } catch (e) { toast(e.message); }
        }
    };

    // 捕获阶段：先于 admin-2026.js 的冒泡委托执行
    document.addEventListener('click', event => {
        // 弹窗开着时，接管共享 #editorModal 的关闭 / 保存按钮（否则会被 admin-2026.js 的文章编辑器处理）
        if (nqEd) {
            const el = event.target.closest('[data-action]');
            if (el && el.closest('#editorModal')) {
                const action = el.dataset.action;
                if (action === 'close-editor' || action === 'save-editor') {
                    event.preventDefault();
                    event.stopPropagation();
                    if (action === 'close-editor') closeModalEditor(); else saveModalEditor();
                    return;
                }
            }
            if (event.target.id === 'editorModal') { event.stopPropagation(); closeModalEditor(); return; }
        }
        const target = event.target.closest('[data-view^="nqoc"] [data-action]');
        if (!target) return;
        const fn = NQ_ACTIONS[target.dataset.action];
        if (fn) fn(target.dataset.type, target.dataset.id || null, target);
    }, true);

    document.addEventListener('input', event => {
        const t = event.target;
        const input = t.closest('[data-view^="nqoc"] input[data-filter]');
        if (input) {
            const view = input.closest('[data-view]').dataset.view;
            NQ_FILTERS[view][input.dataset.filter] = input.value;
            nqRenderView(view);
            nqSyncUrl(view);
            return;
        }
        if (nqEd && t.closest('#editorForm')) nqEditorSync();
    });

    document.addEventListener('change', event => {
        const t = event.target;
        const select = t.closest('[data-view^="nqoc"] select[data-filter]');
        if (select) {
            const view = select.closest('[data-view]').dataset.view;
            NQ_FILTERS[view][select.dataset.filter] = select.value;
            nqRenderView(view);
            nqSyncUrl(view);
            return;
        }
        if (nqEd && t.closest('#editorForm')) {
            if (t.dataset.upload === 'image') {
                const key = t.name;
                nqPickFile(t, url => {
                    nqPend[key] = url;
                    const box = document.querySelector(`#editorForm [data-thumb="${key}"]`);
                    if (box) box.innerHTML = nqThumb(url, 'lg', '已上传');
                });
                return;
            }
            if (t.dataset.upload === 'video') {
                nqPickVideo(t, url => { nqPend[t.name] = url; });
                return;
            }
            nqEditorSync();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && nqEd) closeModalEditor();
    });

    /* --------------------------- 列表列宽拖拽（本地记忆） --------------------------- */

    const COLW_KEY = 'rh_admin_colw', COLW_MIN = 56;
    function colwLoad() { try { return JSON.parse(localStorage.getItem(COLW_KEY)) || {}; } catch (e) { return {}; } }
    function colwSave(key, arr) {
        try {
            const o = colwLoad();
            if (arr) o[key] = arr; else delete o[key];
            localStorage.setItem(COLW_KEY, JSON.stringify(o));
        } catch (e) { /* 忽略 */ }
    }
    function colwApply(tb, ws) {
        const ths = [...tb.tHead.rows[0].cells];
        ths.forEach((th, i) => { th.style.width = ws[i] + 'px'; });
        tb.classList.add('rz');
        tb.style.minWidth = '0';
        tb.style.width = ws.reduce((a, b) => a + b, 0) + 'px';
    }
    function colwReset(tb) {
        [...tb.tHead.rows[0].cells].forEach(th => { th.style.width = th.dataset.w0 || ''; });
        tb.classList.remove('rz');
        tb.style.minWidth = '';
        tb.style.width = '';
    }
    function initColResize() {
        const saved = colwLoad();
        document.querySelectorAll('.table-wrap table').forEach(tb => {
            const key = (tb.tBodies[0] && tb.tBodies[0].id) || '';
            if (!key || !tb.tHead) return;
            const ths = [...tb.tHead.rows[0].cells];
            ths.forEach((th, i) => {
                th.dataset.w0 = th.dataset.w0 || th.style.width || '';
                const h = document.createElement('span');
                h.className = 'col-rs';
                h.title = '拖动调整列宽，双击恢复默认';
                th.appendChild(h);
                h.onclick = e => e.stopPropagation();
                h.ondblclick = e => { e.stopPropagation(); colwReset(tb); colwSave(key, null); toast('已恢复默认列宽'); };
                h.onpointerdown = e => {
                    if (e.button) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const ws = ths.map(t => Math.round(t.getBoundingClientRect().width));
                    colwApply(tb, ws);
                    const x0 = e.clientX, w0 = ws[i];
                    h.setPointerCapture(e.pointerId);
                    h.classList.add('on');
                    document.body.classList.add('col-rz');
                    h.onpointermove = ev => { ws[i] = Math.max(COLW_MIN, Math.round(w0 + ev.clientX - x0)); colwApply(tb, ws); };
                    h.onpointerup = h.onpointercancel = () => {
                        h.onpointermove = h.onpointerup = h.onpointercancel = null;
                        h.classList.remove('on');
                        document.body.classList.remove('col-rz');
                        colwSave(key, ws);
                    };
                };
            });
            const ws = saved[key];
            if (Array.isArray(ws) && ws.length === ths.length && ws.every(n => n >= COLW_MIN && n < 4000)) colwApply(tb, ws);
        });
    }

    /* ------------------------------ 启动 ------------------------------ */

    initColResize();
    // admin-2026.js 在自己脚本末尾就调用了 restoreRoute()，那时本文件还没加载，
    // 所以这里补一次「当前视图」的数据加载。
    // 详情页 /admin/nqoc-report-leads/<id>：先按列表视图加载，再渲染详情
    const nqDetailPath = /^\/admin\/nqoc-report-leads\/([^/]+)\/?$/.exec(location.pathname);
    if (nqDetailPath) {
        window.nqocLoad('nqoc-report-leads');
        openLeadDetail(decodeURIComponent(nqDetailPath[1]), { from: leadDetailFromParam(), push: false });
    } else {
        const activeView = document.querySelector('.view.active');
        if (activeView && /^nqoc-/.test(activeView.dataset.view || '')) window.nqocLoad(activeView.dataset.view);
    }
    // 浏览器前进 / 后退：详情页与列表页互相切换
    window.addEventListener('popstate', () => {
        const m = /^\/admin\/nqoc-report-leads\/([^/]+)\/?$/.exec(location.pathname);
        if (m) openLeadDetail(decodeURIComponent(m[1]), { from: leadDetailFromParam(), push: false });
        else if (nqLeadDetailState) leaveLeadDetail();
    });
})();
