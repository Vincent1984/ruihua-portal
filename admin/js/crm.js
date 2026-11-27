(() => {
    const root = document.querySelector('[data-view="crm"]');
    if (!root) return;
    const $ = id => document.getElementById(id);
    const body = $('crmBody'), dialog = $('crmDialog'), form = $('crmForm');
    const labels = { dashboard: '工作台', leads: '线索', companies: '公司', contacts: '联系人', opportunities: '商机' };
    const stages = {
        leads: { new: '待处理', working: '跟进中', nurture: '待培育', converted: '已转商机', closed: '已关闭' },
        opportunities: { demand: '需求确认', proposal: '方案沟通', quote: '报价谈判', won: '赢单', lost: '输单' }
    };
    const qualifications = { lead: '普通线索', mql: '营销合格', sql: '销售合格' };
    const gradeBadge = level => {
        const key = Object.hasOwn(qualifications, level) ? level : 'lead';
        return '<span class="crm-grade crm-grade-' + key + '">' + key.toUpperCase() + '</span>';
    };
    const sources = { appointment: '官网预约', report: '报告领取', 'legacy-whitepaper': '历史白皮书领取', whitepaper: '官网白皮书',
        survey: '新质组织调研', manual: '日常录入', event: '线下活动', referral: '转介绍', inbound: '来电 / 来访' };
    const channels = { phone: '电话', wechat: '微信', email: '邮件', meeting: '会议', other: '其他',
        assign: '分配', stage: '阶段变更', convert: '线索转化', create: '创建', merge: '合并', archive: '归档' };
    const mailStatus = { pending: '待发送', sending: '发送中', accepted: '邮件服务已接收', failed: '发送失败', uncertain: '结果待核实', cancelled: '已取消' };
    const fields = {
        leads: [['name', '姓名或称呼', 'text', true], ['companyName', '公司或机构'], ['companyAlias', '公司简称'], ['phone', '电话', 'tel'], ['email', '邮箱', 'email'],
            ['summary', '需求摘要', 'textarea'], ['tags', '标签（逗号分隔）'], ['nextStep', '下一步'], ['nextAt', '下次跟进', 'datetime-local']],
        companies: [['name', '公司名称', 'text', true], ['alias', '简称'], ['industry', '行业'], ['region', '地区'], ['website', '官网', 'url'], ['notes', '备注', 'textarea']],
        contacts: [['name', '姓名或称呼', 'text', true], ['phone', '电话', 'tel'], ['email', '邮箱', 'email'], ['position', '职位'],
            ['department', '部门'], ['tags', '标签（逗号分隔）'], ['notes', '备注', 'textarea']],
        opportunities: [['name', '商机名称', 'text', true], ['direction', '服务方向'], ['summary', '需求与项目说明', 'textarea'],
            ['expectedAmount', '预计金额（元）', 'number'], ['expectedAt', '预计成交日期', 'date'], ['tags', '标签（逗号分隔）'],
            ['nextStep', '下一步'], ['nextAt', '下次跟进', 'datetime-local']]
    };
    const state = { tab: 'dashboard', id: '', page: 1, filters: {}, owners: [], version: 0, detail: null, days: 30, dashboardScope: 'team' };
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
    const count = value => Number(value || 0).toLocaleString('zh-CN');
    const shortDay = date => date.slice(5).replace('-', '/');
    function dashboardDrill(kind, label, filter = {}, className = '') {
        return `<button type="button" class="${className}" data-crm-drill="${kind}" data-filter="${esc(JSON.stringify(filter))}">${label}</button>`;
    }
    function dashboard(data) {
        const gradeCounts = Object.fromEntries(data.grades.map(row => [row._id, row.count]));
        const gradeTotal = Object.values(gradeCounts).reduce((sum, value) => sum + value, 0);
        const pipeline = Object.fromEntries(data.grouped.map(row => [row._id, row]));
        const open = ['demand', 'proposal', 'quote'].reduce((total, key) => total + (pipeline[key]?.count || 0), 0);
        const expectedMoney = ['demand', 'proposal', 'quote'].reduce((total, key) => total + (pipeline[key]?.expected || 0), 0);
        const totalArrivals = data.trend.reduce((sum, row) => sum + row.count, 0);
        const groupSize = Math.ceil(data.trend.length / 15);
        const bars = [];
        for (let index = 0; index < data.trend.length; index += groupSize) {
            const period = data.trend.slice(index, index + groupSize);
            const a = shortDay(period[0].date), b = shortDay(period.at(-1).date);
            bars.push({ date: a === b ? a : a + '–' + b, count: period.reduce((sum, day) => sum + day.count, 0) });
        }
        const peak = Math.max(1, ...bars.map(bar => bar.count));
        const follow = [...data.leads.map(row => ({ ...row, kind: 'leads' })), ...data.opportunities.map(row => ({ ...row, kind: 'opportunities' }))]
            .sort((a, b) => new Date(a.nextAt) - new Date(b.nextAt)).slice(0, 12);
        const dueRows = follow.map(row => `<li><div>${viewButton(row.kind, row)}<span class="crm-time">${esc(labels[row.kind])}${row.nextStep ? ' · ' + esc(row.nextStep) : ''}</span></div>
          <div class="crm-dash-task-date"><span class="${new Date(row.nextAt) < new Date() ? 'crm-overdue' : ''}">${new Date(row.nextAt) < new Date() ? '已逾期' : '今日到期'}</span><time datetime="${esc(row.nextAt)}">${esc(when(row.nextAt))}</time></div></li>`);
        const expected = data.expected.slice(0, 8).map(row => `<li><div>${viewButton('opportunities', row)}<span class="crm-time">${esc(when(row.expectedAt))}</span></div><strong>${esc(money(row.expectedAmount))}</strong></li>`);
        const barsFor = (value, max) => `<span class="crm-dash-track" aria-hidden="true"><span style="width:${max ? Math.round(100 * value / max) : 0}%"></span></span>`;
        const lifeStages = [
            ...Object.entries(qualifications).map(([key, name]) => ({
                key, label: key === 'lead' ? 'Lead' : key.toUpperCase(), name, value: gradeCounts[key],
                kind: 'leads', filter: { qualification: key, pool: 'open' }
            })),
            { key: 'opp', label: 'OPP', name: '在跟商机', value: open, kind: 'opportunities', filter: { pool: 'open' } },
            { key: 'won', label: 'Closed Won', name: '赢单', value: pipeline.won?.count, kind: 'opportunities', filter: { stage: 'won' } },
            { key: 'lost', label: 'Closed Lost', name: '输单', value: pipeline.lost?.count, kind: 'opportunities', filter: { stage: 'lost' } }
        ];
        const lifecycle = lifeStages.map(item => dashboardDrill(item.kind,
            `<span class="crm-life-stage">${esc(item.label)}</span><strong>${count(item.value)}</strong><span class="crm-life-caption">${esc(item.name)}</span>`,
            item.filter, 'crm-life-step crm-life-' + item.key));
        const highestSource = Math.max(1, ...data.sources.map(row => row.count));
        const sourceRows = data.sources.map(row => {
            const label = row._id === 'report' ? '报告领取（含历史白皮书）' : sources[row._id] || row._id;
            return dashboardDrill('leads',
                `<span>${esc(label)}${barsFor(row.count, highestSource)}</span><strong>${count(row.count)}</strong><span class="crm-time">转商机 ${count(row.converted)}</span>`,
                { source: row._id, receivedDays: data.days }, 'crm-dash-source-row');
        });
        const largestStage = Math.max(1, ...data.grouped.map(row => row.count));
        const dealRows = Object.entries(stages.opportunities).map(([key, name]) => dashboardDrill('opportunities',
            `<span>${esc(name)}${barsFor(pipeline[key]?.count || 0, largestStage)}</span><strong>${count(pipeline[key]?.count)}</strong>
              <span class="crm-time">${key === 'lost' ? '—' : esc(money(key === 'won' ? pipeline[key]?.actual : pipeline[key]?.expected))}</span>`,
            { stage: key }, 'crm-dash-source-row crm-pipeline-' + key));
        const kpi = (label, value, sub, link) => `<article class="crm-dash-kpi"><h3>${label}</h3><strong>${value}</strong><div>${sub}${link || ''}</div></article>`;
        const scopes = hasPermission('crm:all') ? `<div class="crm-dash-toggle" role="group" aria-label="数据范围">
          <button type="button" data-crm-scope="team" aria-pressed="${data.scope === 'team'}">全部</button>
          <button type="button" data-crm-scope="mine" aria-pressed="${data.scope === 'mine'}">我负责的</button></div>` : '';
        body.innerHTML = `<div class="crm-dashboard">
          <header class="crm-dash-hero"><div><p>${esc(data.scope === 'team' ? '全部团队' : '我负责的记录')}</p><h2>跟进工作台</h2>
            <p>${esc(data.trend.at(-1).date)} · 北京时间${state.sync?.completedAt && data.scope === 'team' ? ' · 官网同步 ' + esc(new Date(state.sync.completedAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })) : ''}</p></div>
            <div class="crm-dash-hero-actions">${scopes}${hasPermission('crm:edit') ? action('skill-connect', '连接 CRM 技能') + action('new-lead', '录入线索', true) : ''}</div></header>
          <div class="crm-dash-kpis">
            ${kpi('今日新增线索', count(data.received), '待处理 ' + count(data.pending) + ' 条', dashboardDrill('leads', '查看待处理', { stage: 'new' }, 'crm-dash-kpi-link'))}
            ${kpi('今日到期跟进', count(data.todayFollow), '逾期 ' + count(data.overdue) + ' 条', dashboardDrill('leads', '查看逾期线索', { due: 'overdue' }, 'crm-dash-kpi-link'))}
            ${kpi('在跟商机（OPP）', count(open), '预计 ' + esc(money(expectedMoney)), dashboardDrill('opportunities', '查看商机', { pool: 'open' }, 'crm-dash-kpi-link'))}
            ${kpi('累计实际赢单', esc(money(pipeline.won?.actual ?? 0)), count(pipeline.won?.count) + ' 个赢单', dashboardDrill('opportunities', '查看赢单', { stage: 'won' }, 'crm-dash-kpi-link'))}
          </div>
          <section class="crm-panel crm-dash-panel crm-life-panel">
            <header class="crm-dash-heading">
              <div><h3>销售生命周期</h3><p>未结束线索 ${count(gradeTotal)} 条 · 商机按项目计数</p></div>
              ${data.unassigned != null ? dashboardDrill('leads', '未分配 ' + count(data.unassigned) + ' 条', { owner: 'unassigned', pool: 'assignedWork' }, 'crm-dash-unassigned') : ''}
            </header>
            <div class="crm-life-grid">${lifecycle.join('')}</div>
          </section>
          <div class="crm-dash-grid crm-dash-main">
            <section class="crm-panel crm-dash-panel">
              <header class="crm-dash-heading"><div><h3>线索新增趋势</h3><p>近 ${data.days} 天新增 <strong>${count(totalArrivals)}</strong> 条</p></div>
                <div class="crm-dash-toggle" role="group" aria-label="统计周期">${[7, 30, 90].map(days => `<button type="button" data-crm-period="${days}" aria-pressed="${data.days === days}">${days} 天</button>`).join('')}</div></header>
              <div class="crm-dash-chart" style="--columns:${bars.length}" aria-label="线索新增趋势图">${bars.map((bar, index) => `<button type="button" class="crm-dash-bar" data-crm-bar="${index}" data-date="${esc(bar.date)}" data-count="${bar.count}" style="--height:${Math.round(100 * bar.count / peak)}%" aria-label="${esc(bar.date)}，新增 ${bar.count} 条" title="${esc(bar.date)} · ${count(bar.count)} 条" aria-pressed="${index === bars.length - 1}"><span></span></button>`).join('')}</div>
              <div class="crm-dash-axis"><span>${esc(shortDay(data.trend[0].date))}</span><output id="crmTrendSelection">${esc(bars.at(-1).date)} · ${count(bars.at(-1).count)} 条</output><span>${esc(shortDay(data.trend.at(-1).date))}</span></div>
            </section>
            <section class="crm-panel crm-dash-panel"><header class="crm-dash-heading"><div><h3>商机各阶段</h3><p>按项目数量展示 · 金额为预计或实际成交金额</p></div></header>
              <div class="crm-dash-source-list">${dealRows.join('')}</div></section>
          </div>
          <div class="crm-dash-grid">
            <section class="crm-panel crm-dash-panel"><header class="crm-dash-heading"><div><h3>今日与逾期跟进</h3><p>线索和商机按下次跟进时间排列</p></div>${dashboardDrill('opportunities', '查看逾期商机', { due: 'overdue' }, 'crm-dash-kpi-link')}</header>
              ${dueRows.length ? '<ul class="crm-dash-task">' + dueRows.join('') + '</ul>' : empty('暂无到期跟进')}</section>
            <section class="crm-panel crm-dash-panel"><header class="crm-dash-heading"><div><h3>线索来源与转化</h3><p>近 ${data.days} 天新增线索及其中已转商机数</p></div></header>
              ${sourceRows.length ? '<div class="crm-dash-source-list">' + sourceRows.join('') + '</div>' : empty('该周期暂无新增线索')}</section>
            <section class="crm-panel crm-dash-panel crm-dash-expected"><header class="crm-dash-heading"><h3>未来 30 天预计成交</h3></header>
              ${expected.length ? '<ul class="crm-dash-task">' + expected.join('') + '</ul>' : empty('暂无预计成交的商机')}</section>
          </div>
        </div>`;
    }

    function listing(data) {
        const kind = state.tab, filter = state.filters;
        const headers = {
            leads: ['姓名 / 公司', '联系方式', '来源', '线索等级', '跟进状态', '负责人', '下次跟进'],
            companies: ['名称 / 简称', '行业', '地区', '负责人'],
            contacts: ['姓名 / 职位', '公司', '联系方式', '负责人'],
            opportunities: ['项目 / 服务方向', '公司', '阶段', '金额', '负责人', '下次跟进']
        }[kind];
        const stack = (first, second) => `<div>${first || '—'}</div>${second ? '<span class="sub">' + esc(second) + '</span>' : ''}`;
        const info = data.rows.map(row => {
            const stage = esc(stageLabel(kind, row.stage)), owner = esc(ownerName(row.ownerId));
            if (kind === 'leads') return [stack(viewButton(kind, row), row.company), stack(esc(row.phone), row.email), esc(sources[row.source] || row.source), gradeBadge(row.qualification), stage + (row.matchIssue ? '<span class="sub">资料待核实</span>' : ''), owner, esc(when(row.nextAt))];
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
            ${kind === 'leads' ? '<label>线索等级<select name="qualification">' + options({ lead: 'Lead · 普通线索', mql: 'MQL · 营销合格', sql: 'SQL · 销售合格' }, filter.qualification, '全部等级') + '</select></label>' : ''}
            ${kind === 'leads' ? '<label>来源<select name="source">' + options({ ...sources, report: '报告领取（含历史白皮书）' }, filter.source, '全部来源') + '</select></label>' : ''}
            ${hasPermission('crm:all') ? '<label>负责人<select name="owner">' + options({ unassigned: '未分配', ...Object.fromEntries(state.owners.map(owner => [owner._id, owner.name])) }, filter.owner, '全部负责人') + '</select></label>' : ''}
            ${kind !== 'companies' ? '<label>标签<input name="tag" value="' + esc(filter.tag) + '" maxlength="32"></label>' : ''}
            ${stages[kind] ? '<label>跟进时间<select name="due">' + options({ overdue: '已逾期', today: '今日到期', scheduled: '已安排', none: '未安排' }, filter.due, '全部时间') + '</select></label>' : ''}
            <button type="submit">筛选</button>${action('reset', '重置')}
          </form>
          ${filter.pool || filter.receivedDays ? '<p class="sub">当前范围：' + [filter.pool ? (filter.pool === 'assignedWork' ? '待处理和跟进中' : kind === 'leads' ? '未结束线索' : '在跟商机') : '', filter.receivedDays ? '近 ' + Number(filter.receivedDays) + ' 天新增' : ''].filter(Boolean).join(' · ') + '</p>' : ''}
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
        if (kind === 'leads') metadata.unshift(['来源', sources[row.source]], ['匹配提示', row.matchIssue], ['状态说明', row.closeReason]);
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
        const qualificationHistory = (data.qualificationHistory || []).map(change =>
            `<li><strong>${esc(change.from.toUpperCase())} → ${esc(change.to.toUpperCase())}</strong>
              <span class="crm-time">${esc(change.actor)} · ${esc(when(change.at))}</span><p>${esc(change.reason)}</p>
              ${change.nextStep ? '<p>下一步：' + esc(change.nextStep) + '</p>' : ''}</li>`);
        const notes = data.activities.map(item => `<li><strong>${esc(channels[item.kind] || item.kind)}</strong> <span class="crm-time">${esc(item.actor)} · ${esc(when(item.createdAt))}</span><p>${esc(item.summary)}</p>
          ${item.nextStep ? '<p>下一步：' + esc(item.nextStep) + '</p>' : ''}${item.nextAt ? '<p>下次跟进：' + esc(when(item.nextAt)) + '</p>' : ''}</li>`);
        body.innerHTML = `<div class="crm-stack"><section class="crm-panel">
          <div class="crm-toolbar"><div>${action('back', '返回' + labels[kind])}<h2>${esc(row.name)}</h2>${kind === 'leads' ? gradeBadge(row.qualification) + ' ' : ''}${row.stage ? '<span class="chip n">' + esc(stageLabel(kind, row.stage)) + '</span>' : ''}</div>
          <div class="crm-actions">
            ${editable ? action('edit', '编辑') + action('follow', '记录跟进', true) : ''}
            ${hasPermission('crm:assign') ? action('assign', '分配负责人') : ''}
            ${editable && kind === 'leads' && ['new','working','nurture'].includes(row.stage) ? action('qualification', '调整线索等级') : ''}
            ${editable && kind === 'leads' && row.qualification === 'sql' && ['new','working','nurture'].includes(row.stage) ? action('convert', '转为商机') : ''}
            ${editable && ['companies','contacts'].includes(kind) ? action('archive', '归档') : ''}
            ${hasPermission('crm:merge') && hasPermission('crm:all') && ['companies','contacts'].includes(kind) ? action('merge', '合并重复档案') : ''}
            ${kind === 'contacts' && row.email && hasPermission('nqoc-report-leads:batch-send') ? action('marketing', '加入报告邮件名单') : ''}
          </div></div>
          <dl class="crm-meta">${metadata.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>').join('')}</dl>
        </section><div class="crm-details">
          <section class="crm-panel"><h3>跟进记录</h3>${notes.length ? '<ol class="crm-timeline">' + notes.join('') + '</ol>' : empty('暂未记录跟进')}</section>
          <section class="crm-panel"><h3>关联档案</h3>${linked.length ? '<ul class="crm-quick-list">' + linked.join('') + '</ul>' : empty('暂无关联档案')}</section>
        </div>
        ${kind === 'leads' ? '<section class="crm-panel"><h3>线索等级记录</h3>' + (qualificationHistory.length ? '<ol class="crm-timeline">' + qualificationHistory.join('') + '</ol>' : empty('暂无线索等级调整')) + '</section>' : ''}
        ${events.length || ['leads','contacts'].includes(kind) ? '<section class="crm-panel"><h3>提交与报告记录</h3>' + (events.length ? '<ol class="crm-timeline">' + events.join('') + '</ol>' : empty('暂无来源记录')) + '</section>' : ''}</div>`;
    }
    async function load() {
        const version = ++state.version;
        const tab = state.tab, id = state.id;
        state.detail = null;
        root.querySelectorAll('[data-crm-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.crmTab === tab)));
        body.innerHTML = empty('正在加载…');
        try {
            const path = tab === 'dashboard' ? '/dashboard?' + new URLSearchParams({ days: state.days, scope: state.dashboardScope }) : id ? '/' + tab + '/' + encodeURIComponent(id) :
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
            state.companyLookup = data.companyLookup === true;
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
    function companyLookupField(config, value, kind) {
        return `<div class="crm-company-lookup crm-wide" data-company-lookup="${kind}">
          <div class="crm-company-query">${field(config, value)}
            <button type="button" data-company-search>查询全称</button></div>
          <div data-company-results aria-live="polite"></div>
        </div>`;
    }
    function companySourceLinks(sources) {
        return sources.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>`).join('');
    }
    async function lookupCompanyField(button) {
        const box = button.closest('[data-company-lookup]');
        const input = box.querySelector('input');
        const results = box.querySelector('[data-company-results]');
        const query = input.value.trim();
        if (!query) { results.textContent = '请先填写公司简称或名称。'; input.focus(); return; }
        button.disabled = true;
        results.textContent = '正在查询公开网页…';
        try {
            const data = await api('/companies/lookup-name', { name: query }, 'POST');
            if (!box.isConnected || !dialog.open || input.value.trim() !== query) return;
            box.lookup = { query, candidates: data.candidates };
            results.innerHTML = data.candidates.length ? `<div class="crm-company-results">
                <p class="sub">以下为公开网页候选，请核对来源后选择企业主体。</p>
                <ul>${data.candidates.map((item, index) => `<li><div><strong>${esc(item.name)}</strong>
                  ${item.companyId ? '<span class="sub">CRM 已有公司</span>' : ''}
                  <div class="crm-company-sources">${companySourceLinks(item.sources)}</div>
                  ${item.sources[0]?.snippet ? '<p class="sub">' + esc(item.sources[0].snippet) + '</p>' : ''}
                </div><button type="button" data-company-choice="${index}">使用此名称</button></li>`).join('')}</ul>
              </div>` : `<div class="crm-company-results"><p class="sub">未提取到明确的全称候选。可加上地区后再查，或核对网页并手动填写。</p>
                <div class="crm-company-sources">${companySourceLinks(data.references)}</div></div>`;
        } catch (err) {
            if (box.isConnected && dialog.open && input.value.trim() === query) results.textContent = err.message;
        } finally {
            button.disabled = false;
        }
    }
    function applyCompanyCandidate(button) {
        if ($('crmSave').disabled) return;
        const box = button.closest('[data-company-lookup]');
        const input = box.querySelector('input');
        const picked = box.lookup?.candidates[Number(button.dataset.companyChoice)];
        if (!picked || input.value.trim() !== box.lookup.query) return;
        const lead = box.dataset.companyLookup === 'leads';
        const alias = form.elements.namedItem(lead ? 'companyAlias' : 'alias');
        if (alias && !alias.value && picked.name !== box.lookup.query) alias.value = box.lookup.query;
        input.value = picked.name;
        const company = lead && form.elements.namedItem('companyId');
        if (company && picked.companyId) {
            if (![...company.options].some(option => option.value === picked.companyId)) company.add(new Option(picked.name, picked.companyId));
            company.value = picked.companyId;
        }
        const results = box.querySelector('[data-company-results]');
        results.innerHTML = `<div class="crm-company-results"><p>已选全称：${esc(picked.name)}${company && picked.companyId ? '（已选中 CRM 公司）' : ''}</p>
          <div class="crm-company-sources">${companySourceLinks(picked.sources)}${!lead && picked.companyId ?
            '<a target="_blank" rel="noopener" href="/admin/crm?tab=companies&record=' + encodeURIComponent(picked.companyId) + '">查看已有公司档案</a>' : ''}</div></div>`;
        box.lookup = null;
        input.focus();
    }

    function entityForm(kind, row = {}, convert = false) {
        const editing = !!row._id && !convert;
        const values = convert ? { contactId: row.contactId, companyId: row.companyId, summary: row.summary, nextStep: row.nextStep } : row;
        const companyField = { companies: 'name', leads: 'companyName' }[kind];
        const controls = fields[kind].map(config => state.companyLookup && config[0] === companyField
            ? companyLookupField(config, values[config[0]], kind) : field(config, values[config[0]])).join('');
        const manual = kind === 'leads' && !editing ? '<label>来源<select name="source" required>' +
            options({ manual: sources.manual, event: sources.event, referral: sources.referral, inbound: sources.inbound }, 'manual') + '</select></label>' : '';
        const associates = kind === 'companies' ? '' : picker('companies', 'companyId', values.companyId) +
            (kind !== 'contacts' ? picker('contacts', 'contactId', values.contactId) : '');
        const stageControls = editing && stages[kind] ? '<label>阶段<select name="stage">' + options(
            kind === 'leads' ? Object.fromEntries(Object.entries(stages.leads).filter(([stage]) => row.stage === 'converted' ? stage === 'converted' : stage !== 'converted')) : stages[kind],
            row.stage) + '</select></label>' +
            (kind === 'leads' ? field(['closeReason', '待培育或关闭原因'], row.closeReason) :
                field(['lossReason', '输单原因'], row.lossReason) + field(['actualAmount', '实际成交金额（元）', 'number'], row.actualAmount) + field(['wonAt', '成交日期', 'date'], row.wonAt)) : '';
        const qualificationFields = kind === 'leads' && !editing ? '<label>线索等级<select name="qualification">' +
            options({ lead: 'Lead · 普通线索', mql: 'MQL · 营销合格', sql: 'SQL · 销售合格' }, 'lead') + '</select></label>' +
            field(['qualificationReason', '等级判定依据（MQL / SQL 必填）', 'textarea']) : '';
        const key = crypto.randomUUID();
        let acknowledgedMatch = '';
        openForm(convert ? '线索转为商机' : (editing ? '编辑' : '新建') + labels[kind], controls + manual + qualificationFields + associates + stageControls, async payload => {
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

    function renderSkillTokens(rows) {
        const container = $('crmActiveSkillTokens');
        if (!container) return;
        container.innerHTML = rows.length ? '<ul class="crm-quick-list">' + rows.map(token =>
            `<li><div><strong>${esc(token.label)}</strong><span class="sub">到期 ${esc(when(token.expiresAt))}</span></div>
              <button type="button" data-crm-token-revoke="${esc(token._id)}">撤销</button></li>`).join('') + '</ul>' :
            empty('当前账号暂无有效技能令牌');
    }
    async function openSkillConnection() {
        const { rows } = await api('/skill-tokens');
        openForm('连接 CRM 技能', '<p class="crm-wide sub">令牌有效期为 30 天。可在这里撤销，技能沿用当前账号的线索访问权限。</p>' +
            field(['label', '令牌名称'], '我的 Codex') +
            '<section class="crm-wide crm-skill-tokens"><h3>当前有效令牌</h3><div id="crmActiveSkillTokens"></div></section>',
        async payload => {
            const data = await api('/skill-tokens', { label: payload.label }, 'POST');
            $('crmFields').innerHTML = `<div class="crm-wide crm-stack">
              <p>复制令牌后，在 Codex 中说「用 $ruihua-crm 连接 CRM 技能」。令牌仅在此处显示一次。</p>
              <label>技能令牌<input id="crmSkillSecret" value="${esc(data.token)}" readonly autocomplete="off" spellcheck="false"></label>
              <div class="crm-actions"><button type="button" data-crm-copy-token>复制令牌</button><span id="crmCopySkillStatus" class="sub" role="status"></span></div>
              <p class="sub">到期 ${esc(when(data.expiresAt))}</p>
            </div>`;
            state.submit = async () => dialog.close();
            $('crmSave').textContent = '完成';
        }, '生成技能令牌');
        renderSkillTokens(rows);
    }
    async function revokeSkillToken(button) {
        if (!window.confirm('撤销后，该令牌关联的技能将无法继续访问。确认撤销？')) return;
        button.disabled = true;
        try {
            await api('/skill-tokens/' + encodeURIComponent(button.dataset.crmTokenRevoke), null, 'DELETE');
            const { rows } = await api('/skill-tokens');
            renderSkillTokens(rows);
            toast('技能令牌已撤销');
        } catch (error) { toast(error.message); }
        finally { button.disabled = false; }
    }
    async function copySkillToken() {
        const input = $('crmSkillSecret'), status = $('crmCopySkillStatus');
        if (!input || !status) return;
        try { await navigator.clipboard.writeText(input.value); status.textContent = '已复制，请在 Codex 中连接'; }
        catch (_) { input.select(); status.textContent = '请手动复制选中的令牌'; }
    }

    const actions = {
        back: () => navigate(state.tab), reload: load, 'skill-connect': openSkillConnection,
        unassigned: () => { state.tab = 'leads'; state.filters = { owner: 'unassigned' }; state.page = 1; return navigate('leads'); },
        'new-lead': () => entityForm('leads'), new: () => entityForm(state.tab),
        edit: () => entityForm(state.tab, state.detail.row),
        reset: () => { state.filters = {}; state.page = 1; return load(); },
        prev: () => { state.page -= 1; return load(); }, next: () => { state.page += 1; return load(); },
        qualification: () => {
            const row = state.detail.row;
            const current = row.qualification || 'lead';
            const choices = Object.fromEntries(Object.entries({ lead: 'Lead · 普通线索', mql: 'MQL · 营销合格', sql: 'SQL · 销售合格' }).filter(([level]) => level !== current));
            openForm('调整线索等级', '<label>调整为<select name="qualification" required>' + options(choices, '', '请选择等级') + '</select></label>' +
                field(['nextStep', '双方约定的下一步（SQL 必填）'], row.nextStep) + field(['reason', '调整依据', 'textarea', true]),
                async payload => { await api('/leads/' + row._id + '/qualification', payload, 'POST'); dialog.close(); await load(); });
        },
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
        const revoke = event.target.closest('[data-crm-token-revoke]');
        if (revoke) { if (!$('crmSave').disabled) return revokeSkillToken(revoke); return; }
        if (event.target.closest('[data-crm-copy-token]')) return copySkillToken();
        const companySearch = event.target.closest('[data-company-search]');
        if (companySearch) return lookupCompanyField(companySearch);
        const companyChoice = event.target.closest('[data-company-choice]');
        if (companyChoice) return applyCompanyCandidate(companyChoice);
        const period = event.target.closest('[data-crm-period]');
        if (period) { state.days = Number(period.dataset.crmPeriod); return load(); }
        const scope = event.target.closest('[data-crm-scope]');
        if (scope) { state.dashboardScope = scope.dataset.crmScope; return load(); }
        const bar = event.target.closest('[data-crm-bar]');
        if (bar) {
            root.querySelectorAll('[data-crm-bar]').forEach(button => button.setAttribute('aria-pressed', String(button === bar)));
            $('crmTrendSelection').textContent = bar.dataset.date + ' · ' + count(bar.dataset.count) + ' 条';
            return;
        }
        const drill = event.target.closest('[data-crm-drill]');
        if (drill) {
            state.tab = drill.dataset.crmDrill;
            state.filters = JSON.parse(drill.dataset.filter);
            if (hasPermission('crm:all') && state.dashboardScope === 'mine') state.filters.owner = String(currentUser.id || currentUser._id || '');
            state.page = 1;
            return navigate(state.tab);
        }
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
            const filters = Object.fromEntries(new FormData(event.target));
            for (const key of ['receivedDays', 'pool']) if (state.filters[key]) filters[key] = state.filters[key];
            state.filters = filters;
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
    dialog.addEventListener('close', () => { if ($('crmSkillSecret')) $('crmFields').replaceChildren(); });
    dialog.addEventListener('cancel', event => { if ($('crmSave').disabled) event.preventDefault(); });
    form.addEventListener('input', event => {
        const lookup = event.target.closest('[data-company-lookup]');
        if (lookup && event.target.matches('input')) {
            lookup.lookup = null;
            lookup.querySelector('[data-company-results]').textContent = '';
        }
        if (!event.target.matches('[data-crm-picker-search]')) return;
        const picker = event.target.closest('[data-picker]');
        clearTimeout(picker.searchTimer);
        picker.searchTimer = setTimeout(() => fillPicker(picker).catch(error => { $('crmFormError').textContent = error.message; }), 250);
    });
    if (root.classList.contains('active')) window.crmLoad();
})();
