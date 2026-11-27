(() => {
    const root = document.querySelector('[data-view="crm"]');
    if (!root) return;
    const $ = id => document.getElementById(id);
    const body = $('crmBody'), dialog = $('crmDialog'), form = $('crmForm');
    const labels = { dashboard: '工作台', leads: '线索', companies: '公司', contacts: '联系人', opportunities: '商机' };
    const stages = {
        leads: { new: '待处理', working: '跟进中', converted: '已转商机', closed: '已关闭' },
        opportunities: { demand: '需求确认', proposal: '方案沟通', quote: '报价谈判', won: '赢单', lost: '输单' }
    };
    const sources = { appointment: '官网预约', report: '报告领取', 'legacy-whitepaper': '历史白皮书领取', whitepaper: '官网白皮书',
        survey: '新质组织调研', manual: '日常录入', event: '线下活动', referral: '转介绍', inbound: '来电 / 来访' };
    const channels = { phone: '电话', wechat: '微信', email: '邮件', meeting: '会议', other: '其他',
        assign: '分配', stage: '阶段变更', convert: '线索转化', create: '创建', merge: '合并', archive: '归档' };
    const mailStatus = { pending: '待发送', sending: '发送中', accepted: '邮件服务已接收', failed: '发送失败', uncertain: '结果待核实', cancelled: '已取消' };
    const fields = {
        leads: [['name', '姓名或称呼', 'text', true], ['companyName', '公司或机构'], ['phone', '电话', 'tel'], ['email', '邮箱', 'email'],
            ['summary', '需求摘要', 'textarea'], ['tags', '标签（逗号分隔）'], ['nextStep', '下一步'], ['nextAt', '下次跟进', 'datetime-local']],
        companies: [['name', '公司名称', 'text', true], ['alias', '简称'], ['industry', '行业'], ['region', '地区'], ['website', '官网', 'url'], ['notes', '备注', 'textarea']],
        contacts: [['name', '姓名或称呼', 'text', true], ['phone', '电话', 'tel'], ['email', '邮箱', 'email'], ['position', '职位'],
            ['department', '部门'], ['tags', '标签（逗号分隔）'], ['notes', '备注', 'textarea']],
        opportunities: [['name', '商机名称', 'text', true], ['direction', '服务方向'], ['summary', '需求与项目说明', 'textarea'],
            ['expectedAmount', '预计金额（元）', 'number'], ['expectedAt', '预计成交日期', 'date'], ['tags', '标签（逗号分隔）'],
            ['nextStep', '下一步'], ['nextAt', '下次跟进', 'datetime-local']]
    };
    const state = { tab: 'dashboard', id: '', page: 1, filters: {}, owners: [], version: 0, detail: null };
    const api = (path, payload, method = 'GET') => json('/api/admin/crm' + path, { headers: authHeaders(), method,
        ...(payload ? { body: JSON.stringify(payload) } : {}) });
    const when = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
    const money = amount => amount == null ? '—' : Number(amount).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + ' 元';
    const stageLabel = (kind, stage) => stages[kind]?.[stage] || stage || '—';
    const ownerName = id => id ? state.owners.find(owner => owner._id === id)?.name || (id === String(currentUser.id) ? '我' : '已分配') : '未分配';
    const options = (map, value, empty) => (empty === undefined ? '' : '<option value="">' + esc(empty) + '</option>') +
        Object.entries(map).map(([key, label]) => `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(label)}</option>`).join('');
    const viewButton = (kind, row, extra = '') => `<button type="button" class="crm-link" data-crm-open="${esc(kind)}" data-id="${esc(row._id)}">${esc(row.name)}</button>${extra}`;
    const action = (key, label, primary = false) => `<button type="button" data-crm-action="${key}"${primary ? ' class="primary"' : ''}>${esc(label)}</button>`;
    const empty = message => `<p class="crm-empty">${esc(message)}</p>`;

    function setLocation() {
        const query = new URLSearchParams();
        if (state.tab !== 'dashboard') query.set('tab', state.tab);
        if (state.id) query.set('record', state.id);
        history.replaceState(null, '', '/admin/crm' + (query.size ? '?' + query : ''));
    }
    function navigate(tab, id = '') {
        if (state.tab !== tab) { state.filters = {}; state.page = 1; }
        state.tab = tab;
        state.id = id;
        setLocation();
        return load();
    }
    function table(headers, rows) {
        if (!rows.length) return empty('暂无符合条件的记录');
        return `<div class="table-wrap"><table><thead><tr>${headers.map(label => '<th>' + esc(label) + '</th>').join('')}</tr></thead><tbody>${rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('')}</tbody></table></div>`;
    }
    function dashboard(data) {
        const cards = [['今日新增线索', data.received], ['待处理线索', data.pending], ['逾期跟进', data.overdue],
            ['累计转商机', data.sources.reduce((sum, item) => sum + item.converted, 0)]];
        if (data.unassigned != null) cards.push(['未分配线索', data.unassigned]);
        const items = [...data.leads.map(row => ({ ...row, kind: 'leads' })),
            ...data.opportunities.filter(row => row.nextAt && new Date(row.nextAt) < new Date(data.end)).map(row => ({ ...row, kind: 'opportunities' }))]
            .sort((a, b) => new Date(a.nextAt) - new Date(b.nextAt));
        const follow = items.map(row => [viewButton(row.kind, row), esc(labels[row.kind]), esc(row.nextStep || '—'), esc(when(row.nextAt)), esc(new Date(row.nextAt) < new Date() ? '逾期' : '今日')]);
        const arrivals = data.sources.map(row => [esc(row._id === 'report' ? '报告领取（含历史白皮书）' : sources[row._id] || row._id), String(row.count), String(row.converted)]);
        const pipeline = data.grouped.map(row => [esc(stageLabel('opportunities', row._id)), String(row.count),
            esc(row._id === 'won' || row._id === 'lost' ? '—' : money(row.expected)), esc(row._id === 'won' ? money(row.actual) : '—')]);
        const expected = data.expected
            .map(row => `<li>${viewButton('opportunities', row)} <span class="crm-time">${esc(when(row.expectedAt))}</span></li>`);
        body.innerHTML = `<div class="crm-stack">
          <section class="crm-panel crm-stack"><div class="crm-toolbar"><h2>跟进工作台</h2><div class="crm-actions">${hasPermission('crm:all') ? action('unassigned', '查看未分配线索') : ''}${hasPermission('crm:edit') ? action('new-lead', '录入线索', true) : ''}</div></div>
          <dl class="crm-kpis">${cards.map(([label, value]) => '<div><dt>' + esc(label) + '</dt><dd>' + Number(value) + '</dd></div>').join('')}</dl></section>
          <section class="crm-panel"><h3>今日与逾期跟进</h3>${table(['事项', '类型', '下一步', '跟进时间', '状态'], follow)}</section>
          <div class="crm-cards">
            <section class="crm-panel"><h3>未来 30 天预计成交</h3>${expected.length ? '<ul class="crm-quick-list">' + expected.join('') + '</ul>' : empty('暂无预计成交商机')}</section>
            <section class="crm-panel"><h3>官网同步</h3><p>${esc(state.sync?.completedAt ? '最近检查：' + when(state.sync.completedAt) : '暂未记录同步检查')}</p>${state.sync?.errorAt ? '<p class="sub">最近重试记录 ' + esc(when(state.sync.errorAt)) + '</p>' : ''}</section>
          </div>
          <section class="crm-panel"><h3>来源与转化</h3>${table(['来源', '线索数', '转商机'], arrivals)}</section>
          <section class="crm-panel"><h3>商机各阶段</h3>${table(['阶段', '数量', '预计金额', '实际赢单金额'], pipeline)}</section>
        </div>`;
    }
    function listing(data) {
        const kind = state.tab, filter = state.filters;
        const headers = {
            leads: ['姓名 / 公司', '联系方式', '来源', '阶段', '负责人', '下次跟进'],
            companies: ['名称 / 简称', '行业', '地区', '负责人'],
            contacts: ['姓名 / 职位', '公司', '联系方式', '负责人'],
            opportunities: ['项目 / 服务方向', '公司', '阶段', '金额', '负责人', '下次跟进']
        }[kind];
        const stack = (first, second) => `<div>${first || '—'}</div>${second ? '<span class="sub">' + esc(second) + '</span>' : ''}`;
        const info = data.rows.map(row => {
            const stage = esc(stageLabel(kind, row.stage)), owner = esc(ownerName(row.ownerId));
            if (kind === 'leads') return [stack(viewButton(kind, row), row.company), stack(esc(row.phone), row.email), esc(sources[row.source] || row.source), stage + (row.matchIssue ? '<span class="sub">资料待核实</span>' : ''), owner, esc(when(row.nextAt))];
            if (kind === 'companies') return [stack(viewButton(kind, row), row.alias), esc(row.industry || '—'), esc(row.region || '—'), owner];
            if (kind === 'contacts') return [stack(viewButton(kind, row), row.position), esc(row.company || '—'), stack(esc(row.phone), row.email), owner];
            return [stack(viewButton(kind, row), row.direction), esc(row.company || '—'), stage, esc(money(row.stage === 'won' ? row.actualAmount : row.expectedAmount)), owner, esc(when(row.nextAt))];
        });
        const pages = Math.max(1, Math.ceil(data.total / 30));
        body.innerHTML = `<section class="crm-panel">
          <div class="crm-toolbar"><div><h2>${labels[kind]}</h2><span class="sub">共 ${data.total} 条记录</span></div><div class="crm-actions">
          ${kind === 'leads' && hasPermission('crm:edit') ? action('bulk-import', '批量导入') : ''}${hasPermission('crm:export') ? action('export', '导出 Excel') : ''}${hasPermission('crm:edit') ? action('new', kind === 'leads' ? '录入线索' : '新建' + labels[kind], true) : ''}</div></div>
          <form id="crmFilters" class="crm-filters">
            <label>关键词<input name="q" type="search" maxlength="100" value="${esc(filter.q)}" placeholder="输入名称或联系方式"></label>
            ${stages[kind] ? '<label>阶段<select name="stage">' + options(stages[kind], filter.stage, '全部阶段') + '</select></label>' : ''}
            ${kind === 'leads' ? '<label>来源<select name="source">' + options({ ...sources, report: '报告领取（含历史白皮书）' }, filter.source, '全部来源') + '</select></label>' : ''}
            ${hasPermission('crm:all') ? '<label>负责人<select name="owner">' + options({ unassigned: '未分配', ...Object.fromEntries(state.owners.map(owner => [owner._id, owner.name])) }, filter.owner, '全部负责人') + '</select></label>' : ''}
            ${kind !== 'companies' ? '<label>标签<input name="tag" value="' + esc(filter.tag) + '" maxlength="32"></label>' : ''}
            ${stages[kind] ? '<label>跟进时间<select name="due">' + options({ overdue: '已逾期', scheduled: '已安排', none: '未安排' }, filter.due, '全部时间') + '</select></label>' : ''}
            <button type="submit">筛选</button>${action('reset', '重置')}
          </form>
          ${table(headers, info)}
          <div class="crm-pagination"><span>第 ${state.page} / ${pages} 页</span><div class="crm-actions">
            <button type="button" data-crm-action="prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
            <button type="button" data-crm-action="next" ${state.page >= pages ? 'disabled' : ''}>下一页</button>
          </div></div>
        </section>`;
    }
    function details(data) {
        const kind = state.tab, row = data.row;
        state.detail = data;
        const editable = hasPermission('crm:edit');
        const metadata = fields[kind].filter(([key]) => key !== 'name').map(([key, label, type]) => {
            const value = row[key];
            return [label, type === 'number' ? money(value) : ['date', 'datetime-local'].includes(type) ? when(value) : Array.isArray(value) ? value.join('、') : value];
        });
        metadata.unshift(['负责人', ownerName(row.ownerId)]);
        if (kind === 'leads') metadata.unshift(['来源', sources[row.source]], ['匹配提示', row.matchIssue], ['关闭原因', row.closeReason]);
        if (kind === 'opportunities') metadata.push(['实际成交金额', row.actualAmount == null ? '' : money(row.actualAmount)], ['成交日期', row.wonAt && when(row.wonAt)], ['输单原因', row.lossReason]);
        const related = [['leads', data.leads], ['contacts', data.contacts], ['opportunities', data.opportunities]];
        if (row.contactId) related.push(['contacts', [{ _id: row.contactId, name: '打开关联联系人' }]]);
        if (row.companyId) related.push(['companies', [{ _id: row.companyId, name: '打开关联公司' }]]);
        if (row.opportunityId) related.push(['opportunities', [{ _id: row.opportunityId, name: '打开已转商机' }]]);
        if (row.leadId) related.push(['leads', [{ _id: row.leadId, name: '打开来源线索' }]]);
        const linked = related.flatMap(([type, records]) => records.map(record => `<li>${viewButton(type, record)} <span class="crm-time">${labels[type]}${record.stage ? ' · ' + esc(stageLabel(type, record.stage)) : ''}</span></li>`));
        const events = data.events.map(event => `<li><strong>${esc(event.title)}</strong> <span class="crm-time">${esc(when(event.at))}</span>
          <p>${esc(sources[event.source] || event.source)}${event.sourcePage ? ' · ' + esc(event.sourcePage) : ''}</p>
          ${event.report ? '<p>' + esc(mailStatus[event.report.status] || '未安排邮件') + (event.report.opens ? ' · 报告已打开 ' + Number(event.report.opens) + ' 次' : '') + '</p>' : ''}
          ${event.url ? '<a href="' + esc(event.url) + '" target="_blank" rel="noopener">查看来源</a>' : ''}</li>`);
        const notes = data.activities.map(item => `<li><strong>${esc(channels[item.kind] || item.kind)}</strong> <span class="crm-time">${esc(item.actor)} · ${esc(when(item.createdAt))}</span><p>${esc(item.summary)}</p>
          ${item.nextStep ? '<p>下一步：' + esc(item.nextStep) + '</p>' : ''}${item.nextAt ? '<p>下次跟进：' + esc(when(item.nextAt)) + '</p>' : ''}</li>`);
        body.innerHTML = `<div class="crm-stack"><section class="crm-panel">
          <div class="crm-toolbar"><div>${action('back', '返回' + labels[kind])}<h2>${esc(row.name)}</h2>${row.stage ? '<span class="chip n">' + esc(stageLabel(kind, row.stage)) + '</span>' : ''}</div>
          <div class="crm-actions">
            ${editable ? action('edit', '编辑') + action('follow', '记录跟进', true) : ''}
            ${hasPermission('crm:assign') ? action('assign', '分配负责人') : ''}
            ${editable && kind === 'leads' && ['new','working'].includes(row.stage) ? action('convert', '转为商机') : ''}
            ${editable && ['companies','contacts'].includes(kind) ? action('archive', '归档') : ''}
            ${hasPermission('crm:merge') && hasPermission('crm:all') && ['companies','contacts'].includes(kind) ? action('merge', '合并重复档案') : ''}
            ${kind === 'contacts' && row.email && hasPermission('nqoc-report-leads:batch-send') ? action('marketing', '加入报告邮件名单') : ''}
          </div></div>
          <dl class="crm-meta">${metadata.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>').join('')}</dl>
        </section><div class="crm-details">
          <section class="crm-panel"><h3>跟进记录</h3>${notes.length ? '<ol class="crm-timeline">' + notes.join('') + '</ol>' : empty('暂未记录跟进')}</section>
          <section class="crm-panel"><h3>关联档案</h3>${linked.length ? '<ul class="crm-quick-list">' + linked.join('') + '</ul>' : empty('暂无关联档案')}</section>
        </div>${events.length || ['leads','contacts'].includes(kind) ? '<section class="crm-panel"><h3>提交与报告记录</h3>' + (events.length ? '<ol class="crm-timeline">' + events.join('') + '</ol>' : empty('暂无来源记录')) + '</section>' : ''}</div>`;
    }
    async function load() {
        const version = ++state.version;
        const tab = state.tab, id = state.id;
        state.detail = null;
        root.querySelectorAll('[data-crm-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.crmTab === tab)));
        body.innerHTML = empty('正在加载…');
        try {
            const path = tab === 'dashboard' ? '/dashboard' : id ? '/' + tab + '/' + encodeURIComponent(id) :
                '/' + tab + '?' + new URLSearchParams({ ...state.filters, page: state.page });
            const data = await api(path);
            if (version !== state.version) return;
            if (tab === 'dashboard') dashboard(data);
            else if (id) details(data);
            else listing(data);
        } catch (error) {
            if (version === state.version) body.innerHTML = `<p class="crm-error">${esc(error.message)}</p>${action(id ? 'back' : 'reload', id ? '返回列表' : '重试')}`;
        }
    }
    window.crmLoad = async () => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (Object.hasOwn(labels, tab)) state.tab = tab;
        else { state.tab = 'dashboard'; state.filters = {}; state.page = 1; }
        state.id = /^[0-9a-f]{24}$/i.test(params.get('record') || '') ? params.get('record') : '';
        try {
            const data = await api('/meta');
            state.owners = data.owners;
            state.sync = data.sync;
        } catch (error) { body.innerHTML = empty(error.message); }
        return load();
    };
    function field([key, label, type = 'text', required], value) {
        let normalized = value ?? '';
        if (value && type === 'datetime-local') {
            const time = new Date(value);
            normalized = new Date(time.getTime() - time.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
        if (value && type === 'date') normalized = String(value).slice(0, 10);
        if (Array.isArray(value)) normalized = value.join(', ');
        const attributes = ' name="' + esc(key) + '"' + (required ? ' required' : '');
        return `<label${type === 'textarea' ? ' class="crm-wide"' : ''}>${esc(label)}${type === 'textarea' ?
            '<textarea' + attributes + ' rows="3" maxlength="2000">' + esc(normalized) + '</textarea>' :
            '<input' + attributes + ' type="' + type + '" value="' + esc(normalized) + '"' + (type === 'number' ? ' min="0" step="0.01"' : ' maxlength="500"') + '>'}</label>`;
    }
    function picker(kind, name, selected, label = labels[kind]) {
        return `<div class="crm-picker" data-picker="${kind}"><label>搜索${label}<input type="search" data-crm-picker-search placeholder="输入名称查询" autocomplete="off"></label>
          <label>${label}<select name="${name}"><option value="">请选择</option>${selected ? '<option selected value="' + esc(selected) + '">当前关联</option>' : ''}</select></label></div>`;
    }
    async function fillPicker(node) {
        const search = node.querySelector('input');
        const select = node.querySelector('select');
        const request = String(Number(node.dataset.request || 0) + 1);
        node.dataset.request = request;
        const data = await api('/' + node.dataset.picker + '?' + new URLSearchParams({ q: search.value }));
        if (!node.isConnected || request !== node.dataset.request) return;
        const current = select.value;
        const entries = Object.fromEntries(data.rows.map(row => [row._id, row.name]));
        if (current && !Object.hasOwn(entries, current)) entries[current] = '当前关联';
        select.innerHTML = options(entries, current, '请选择');
    }
    function openForm(title, contents, submit, confirmation = '保存') {
        dialog.classList.toggle('crm-import-dialog', confirmation === '预览 Excel');
        $('crmDialogTitle').textContent = title;
        $('crmFields').innerHTML = contents;
        $('crmFormError').textContent = '';
        $('crmSave').textContent = confirmation;
        $('crmSave').disabled = false;
        state.submit = submit;
        dialog.showModal();
        $('crmFields').querySelectorAll('[data-picker]').forEach(node => fillPicker(node).catch(error => { $('crmFormError').textContent = error.message; }));
    }
    function entityForm(kind, row = {}, convert = false) {
        const editing = !!row._id && !convert;
        const values = convert ? { contactId: row.contactId, companyId: row.companyId, summary: row.summary } : row;
        const controls = fields[kind].map(config => field(config, values[config[0]])).join('');
        const manual = kind === 'leads' && !editing ? '<label>来源<select name="source" required>' +
            options({ manual: sources.manual, event: sources.event, referral: sources.referral, inbound: sources.inbound }, 'manual') + '</select></label>' : '';
        const associates = kind === 'companies' ? '' : picker('companies', 'companyId', values.companyId) +
            (kind !== 'contacts' ? picker('contacts', 'contactId', values.contactId) : '');
        const stageControls = editing && stages[kind] ? '<label>阶段<select name="stage">' + options(
            kind === 'leads' ? Object.fromEntries(Object.entries(stages.leads).filter(([stage]) => row.stage === 'converted' ? stage === 'converted' : stage !== 'converted')) : stages[kind],
            row.stage) + '</select></label>' +
            (kind === 'leads' ? field(['closeReason', '关闭原因'], row.closeReason) :
                field(['lossReason', '输单原因'], row.lossReason) + field(['actualAmount', '实际成交金额（元）', 'number'], row.actualAmount) + field(['wonAt', '成交日期', 'date'], row.wonAt)) : '';
        const key = crypto.randomUUID();
        let acknowledgedMatch = '';
        openForm(convert ? '线索转为商机' : (editing ? '编辑' : '新建') + labels[kind], controls + manual + associates + stageControls, async payload => {
            if (!editing && ['leads','companies','contacts'].includes(kind) && !payload.contactId) {
                const match = await api('/matches', { phone: payload.phone, email: payload.email, companyName: kind === 'companies' ? payload.name : payload.companyName }, 'POST');
                if (kind === 'leads' && match.contacts.length) {
                    const signature = match.contacts.map(contact => contact._id).sort().join(',');
                    if (acknowledgedMatch !== signature) {
                        acknowledgedMatch = signature;
                        throw new Error('匹配到已有联系人：' + match.contacts.map(contact => contact.name).join('、') + '。可在关联项选择，或核对后再次保存。');
                    }
                }
                if (kind === 'contacts' && match.contacts.length) throw new Error('已有相同联系方式，请先查看联系人：' + match.contacts.map(contact => contact.name).join('、'));
                if (kind === 'companies' && match.company) throw new Error('已有同名公司，请先查看公司档案：' + match.company.name);
            }
            const url = convert ? '/leads/' + row._id + '/convert' : '/' + kind + (editing ? '/' + row._id : '');
            const data = await api(url, { ...payload, key }, editing ? 'PUT' : 'POST');
            dialog.close();
            await navigate(kind, data.row._id);
        });
    }
    async function exportRows() {
        const response = await fetch('/api/admin/crm/' + state.tab + '/export?' + new URLSearchParams(state.filters), { headers: authHeaders() });
        if (!response.ok) throw new Error((await response.json()).error || '导出失败');
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = 'crm-' + state.tab + '.xlsx';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function importTemplate() {
        const response = await fetch('/api/admin/crm/leads/import-template', { headers: authHeaders() });
        if (!response.ok) throw new Error((await response.json()).error || '模板下载失败');
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = 'CRM线索导入模板.xlsx';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function bulkRequest(action, fields) {
        const payload = new FormData();
        for (const [key, value] of Object.entries(fields)) payload.append(key, value);
        const headers = new Headers(authHeaders());
        headers.delete('Content-Type');
        return json('/api/admin/crm/leads/import-' + action, { method: 'POST', headers, body: payload });
    }
    function importRows(rows) {
        return table(['Excel 行号', '姓名 / 公司', '联系方式', '处理结果'], rows.map(row => [
            String(row.line),
            esc(row.name || '—') + (row.company ? '<span class="sub">' + esc(row.company) + '</span>' : ''),
            esc(row.phone || '—') + (row.email ? '<span class="sub">' + esc(row.email) + '</span>' : ''),
            esc(row.message)
        ]));
    }
    function bulkImportForm() {
        let stage = 'upload', snapshot;
        const contents = `<div id="crmImportFields" class="crm-wide crm-form-grid crm-import-fields">
            <div class="crm-wide crm-toolbar"><p class="sub">填写「线索」工作表，姓名必填，手机号和邮箱至少填一项。支持 .xlsx，每次最多 500 行、512 KB。</p>
              ${action('import-template', '下载 Excel 模板')}</div>
            <label>批次名称<input name="label" required maxlength="80" placeholder="例如：11 月组织诊断沙龙"></label>
            <label>线索来源<select name="source" required>${options({ event: sources.event, manual: sources.manual, referral: sources.referral, inbound: sources.inbound }, 'event')}</select></label>
            <label class="crm-wide">Excel 文件<input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required></label>
          </div><div id="crmImportResult" class="crm-wide crm-import-result" hidden></div>`;
        const setResult = html => {
            $('crmImportFields').hidden = true;
            const result = $('crmImportResult');
            result.hidden = false;
            result.innerHTML = html;
        };
        const reset = () => {
            stage = 'upload';
            $('crmImportFields').hidden = false;
            $('crmImportResult').hidden = true;
            $('crmSave').textContent = '预览 Excel';
        };
        openForm('批量导入线索', contents, async values => {
            if (stage === 'done') { dialog.close(); return; }
            if (stage === 'invalid') { reset(); return; }
            if (stage === 'upload') {
                snapshot = { file: values.file, source: values.source, label: values.label };
                const data = await bulkRequest('preview', snapshot);
                snapshot.previewToken = data.token;
                const ready = Number(data.ready);
                const tableHtml = importRows(data.rows);
                setResult(`<p class="crm-import-count" role="status"><strong>可导入 ${ready} 条</strong> · 其他 ${data.rows.length - ready} 条</p>
                    <p class="sub">请核对行号、联系方式和处理结果。确认后，导入的线索将分配给当前账号。</p>${ready ? '<button type="button" id="crmImportBack">返回修改</button>' : ''}${tableHtml}`);
                $('crmImportBack')?.addEventListener('click', () => { if (!$('crmSave').disabled) reset(); });
                stage = ready ? 'preview' : 'invalid';
                $('crmSave').textContent = ready ? '确认导入 ' + ready + ' 条' : '返回修改';
                return;
            }
            const result = await bulkRequest('confirm', snapshot);
            setResult(`<p class="crm-import-count" role="status"><strong>本次导入 ${Number(result.imported)} 条</strong> · 已导入 ${Number(result.already)} 条 · 跳过 ${Number(result.skipped)} 条 · 失败 ${Number(result.failed)} 条</p>
                ${result.failed ? '<p class="sub">写入失败的记录可直接重试，已成功记录会保留。</p>' : ''}${importRows(result.rows)}`);
            stage = result.failed ? 'preview' : 'done';
            $('crmSave').textContent = result.failed ? '重试失败记录' : '完成';
            await load();
        }, '预览 Excel');
    }

    const actions = {
        back: () => navigate(state.tab), reload: load,
        unassigned: () => { state.tab = 'leads'; state.filters = { owner: 'unassigned' }; state.page = 1; return navigate('leads'); },
        'new-lead': () => entityForm('leads'), new: () => entityForm(state.tab),
        edit: () => entityForm(state.tab, state.detail.row),
        reset: () => { state.filters = {}; state.page = 1; return load(); },
        prev: () => { state.page -= 1; return load(); }, next: () => { state.page += 1; return load(); },
        export: exportRows, 'bulk-import': bulkImportForm, 'import-template': importTemplate, convert: () => entityForm('opportunities', state.detail.row, true),
        assign: () => openForm('分配负责人', '<label class="crm-wide">负责人<select name="ownerId">' +
            options(Object.fromEntries(state.owners.map(owner => [owner._id, owner.name])), state.detail.row.ownerId, '未分配') + '</select></label>',
            async payload => { await api('/' + state.tab + '/' + state.id + '/assign', payload, 'POST'); dialog.close(); await navigate(state.tab); }, '确认分配'),
        follow: () => openForm('记录跟进', '<label>沟通方式<select name="channel">' + options({ phone: '电话', wechat: '微信', email: '邮件', meeting: '会议', other: '其他' }, 'phone') +
            '</select></label>' + field(['summary', '沟通结果', 'textarea', true]) + field(['nextStep', '下一步']) + field(['nextAt', '下次跟进', 'datetime-local']) +
            '<p class="sub crm-wide">留空下次跟进时间可结束当前待办；填写时间会更新工作台待办。</p>',
            async payload => { await api('/' + state.tab + '/' + state.id + '/follow-up', payload, 'POST'); dialog.close(); await load(); }),
        archive: () => openForm('归档档案', '<p class="crm-wide">确认后会从当前列表移除；关联记录和历史仍会保留。</p>',
            async () => { await api('/' + state.tab + '/' + state.id + '/archive', {}, 'POST'); dialog.close(); await navigate(state.tab); }, '确认归档'),
        merge: () => openForm('合并重复档案', picker(state.tab, 'targetId', '', '要保留的档案') + '<p class="crm-wide">关联和历史将移至保留档案，请核对后确认。</p>',
            async payload => { const data = await api('/' + state.tab + '/' + state.id + '/merge', payload, 'POST'); dialog.close(); await navigate(state.tab, data.row._id); }, '确认合并'),
        marketing: () => openForm('加入报告邮件名单', field(['basis', '报告发放依据', 'textarea', true]) +
            '<label class="crm-check crm-wide"><input type="checkbox" name="confirmed" required>已核实对方申请了报告，或活动已约定提供报告</label>',
            async payload => { await api('/contacts/' + state.id + '/marketing', { ...payload, confirmed: payload.confirmed === 'on' }, 'POST'); dialog.close(); toast('已加入 CRM 联系人名单，请在邮件营销中确认发送'); }, '加入名单')
    };
    root.addEventListener('click', event => {
        const tab = event.target.closest('[data-crm-tab]');
        if (tab) return navigate(tab.dataset.crmTab);
        const open = event.target.closest('[data-crm-open]');
        if (open) return navigate(open.dataset.crmOpen, open.dataset.id);
        if (event.target.closest('[data-crm-close]')) { if (!$('crmSave').disabled) dialog.close(); return; }
        const button = event.target.closest('[data-crm-action]');
        if (button) Promise.resolve().then(() => actions[button.dataset.crmAction]()).catch(error => toast(error.message));
    });
    root.addEventListener('submit', async event => {
        event.preventDefault();
        if (event.target.id === 'crmFilters') {
            state.filters = Object.fromEntries(new FormData(event.target));
            state.page = 1;
            await load();
        } else if (event.target === form && !$('crmSave').disabled) {
            const values = Object.fromEntries(new FormData(form));
            if (values.nextAt) values.nextAt = new Date(values.nextAt).toISOString();
            $('crmSave').disabled = true;
            $('crmFormError').textContent = '';
            try { await state.submit(values); }
            catch (error) { $('crmFormError').textContent = error.message; }
            finally { $('crmSave').disabled = false; }
        }
    });
    dialog.addEventListener('cancel', event => { if ($('crmSave').disabled) event.preventDefault(); });
    form.addEventListener('input', event => {
        if (!event.target.matches('[data-crm-picker-search]')) return;
        const picker = event.target.closest('[data-picker]');
        clearTimeout(picker.searchTimer);
        picker.searchTimer = setTimeout(() => fillPicker(picker).catch(error => { $('crmFormError').textContent = error.message; }), 250);
    });
    if (root.classList.contains('active')) window.crmLoad();
})();
