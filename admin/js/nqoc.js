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
        'nqoc-report-leads': { q: '', range: '' }
    };
    const NQ_FILTER_OK = { status: ['', 'draft', 'published', 'archived'], range: ['', '1', '7', '30'] };

    let nqBanners = [];
    let nqPosts = { insight: [], case: [] };
    let nqVideos = [];
    let nqLeads = [];
    let nqLeadStats = { today: 0, week7: 0, all: 0, companies: 0 };
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
        box.querySelectorAll('.segments[data-filter="status"] button').forEach(b => b.classList.toggle('on', b.dataset.value === f.status));
        const s = box.querySelector('select[data-filter]');
        if (s) s.value = f[s.dataset.filter] || '';
    }
    function nqSyncUrl(view) {
        const f = NQ_FILTERS[view];
        if (!f) return;
        const qs = Object.keys(f).filter(k => f[k]).map(k => k + '=' + encodeURIComponent(f[k])).join('&');
        try { history.replaceState(null, '', `/admin/${view}${qs ? '?' + qs : ''}`); } catch (e) { /* 忽略 */ }
    }
    function nqRestoreFilters(view) {
        const f = NQ_FILTERS[view];
        if (!f) return;
        Object.keys(f).forEach(k => { f[k] = ''; });
        new URLSearchParams(location.search).forEach((v, k) => {
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
                <span class="intent-tag">主按钮：${esc(b.primaryText)} → ${b.primaryAction === 'report' ? '领取最新报告' : esc(b.primaryUrl)}</span>
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

    function nqLeadRows() {
        const f = NQ_FILTERS['nqoc-report-leads'], q = f.q.trim().toLowerCase(), days = +f.range || 0;
        const cutoff = days ? Date.now() - days * DAY : 0;
        return (nqLeads || []).filter(l => (!cutoff || new Date(l.createdAt).getTime() >= cutoff) &&
            (!q || [l.name, l.company, l.phone, l.email, l.position].map(v => String(v || '')).join(' ').toLowerCase().includes(q)))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    function renderNqLeads() {
        const rows = nqLeadRows(), total = nqLeads.length, now = Date.now();
        const between = (from, to) => nqLeads.filter(l => { const t = now - new Date(l.createdAt).getTime(); return t >= from && t < to; }).length;
        $('nqLTd').textContent = nqLeadStats.today;
        $('nqLYd').textContent = between(DAY, 2 * DAY);
        $('nqL7').textContent = nqLeadStats.week7;
        $('nqL30').textContent = between(0, 30 * DAY);
        $('nqLAll').textContent = nqLeadStats.all;
        $('nqLCo').textContent = nqLeadStats.companies;
        const badge = $('nqLeadBadge');
        if (badge) badge.textContent = nqLeadStats.today;

        $('nqLeadRows').innerHTML = rows.length ? rows.map(l => `
            <tr>
              <td><div class="person"><b>${esc(l.name)}</b></div></td>
              <td>${esc(l.phone)}</td>
              <td><div>${esc(l.company)}</div><div class="sub">${esc(l.position)}</div></td>
              <td style="word-break:break-all">${esc(l.email)}</td>
              <td>${esc(l.reportTitle)}</td>
              <td><div class="sub" style="word-break:break-all">${esc(l.sourcePage)}</div></td>
              <td><div>${ago(l.createdAt)}</div><div class="sub">${shortDateTime(l.createdAt)}</div></td>
            </tr>`).join('') : '<tr><td colspan="7" class="empty-cell"><b>没有符合条件的记录</b>换个筛选条件试试</td></tr>';
        $('nqLeadCount').textContent = `共 ${rows.length} 条记录${rows.length !== total ? `（总计 ${total} 条）` : ''}`;
        nqSyncFilterUi('nqoc-report-leads');
        nqApplyPerms($('nqLeadRows').closest('table'));
    }
    async function loadLeads() {
        try {
            const data = await json(`${API}/report-leads`, { headers: authHeaders() });
            nqLeads = Array.isArray(data.leads) ? data.leads : [];
            nqLeadStats = Object.assign({ today: 0, week7: 0, all: 0, companies: 0 }, data.stats || {});
            renderNqLeads();
        } catch (e) {
            $('nqLeadRows').innerHTML = `<tr><td colspan="7" class="empty-cell">${esc(e.message)}</td></tr>`;
        }
    }
    async function nqExportLeads() {
        if (!nqLeadRows().length) { toast('当前筛选下没有记录可导出'); return; }
        const f = NQ_FILTERS['nqoc-report-leads'];
        const qs = new URLSearchParams();
        if (f.q.trim()) qs.set('q', f.q.trim());
        if (f.range) qs.set('range', f.range);
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
            { k: 'primaryAction', label: '主按钮点击后', type: 'select', options: [['link', '跳转到链接'], ['report', '弹出领取表单（领取最新报告）']], half: 1 },
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
            { k: 'videoUrl', label: '视频文件', req: 1, type: 'video', hint: 'MP4 / MOV / WebM，≤ 3GB；上传后自动写入对象存储 nqoc/zdkj/' },
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
        setBox(`<div class="sub">正在上传 ${esc(file.name)}（${mb}MB）…</div>`);
        inp.disabled = true;
        const fd = new FormData();
        fd.append('file', file);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload/nqoc-video');
        // 上传走 XHR 才能拿到进度；token 仍走 Authorization 头
        const tk = sessionStorage.getItem('token');
        if (tk) xhr.setRequestHeader('Authorization', 'Bearer ' + tk);
        xhr.upload.onprogress = e => {
            if (!e.lengthComputable) return;
            const pct = Math.min(100, Math.round(e.loaded / e.total * 100));
            setBox(`<div class="sub">正在上传 ${esc(file.name)}（${mb}MB）… ${pct}%</div>`);
        };
        xhr.onload = () => {
            inp.disabled = false;
            let d = {};
            try { d = JSON.parse(xhr.responseText || '{}'); } catch (e) { d = {}; }
            if (xhr.status >= 200 && xhr.status < 300 && d.url) { setBox(nqVideoBox(d.url)); done(d.url); return; }
            setBox(nqVideoBox(''));
            toast(d.error || ('上传失败 (HTTP ' + xhr.status + ')'));
            inp.value = '';
        };
        xhr.onerror = () => {
            inp.disabled = false;
            setBox(nqVideoBox(''));
            toast('网络中断，视频上传失败，请重试');
            inp.value = '';
        };
        xhr.send(fd);
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
            if (box) box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
            NQ_FILTERS[view].status = el.dataset.value || '';
            nqRenderView(view);
            nqSyncUrl(view);
        },
        export: () => nqExportLeads()
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
    const activeView = document.querySelector('.view.active');
    if (activeView && /^nqoc-/.test(activeView.dataset.view || '')) window.nqocLoad(activeView.dataset.view);
})();
