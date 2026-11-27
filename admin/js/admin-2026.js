const TITLES={leads:'线索管理','ai-forms':'AI 需求表单',articles:'文章管理',cases:'案例管理',featured:'首页精选案例',faq:'FAQ 管理',experts:'讲师 / 专家团队',settings:'全局配置','nqoc-banner':'首页 Banner','nqoc-insights':'新质观点','nqoc-cases':'案例研究','nqoc-videos':'值得看见','nqoc-report-leads':'报告领取记录','email-marketing':'邮件营销',crm:'客户管理（CRM）'};
const BUSINESS_ROUTES=new Set(['leads','articles','cases','featured','faq','experts','nqoc-banner','nqoc-insights','nqoc-cases','nqoc-videos','nqoc-report-leads','email-marketing','crm']);
const FILTERS={leads:{'leadKeyword':'q','leadChannel':'channel','leadStatus':'status','leadTime':'time'},'ai-forms':{'aiFormKeyword':'q','aiFormDept':'dept','aiFormSynced':'synced','aiFormTime':'time'},articles:{'articleKeyword':'q','articleStatus':'status','articleZone':'zone'},cases:{'caseKeyword':'q','caseStatus':'status','caseIndustry':'industry'},featured:{'featuredKeyword':'q'}};
const state={leads:[],aiForms:[],articles:[],cases:[],faqs:[],authors:[],articleZone:'',caseIndustry:'',activeView:'leads',activeAiFormId:null,globalConfig:{recipients:[]}};
const currentUser=JSON.parse(sessionStorage.getItem('user')||localStorage.getItem('adminUser')||'{}');
const permissionSet=new Set(Array.isArray(currentUser.permissions)?currentUser.permissions:[]);
const permissionAliases={'lead:list':['appointment:list'],'lead:edit':['appointment:edit'],'lead:delete':['appointment:delete'],'lead:export':['appointment:export']};
const leadApi='/api/admin/leads';
function hasPermission(permission){return permissionSet.has('all')||permissionSet.has(permission)||(permissionAliases[permission]||[]).some(alias=>permissionSet.has(alias))}
function applyPermissions(){document.querySelectorAll('[data-permission]').forEach(element=>{element.hidden=!hasPermission(element.dataset.permission)});document.querySelectorAll('[data-target]').forEach(element=>{if(element.hidden)element.classList.remove('active')});const marketing=document.getElementById('marketingNav');if(marketing)marketing.hidden=!marketing.querySelector('button:not([hidden])')}
function routeFromLocation(){const path=location.pathname.replace(/\/+$/,'');if(path.startsWith('/admin/nqoc-report-leads/'))return 'nqoc-report-leads';const segment=path.split('/').filter(Boolean).pop();if(BUSINESS_ROUTES.has(segment))return segment;const legacy=(location.hash||'').replace(/^#/,'');return TITLES[legacy]?legacy:'leads'}
function restoreFilters(view){const params=new URLSearchParams(location.search);Object.entries(FILTERS[view]||{}).forEach(([id,key])=>{const value=params.get(key)||'';if(id==='articleZone'){state.articleZone=value;document.querySelectorAll('#articleZone button').forEach(button=>button.classList.toggle('on',button.dataset.value===value));return}if(id==='caseIndustry'){state.caseIndustry=value;return}const element=document.getElementById(id);if(element)element.value=value})}
function syncFiltersToUrl(){const params=new URLSearchParams();Object.entries(FILTERS[state.activeView]||{}).forEach(([id,key])=>{let value=id==='articleZone'?state.articleZone:id==='caseIndustry'?state.caseIndustry:document.getElementById(id)?.value;if(value)params.set(key,value)});const query=params.toString();const base=BUSINESS_ROUTES.has(state.activeView)?`/admin/${state.activeView}${query?'?'+query:''}`:`/admin/console.html${query?'?'+query:''}#${state.activeView}`;history.replaceState(null,'',base)}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const authHeaders=()=>({'Content-Type':'application/json','Authorization':'Bearer '+sessionStorage.getItem('token')});
const json=async(url,opt={})=>{const response=await fetch(url,{credentials:'same-origin',...opt});let data={};try{data=await response.json()}catch(error){data={error:'服务器返回了无效响应'}}if(response.status===401){location.href='/admin/index.html';throw Error('登录已失效')}if(!response.ok)throw Error(data.error||'请求失败');return data};
const date=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'—';
const ago=v=>{const minutes=Math.max(0,Math.floor((Date.now()-new Date(v).getTime())/6e4));if(minutes<60)return `${Math.max(1,minutes)} 分钟前`;if(minutes<1440)return `${Math.floor(minutes/60)} 小时前`;return `${Math.floor(minutes/1440)} 天前`};
const shortDateTime=v=>{const value=new Date(v);const pad=n=>String(n).padStart(2,'0');return `${pad(value.getMonth()+1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`};
const rows=(id,html,empty='暂无数据')=>{document.getElementById(id).innerHTML=html||`<tr><td colspan="9" class="empty-cell">${esc(empty)}</td></tr>`};
const statusText=value=>({new:'新线索',contacted:'已联系',opp:'已确认商机',won:'已成交',closed:'已关闭',completed:'已完成',processed:'已跟进',archived:'已归档',published:'已发布',draft:'草稿',scheduled:'定时'}[value]||value||'—');
const channelText=value=>({direct:'直接访问',agent:'AI 顾问抽屉',form:'预约诊断表单',demo:'首页演示小窗',referral:'外部引荐',organic:'自然搜索'}[value]||value||'直接访问');
const externalSourceText=item=>{let src=item.external_source;if(!src){if(item.utm_source)src=item.utm_source;else if(item.referrer){try{src=new URL(item.referrer).hostname.replace(/^www\./,'')}catch{src='referral'}}else src='direct'}return src==='direct'?'直接访问':src==='referral'?'外部引荐':src};
const channelChip=value=>{const channels={agent:['AI 顾问抽屉',''],form:['预约诊断表单','w'],demo:['首页演示小窗','a']};const channel=channels[value];return channel?`<span class="chip ${channel[1]}"><span class="dot"></span>${channel[0]}</span>`:`<span class="chip n"><span class="dot"></span>${esc(channelText(value))}</span>`};
const list=value=>Array.isArray(value)?value:value?[value]:[];
const intentTags=value=>list(value).map(intent=>`<span class="intent-tag">${esc(intent)}</span>`).join('')||'<span class="sub">—</span>';
const chip=value=>`<span class="chip ${esc(value)}">${esc(statusText(value))}</span>`;
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('on'),2200)}
function action(id,type){const prefix=type==='author'?'expert':type;return `${hasPermission(prefix+':edit')?`<button data-action="open-editor" data-type="${esc(type)}" data-id="${esc(id)}">编辑</button>`:''}${hasPermission(prefix+':delete')?`<button class="danger" data-action="remove-item" data-type="${esc(type)}" data-id="${esc(id)}">删除</button>`:''}`}
function pageAction(key){return `<button data-action="open-editor" data-type="page" data-id="${esc(key)}">编辑</button>`}
const leadListState = { page: 1, pages: 1, request: 0, timer: null, summary: null };
const leadNumber = number => new Intl.NumberFormat('zh-CN').format(number);
function leadParams() {
    const query = new URLSearchParams();
    for (const [id, key] of Object.entries(FILTERS.leads)) {
        const value = document.getElementById(id).value.trim();
        if (value) query.set(key, value);
    }
    return query;
}
function leadListMessage(text, action = '') {
    document.getElementById('leadList').innerHTML = `<tr class="website-lead-message"><td colspan="5" role="cell">${esc(text)}${action}</td></tr>`;
}
function renderLeadStats(counts) {
    for (const [key, value] of Object.entries(counts)) {
        const target = document.querySelector(`[data-stat="${key}"]`);
        if (target) target.textContent = value;
    }
    document.getElementById('leadBadge').textContent = counts.pending;
}
async function loadLeads({ page = leadListState.page, refreshSummary = true } = {}) {
    clearTimeout(leadListState.timer);
    const request = ++leadListState.request;
    const query = leadParams(), filtered = query.size > 0;
    const table = document.querySelector('.website-lead-table');
    const count = document.getElementById('leadListCount');
    const pager = document.getElementById('leadPagination');
    document.querySelector('[data-action="reset-leads"]').disabled = !filtered;
    count.textContent = '正在加载…';
    table.setAttribute('aria-busy', 'true');
    const exportButton = document.querySelector('[data-action="export-leads"]');
    exportButton.disabled = true;
    pager.hidden = true;
    leadListMessage('正在加载留资记录…');
    query.set('limit', '25');
    query.set('page', String(page));
    query.set('view', 'table');
    if (refreshSummary || !leadListState.summary) query.set('summary', '1');
    try {
        const result = await json(leadApi + '?' + query, { headers: authHeaders() });
        if (request !== leadListState.request) return;
        const { total, pages } = result.pagination;
        if (page > Math.max(1, pages)) return loadLeads({ page: Math.max(1, pages), refreshSummary });
        leadListState.page = page;
        leadListState.pages = Math.max(1, pages);
        state.leads = result.data;
        if (result.summary) {
            leadListState.summary = result.summary;
            renderLeadStats(result.summary);
        }
        count.textContent = (filtered ? '匹配 ' : '共 ') + leadNumber(total) + ' 条记录';
        if (state.leads.length) {
            document.getElementById('leadList').innerHTML = state.leads.map(renderLeadRow).join('');
            exportButton.disabled = false;
        } else {
            leadListMessage(filtered ? '没有匹配的线索，可调整或清除筛选。' : '暂未收到官网留资。');
        }
        pager.hidden = pages <= 1;
        document.getElementById('leadPageCount').textContent = '第 ' + page + ' / ' + leadListState.pages + ' 页';
        pager.querySelector('[data-action="previous-leads"]').disabled = page <= 1;
        pager.querySelector('[data-action="next-leads"]').disabled = page >= pages;
    } catch (error) {
        if (request !== leadListState.request) return;
        count.textContent = '加载失败';
        leadListMessage(error.message, '<button type="button" data-action="load-leads">重试</button>');
    } finally {
        if (request === leadListState.request) table.removeAttribute('aria-busy');
    }
}
function renderLeadRow(item) {
    const cell = (label, content) => `<td role="cell"><span class="website-lead-cell-label" aria-hidden="true">${label}</span><div>${content}</div></td>`;
    const contact = [item.phone, item.email].filter(Boolean).map(value => '<span class="website-lead-contact">' + esc(value) + '</span>').join('');
    const intents = item.intents?.length ? item.intents : item.intent || item.service;
    const intent = intents ? intentTags(intents) : '';
    const demand = item.problem || item.message;
    return `<tr role="row">
      <td role="cell"><button type="button" class="person" data-action="open-lead" data-id="${esc(item._id)}">${esc(item.name || '未留姓名')}</button>
        <span class="sub website-lead-company">${esc(item.company || '未填写公司')}</span>
        ${item.title ? '<span class="sub">' + esc(item.title) + '</span>' : ''}</td>
      ${cell('电话 / 邮箱', contact || '—')}
      ${cell('意向 / 需求', intent + (demand ? '<p class="website-lead-demand">' + esc(demand) + '</p>' : intent ? '' : '—'))}
      ${cell('跟进状态', chip(item.status || 'new'))}
      <td role="cell" class="website-lead-more"><button type="button" data-action="open-lead" data-id="${esc(item._id)}" aria-label="更多，查看${esc(item.name || '此线索')}详情">更多 <span aria-hidden="true">→</span></button></td>
    </tr>`;
}
function resetLeads() {
    document.getElementById('leadFilters').reset();
    syncFiltersToUrl();
    document.getElementById('leadKeyword').focus();
    return loadLeads({ page: 1, refreshSummary: false });
}
function filterLeads() {
    syncFiltersToUrl();
    return loadLeads({ page: 1, refreshSummary: false });
}
const aiFormApi='/api/admin/ai-demand-surveys';
const aiFormQuestions=[['q1','Q1 具体工作'],['q2','Q2 目前怎么做'],['q3','Q3 头疼问题'],['q4','Q4 发生频率'],['q5','Q5 工作量'],['q6','Q6 所需资料 / 系统'],['q7','Q7 处理方式'],['q8','Q8 出错影响'],['q9','Q9 期望效果'],['q10','Q10 真实案例']];
async function loadAiForms(){try{const d=await json(aiFormApi+'?limit=200',{headers:authHeaders()});state.aiForms=d.data||[];renderAiForms()}catch(error){rows('aiFormList','',error.message)}}
function renderAiForms(){const keyword=document.getElementById('aiFormKeyword').value.trim().toLowerCase();const synced=document.getElementById('aiFormSynced').value;const days=Number(document.getElementById('aiFormTime').value);const cutoff=days?Date.now()-days*864e5:0;const deptSelect=document.getElementById('aiFormDept');const currentDept=deptSelect.value;const depts=[...new Set(state.aiForms.map(x=>x.dept).filter(Boolean))].sort();deptSelect.innerHTML='<option value="">全部部门</option>'+depts.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');deptSelect.value=depts.includes(currentDept)?currentDept:'';const dept=deptSelect.value;const list=state.aiForms.filter(item=>(!dept||item.dept===dept)&&(!synced||String(item.dingtalk_synced===true)===synced)&&(!cutoff||new Date(item.createdAt).getTime()>=cutoff)&&(!keyword||[item.dept,item.title,item.contact,item.q1].some(v=>String(v||'').toLowerCase().includes(keyword))));const now=new Date();const today=now.toDateString();const counts={today:state.aiForms.filter(x=>new Date(x.createdAt).toDateString()===today).length,total:state.aiForms.length,totalTime:state.aiForms.length,unsynced:state.aiForms.filter(x=>!x.dingtalk_synced).length,month:state.aiForms.filter(x=>{const d=new Date(x.createdAt);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()}).length,hours:Math.round(state.aiForms.reduce((sum,x)=>sum+(parseFloat(x.q5_hours)||0),0))};Object.entries(counts).forEach(([key,value])=>{const stat=document.querySelector(`[data-aiform-stat="${key}"]`);if(stat)stat.textContent=value});document.getElementById('aiFormBadge').textContent=counts.total;const canDelete=hasPermission('appointment:delete');rows('aiFormList',list.map(x=>`<tr data-action="open-ai-form" data-id="${esc(x._id)}"><td><div class="lead-time">${ago(x.createdAt)}<span class="sub mono">${shortDateTime(x.createdAt)}</span></div></td><td>${esc(x.dept||'—')}</td><td><button class="person" data-action="open-ai-form" data-id="${esc(x._id)}">${esc(x.title||'—')}</button></td><td>${esc(x.contact||'—')}</td><td><span class="sub">${esc(String(x.q1||'—').slice(0,60))}</span></td><td class="mono">${esc(x.q5_hours||'—')}</td><td>${x.dingtalk_synced?'<span class="chip published">已同步</span>':`<span class="chip new">未同步</span>`}</td><td><button data-action="open-ai-form" data-id="${esc(x._id)}">查看</button>${canDelete?`<button class="danger" data-action="remove-ai-form" data-id="${esc(x._id)}">删除</button>`:''}</td></tr>`).join(''),'还没有表单提交')}
function aiFormWorkload(item){const parts=[];if(item.q5_count)parts.push(`每月 ${item.q5_count} 件`);if(item.q5_minutes)parts.push(`每件 ${item.q5_minutes} 分钟`);if(item.q5_people)parts.push(`${item.q5_people} 人参与`);if(item.q5_hours!==undefined&&item.q5_hours!==null&&item.q5_hours!=='')parts.push(`约 ${item.q5_hours} 小时/月`);return parts.length?esc(parts.join(' · ')):'—'}
function aiFormFileSize(value){const bytes=Number(value);if(!bytes||Number.isNaN(bytes))return '';if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(0)} KB`;return `${(bytes/1048576).toFixed(1)} MB`}
function openAiForm(id){const item=state.aiForms.find(x=>x._id===id);if(!item)return;state.activeAiFormId=id;document.getElementById('aiFormDrawerTitle').textContent=item.title||'AI 需求表单';document.getElementById('aiFormDrawerSub').textContent=[item.dept,item.contact].filter(Boolean).join(' · ')||'—';const answers=aiFormQuestions.map(([key,label])=>{const extra=key==='q3'&&item.q3_other?`（其他：${esc(item.q3_other)}）`:key==='q6'&&item.q6_other?`（其他：${esc(item.q6_other)}）`:key==='q9'&&item.q9_other?`（其他：${esc(item.q9_other)}）`:'';const value=key==='q5'?aiFormWorkload(item):esc(item[key]||'—');return `<dt>${label}</dt><dd>${value}${extra}</dd>`}).join('');const workload=[item.q5_count?`每月 ${item.q5_count} 件`:'',item.q5_minutes?`每件 ${item.q5_minutes} 分钟`:'',item.q5_people?`${item.q5_people} 人参与`:''].filter(Boolean).join(' · ')||'—';document.getElementById('aiFormDrawerBody').innerHTML=`<section class="sec"><h3>提交信息</h3><dl class="kv"><dt>提交时间</dt><dd>${date(item.createdAt)}</dd><dt>所属部门</dt><dd>${esc(item.dept||'—')}</dd><dt>需求名称</dt><dd>${esc(item.title||'—')}</dd><dt>需求联系人</dt><dd>${esc(item.contact||'—')}</dd><dt>月工时</dt><dd><span class="tag">${esc(item.q5_hours||'—')} 小时</span><span class="sub">${esc(workload)}</span></dd><dt>钉钉表格同步</dt><dd>${item.dingtalk_synced?'<span class="chip published">已同步</span>':`<span class="chip new">未同步</span>${item.dingtalk_error?`<span class="sub">${esc(item.dingtalk_error)}</span>`:''}`}</dd>${item.attachment_name?`<dt>附件</dt><dd>${item.attachment_url?`<a href="${esc(item.attachment_url)}" target="_blank" rel="noopener noreferrer">${esc(item.attachment_name)}</a>`:esc(item.attachment_name)}${aiFormFileSize(item.attachment_size)?`<span class="sub">${aiFormFileSize(item.attachment_size)}</span>`:''}</dd>`:''}<dt>来源页面</dt><dd class="mono">${esc(item.page||'—')}</dd></dl></section><section class="sec"><h3>问卷内容</h3><dl class="kv">${answers}</dl></section>`;document.getElementById('aiFormDrawer').classList.add('open');document.getElementById('drawerMask').classList.add('open');document.getElementById('aiFormDrawer').setAttribute('aria-hidden','false')}
function closeAiForm(){document.getElementById('aiFormDrawer').classList.remove('open');document.getElementById('drawerMask').classList.remove('open');document.getElementById('aiFormDrawer').setAttribute('aria-hidden','true')}
function closeDrawer(){closeLead();closeAiForm()}
async function removeAiForm(id){const target=id||state.activeAiFormId;if(!target||!confirm('确定删除这条表单记录吗？此操作不可撤销。'))return;try{await json(`${aiFormApi}/${target}`,{method:'DELETE',headers:authHeaders()});closeAiForm();await loadAiForms();toast('记录已删除')}catch(error){alert(error.message)}}
async function exportAiForms(){const response=await fetch(`${aiFormApi}/export`,{headers:authHeaders()});if(!response.ok){const data=await response.json().catch(()=>({}));return alert(data.error||'导出失败')}const blob=await response.blob();const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='ai-demand-surveys.xlsx';link.click();URL.revokeObjectURL(link.href)}
const leadDrawer = document.getElementById('leadDrawer');
const leadDrawerBody = document.getElementById('leadDrawerBody');
const leadStatusForm = document.getElementById('leadDrawerFooter');
const leadStatusInput = document.getElementById('leadDrawerStatus');
const leadStatusSave = leadStatusForm.querySelector('button');
let activeLead = null;
let leadOpener = null;
let leadDetailRequest = 0;
function leadField(label, value) {
    return value ? `<dt>${label}</dt><dd>${esc(value)}</dd>` : '';
}
function renderLeadNotes(notes) {
    return [...(notes || [])].reverse().map(note => `<div class="note"><div class="m">${esc(date(note.ts))} · ${esc(note.by || '管理员')}</div><p>${esc(note.txt)}</p></div>`).join('') ||
        '<p class="empty-detail">暂无跟进记录。</p>';
}
function showLeadStatus(value) {
    const badge = document.getElementById('leadDrawerStatusChip');
    badge.hidden = !value;
    badge.className = 'chip ' + (Object.hasOwn(leadStatusOptions, value) ? value : 'n');
    badge.textContent = statusText(value);
    leadStatusInput.value = value;
    leadStatusSave.disabled = true;
}
const leadStatusOptions = Object.fromEntries([...leadStatusInput.options].map(option => [option.value, option.text]));
function renderLeadDetail(item) {
    const editable = hasPermission('lead:edit');
    const intents = item.intents?.length ? item.intents : item.intent || item.service;
    const demand = item.problem || item.message;
    const sourceNames = value => list(value).map(source => typeof source === 'string' ? source : source?.t || source?.title || source?.w || source?.url || '').filter(Boolean);
    const trail = list(item.trail).map(step => `<div class="tr ${step.hit ? 'hit' : ''}" data-trail-item>
        <div class="h">${esc(step.t || step.h || '页面访问')}${step.hit ? ' <span class="chip">在此留资</span>' : ''}</div>
        <div class="m">${esc(step.h || '—')}${step.d ? ' · 停留 <em>' + esc(step.d) + '</em>' : ''}</div></div>`).join('');
    const talk = list(item.talk).map(message => {
        const rag = [...new Set([...sourceNames(message.rag), ...sourceNames(message.src)])];
        return `<div class="msg ${message.r === 'me' ? 'me' : 'ai'}"><span class="who">${message.r === 'me' ? '访客' : 'AI 顾问'}</span>
          <div class="bub">${esc(message.t)}${rag.length ? '<span class="msg-sources"><b>RAG 来源</b>' +
              rag.map(source => '<span class="src-tag">' + esc(source) + '</span>').join('') + '</span>' : ''}</div></div>`;
    }).join('');
    document.getElementById('leadDrawerName').textContent = item.name || '未留姓名';
    document.getElementById('leadDrawerAvatar').textContent = String(item.name || '—').slice(0, 1);
    const reference = item.externalId?'#'+item.externalId.replace(/^L/,''):'';
    document.getElementById('leadDrawerSub').textContent = [item.company, item.title, reference].filter(Boolean).join(' · ');
    showLeadStatus(item.status || 'new');
    document.getElementById('leadStatusError').textContent = '';
    leadStatusInput.disabled = false;
    leadStatusForm.hidden = !editable;
    leadDrawerBody.innerHTML = `<section class="sec"><h3>联系信息</h3><dl class="kv">
        ${leadField('手机 / 微信', item.phone || '未填写')}${leadField('邮箱', item.email || '未填写')}
        ${leadField('公司', item.company)}${leadField('职位', item.title)}${leadField('部门', item.department)}
        ${leadField('留资时间', item.createdAt && date(item.createdAt))}
      </dl></section>
      ${intents || demand || item.remarks ? `<section class="sec"><h3>意向与需求</h3>
        ${intents ? '<div>' + intentTags(intents) + '</div>' : ''}${demand ? '<p class="website-lead-description">' + esc(demand) + '</p>' : ''}
        ${item.remarks && item.remarks !== demand ? '<dl class="kv">' + leadField('备注', item.remarks) + '</dl>' : ''}
      </section>` : ''}
      <section class="sec"><h3>跟进记录</h3>
        ${editable ? `<form id="leadFollowForm" class="website-lead-note-form"><label for="leadNoteText">本次跟进</label>
          <textarea id="leadNoteText" name="leadNoteText" class="note-input" rows="3" required placeholder="记录沟通结果和下一步"></textarea>
          <div class="website-lead-actions"><button type="submit" class="primary">添加跟进</button><span id="leadNoteError" class="website-lead-error" role="status"></span></div>
        </form>` : ''}
        <div class="notes" id="leadNotes">${renderLeadNotes(item.notes)}</div>
      </section>
      <details class="sec website-lead-extra"><summary>留资来源与访问轨迹</summary>
        <dl class="kv"><dt>留资入口</dt><dd>${channelChip(item.channel || item.utm_source)}</dd>
          ${leadField('触发方式', item.trigger)}${leadField('外部来源', externalSourceText(item))}
          ${leadField('落地页', item.landing || item.landing_page)}${leadField('留资页面', item.leadPage || item.source)}
          ${leadField('设备', item.device)}
        </dl>${trail ? '<div class="trail">' + trail + '</div>' : '<p class="empty-detail">暂无访问轨迹。</p>'}
      </details>
      ${talk ? '<details class="sec website-lead-extra"><summary>AI 顾问对话</summary><div class="talk">' + talk + '</div></details>' : ''}`;
}
async function openLead(id) {
    if (!id) return;
    const request = ++leadDetailRequest;
    if (!leadDrawer.classList.contains('open')) {
        leadOpener = [...document.querySelectorAll('#leadList button[data-action="open-lead"]')].find(button => button.dataset.id === id);
    }
    activeLead = null;
    leadDrawer.inert = false;
    leadDrawer.classList.add('open');
    leadDrawer.setAttribute('aria-hidden', 'false');
    document.getElementById('drawerMask').classList.add('open');
    leadDrawer.querySelector('[data-action="close-lead"]').focus();
    document.getElementById('leadDrawerName').textContent = state.leads.find(item => item._id === id)?.name || '线索详情';
    document.getElementById('leadDrawerAvatar').textContent = '—';
    document.getElementById('leadDrawerSub').textContent = '';
    showLeadStatus(null);
    leadStatusForm.hidden = true;
    leadDrawerBody.scrollTop = 0;
    leadDrawerBody.innerHTML = '<p class="empty-detail" role="status">正在加载线索详情…</p>';
    try {
        const { data } = await json(leadApi + '/' + encodeURIComponent(id), { headers: authHeaders() });
        if (request !== leadDetailRequest) return;
        activeLead = data;
        renderLeadDetail(data);
    } catch (error) {
        if (request !== leadDetailRequest) return;
        leadDrawerBody.innerHTML = '<p class="website-lead-error" role="alert">' + esc(error.message) + '</p>' +
            '<button type="button" data-action="open-lead" data-id="' + esc(id) + '">重试</button>';
    }
}
function closeLead() {
    if (!leadDrawer.classList.contains('open')) return;
    ++leadDetailRequest;
    activeLead = null;
    leadDrawer.classList.remove('open');
    document.getElementById('drawerMask').classList.remove('open');
    const replacement = leadOpener && [...document.querySelectorAll('#leadList button[data-action="open-lead"]')]
        .find(button => button.dataset.id === leadOpener.dataset.id);
    const nextFocus = leadOpener?.isConnected ? leadOpener : replacement || document.getElementById('leadKeyword');
    nextFocus?.focus();
    leadOpener = null;
    leadDrawer.inert = true;
    leadDrawer.setAttribute('aria-hidden', 'true');
}
async function addLeadNote(form) {
    const item = activeLead;
    const input = form.elements.namedItem('leadNoteText');
    const txt = input.value.trim();
    const button = form.querySelector('button'), errorMessage = document.getElementById('leadNoteError');
    if (!item || button.disabled) return;
    if (!txt) { errorMessage.textContent = '请填写本次跟进内容。'; input.focus(); return; }
    input.readOnly = true;
    button.disabled = true;
    errorMessage.textContent = '';
    try {
        const { data } = await json(leadApi + '/' + encodeURIComponent(item._id) + '/follow-ups', {
            method: 'POST', headers: authHeaders(), body: JSON.stringify({ txt })
        });
        if (item !== activeLead) return;
        activeLead.notes = data.notes;
        document.getElementById('leadNotes').innerHTML = renderLeadNotes(data.notes);
        input.value = '';
        input.focus();
        toast('跟进记录已添加');
    } catch (error) { errorMessage.textContent = error.message; }
    finally { input.readOnly = false; button.disabled = false; }
}
async function updateLead() {
    const item = activeLead, status = leadStatusInput.value;
    if (!item || status === (item.status || 'new') || leadStatusSave.disabled) return;
    const message = document.getElementById('leadStatusError');
    message.textContent = '';
    delete message.dataset.saved;
    leadStatusInput.disabled = true;
    leadStatusSave.disabled = true;
    try {
        const { data } = await json(leadApi + '/' + encodeURIComponent(item._id) + '/status', {
            method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status })
        });
        if (item === activeLead) {
            item.status = data.status;
            showLeadStatus(data.status);
            message.dataset.saved = 'true';
            message.textContent = '状态已保存';
        }
        if (state.activeView === 'leads') void loadLeads();
    } catch (error) { if (item === activeLead) message.textContent = error.message; }
    finally {
        if (item === activeLead) {
            leadStatusInput.disabled = false;
            leadStatusSave.disabled = leadStatusInput.value === activeLead.status;
        }
    }
}
async function loadArticles(){try{const d=await json('/api/admin/articles?limit=100',{headers:authHeaders()});state.articles=Array.isArray(d)?d:d.data||[];renderArticles()}catch(error){rows('articleList','',error.message)}}
const zoneText=value=>({industry:'行业洞察',thinktank:'经营智库'}[value]||value||'未分栏目');
function renderArticles(){const keyword=document.getElementById('articleKeyword').value.trim().toLowerCase();const status=document.getElementById('articleStatus').value;const list=state.articles.filter(item=>(!state.articleZone||item.zone===state.articleZone)&&(!status||item.status===status)&&(!keyword||[item.title,item.author?.name,item.author].some(v=>String(v||'').toLowerCase().includes(keyword))));rows('articleList',list.map(x=>`<tr><td><span class="person">${esc(x.title)}</span><span class="sub">${esc(x.slug||'')}</span></td><td>${esc(zoneText(x.zone))}<span class="sub">${esc(x.category||'未分类')}</span></td><td>${esc(x.author?.name||x.author||'—')}</td><td>${chip(x.status)}${x.isRecommended?' <span class="chip featured">推荐</span>':''}${x.top?' <span class="chip top">置顶</span>':''}${x.contentStatus&&x.contentStatus!=='full'?' <span class="chip">'+esc(x.contentStatus==='toc'?'仅摘要':'即将上线')+'</span>':''}</td><td>${date(x.updatedAt)}</td><td>${action(x._id,'article')}</td></tr>`).join(''))}
async function loadCases(){try{const d=await json('/api/admin/cases',{headers:authHeaders()});state.cases=d.data||[];const select=document.getElementById('caseIndustry');const current=state.caseIndustry||select.value;const industries=[...new Set(state.cases.map(x=>x.industry).filter(Boolean))];select.innerHTML='<option value="">全部行业</option>'+industries.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');select.value=current;state.caseIndustry=select.value;renderCases();renderFeatured()}catch(error){rows('caseList','',error.message);document.getElementById('featuredSort').innerHTML=`<p>${esc(error.message)}</p>`}}
function renderCases(){const keyword=document.getElementById('caseKeyword').value.trim().toLowerCase();const industry=document.getElementById('caseIndustry').value;state.caseIndustry=industry;const status=document.getElementById('caseStatus').value;const list=state.cases.filter(item=>(!industry||item.industry===industry)&&(!status||item.status===status)&&(!keyword||[item.title,item.client].some(v=>String(v||'').toLowerCase().includes(keyword))));rows('caseList',list.map(x=>`<tr><td>${hasPermission('featured-case:edit')?`<input type="checkbox" data-action="toggle-featured" data-id="${esc(x._id)}" ${x.featured?'checked':''}>`:x.featured?'是':'否'}</td><td><span class="person">${esc(x.title)}</span></td><td>${esc(x.client||'—')}</td><td>${esc(x.industry||'—')}</td><td>${chip(x.status)}</td><td>${action(x._id,'case')}</td></tr>`).join(''))}
function renderFeatured(){const keyword=document.getElementById('featuredKeyword').value.trim().toLowerCase();const featured=state.cases.filter(x=>x.featured).sort((a,b)=>(a.featuredOrder||0)-(b.featuredOrder||0));const canEdit=hasPermission('featured-case:edit');document.getElementById('featuredCount').textContent=`${featured.length} 个案例`;document.getElementById('featuredSort').innerHTML=featured.length?featured.map((x,index)=>`<div class="sort-item"><span class="rank">${index+1}</span><span class="copy"><b>${esc(x.title)}</b><small>${esc(x.client||x.industry||'')}</small></span>${canEdit?`<button data-action="move-featured" data-id="${esc(x._id)}" data-step="-1" ${index===0?'disabled':''}>↑</button><button data-action="move-featured" data-id="${esc(x._id)}" data-step="1" ${index===featured.length-1?'disabled':''}>↓</button><button data-action="remove-featured" data-id="${esc(x._id)}">×</button>`:''}</div>`).join(''):'<p class="empty-cell">暂未设置首页精选</p>';document.getElementById('featuredPick').innerHTML=state.cases.filter(x=>!keyword||[x.title,x.client].some(v=>String(v||'').toLowerCase().includes(keyword))).map(x=>`<label class="pick-row">${canEdit?`<input type="checkbox" data-action="toggle-featured" data-id="${esc(x._id)}" ${x.featured?'checked':''}>`:`<span>${x.featured?'已精选':'未精选'}</span>`}<span>${esc(x.title)}</span></label>`).join('')}
async function saveFeatured(previous,message){const list=state.cases.filter(x=>x.featured).sort((a,b)=>(a.featuredOrder||0)-(b.featuredOrder||0));list.forEach((item,index)=>item.featuredOrder=index+1);renderCases();renderFeatured();try{await json('/api/cases/featured/batch',{method:'PUT',headers:authHeaders(),body:JSON.stringify({items:list.map(item=>({id:item._id,order:item.featuredOrder}))})});toast(message)}catch(error){state.cases=previous;renderCases();renderFeatured();alert(error.message)}}
async function toggleFeatured(id,featured){const previous=state.cases.map(item=>({...item}));const item=state.cases.find(x=>x._id===id);if(!item)return;item.featured=featured;if(featured)item.featuredOrder=state.cases.filter(x=>x.featured).length;await saveFeatured(previous,featured?'已加入首页精选':'已取消首页精选')}
async function moveFeatured(id,step){const previous=state.cases.map(item=>({...item}));const list=state.cases.filter(x=>x.featured).sort((a,b)=>(a.featuredOrder||0)-(b.featuredOrder||0));const index=list.findIndex(x=>x._id===id);const target=index+Number(step);if(index<0||target<0||target>=list.length)return;[list[index],list[target]]=[list[target],list[index]];list.forEach((item,order)=>item.featuredOrder=order+1);await saveFeatured(previous,'精选排序已保存')}
async function loadFaq(){try{const d=await json('/api/faqs');state.faqs=(Array.isArray(d)?d:d.data||[]).sort((a,b)=>(a.order||0)-(b.order||0));renderFaq()}catch(error){document.getElementById('faqSort').innerHTML=`<p>${esc(error.message)}</p>`}}
function renderFaq(){document.getElementById('faqCount').textContent=`共 ${state.faqs.length} 条`;document.getElementById('faqSort').innerHTML=state.faqs.length?state.faqs.map((x,index)=>{const editButtons=hasPermission('faq:edit')?`<button data-action="move-faq" data-id="${esc(x._id)}" data-step="-1" ${index===0?'disabled':''}>↑</button><button data-action="move-faq" data-id="${esc(x._id)}" data-step="1" ${index===state.faqs.length-1?'disabled':''}>↓</button><button data-action="open-editor" data-type="faq" data-id="${esc(x._id)}">编辑</button>`:'';const deleteButton=hasPermission('faq:delete')?`<button data-action="remove-item" data-type="faq" data-id="${esc(x._id)}">×</button>`:'';return `<div class="sort-item"><span class="rank">${index+1}</span><span class="copy"><b>${esc(x.question)}</b><small>${esc(String(x.answer||'').replace(/<[^>]+>/g,' ').slice(0,90))}</small></span>${chip(x.status)}${editButtons}${deleteButton}</div>`}).join(''):'<p class="empty-cell">暂无 FAQ</p>'}
async function moveFaq(id,step){const previous=[...state.faqs];const index=state.faqs.findIndex(x=>x._id===id);const target=index+Number(step);if(index<0||target<0||target>=state.faqs.length)return;[state.faqs[index],state.faqs[target]]=[state.faqs[target],state.faqs[index]];renderFaq();try{await json('/api/faqs/reorder',{method:'PUT',headers:authHeaders(),body:JSON.stringify({items:state.faqs.map((item,order)=>({id:item._id,order:order+1}))})});toast('FAQ 排序已保存')}catch(error){state.faqs=previous;renderFaq();alert(error.message)}}
async function loadAuthors(){try{const d=await json('/api/admin/authors',{headers:authHeaders()});state.authors=Array.isArray(d)?d:d.data||[];renderAuthors()}catch(error){document.getElementById('expertList').innerHTML=`<p>${esc(error.message)}</p>`}}
function renderAuthors(){const missingCount=state.authors.filter(x=>!x.avatar).length;document.getElementById('expertCount').innerHTML=`共 ${state.authors.length} 位 <span style="color: var(--apricot); margin-left: 6px; font-weight: 600; font-size: 12.5px;">· ${missingCount} 位缺照片</span>`;document.getElementById('expertList').innerHTML=state.authors.length?state.authors.map((x,index)=>`<article class="expert-card"><div class="expert-drag-handle"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg></div>${x.avatar?`<img src="${esc(x.avatar)}" alt="" class="expert-avatar-img">`:`<div class="expert-avatar">${esc(String(x.name||'瑞').slice(0,1))}</div>`}<div class="expert-info"><div class="expert-name-row"><h3>${esc(x.name)}</h3>${!x.avatar?`<span class="expert-missing-tag">缺照片</span>`:''}</div><p>${esc(x.desc||'暂无简介')}</p></div><div class="expert-controls"><button class="expert-switch ${x.status==='hidden'?'':'on'}" data-action="toggle-author-status" data-id="${esc(x._id)}" type="button" aria-label="切换状态"></button><button class="expert-btn" data-action="open-editor" data-type="author" data-id="${esc(x._id)}">编辑</button><button class="expert-btn" data-action="remove-item" data-type="author" data-id="${esc(x._id)}">删除</button></div></article>`).join(''):'<p class="empty-cell">暂无专家</p>'}
async function moveExpert(id,step){const previous=[...state.authors];const index=state.authors.findIndex(x=>x._id===id);const target=index+Number(step);if(index<0||target<0||target>=state.authors.length)return;[state.authors[index],state.authors[target]]=[state.authors[target],state.authors[index]];renderAuthors();try{await json('/api/authors/reorder',{method:'PUT',headers:authHeaders(),body:JSON.stringify({items:state.authors.map((item,order)=>({id:item._id,order:order+1}))})});toast('专家排序已保存')}catch(error){state.authors=previous;renderAuthors();alert(error.message)}}
async function toggleAuthorStatus(id){const author=state.authors.find(x=>x._id===id);if(!author)return;const previousStatus=author.status;author.status=previousStatus==='hidden'?'active':'hidden';renderAuthors();try{const data={name:author.name,status:author.status,detail:author.detail,desc:author.desc,avatar:author.avatar};await json(`/api/authors/${id}`,{method:'PUT',headers:authHeaders(),body:JSON.stringify(data)});toast('专家状态已更新')}catch(error){author.status=previousStatus;renderAuthors();alert(error.message)}}
async function loadPages(){try{const d=await json('/api/admin/pages',{headers:authHeaders()});rows('pageList',(d.data||[]).map(x=>`<tr><td>${esc(x.key)}</td><td>${esc(x.title)}</td><td>${(x.sections||[]).length}</td><td>${date(x.updatedAt)}</td><td>${pageAction(x.key)}</td></tr>`).join(''))}catch(error){rows('pageList','',error.message)}}
const CONFIG_CHANNELS=['企业微信群机器人','企业微信应用消息','短信','邮件','飞书群机器人','钉钉群机器人'];
const RECIPIENT_SCOPES=['AI 赋能培训','AI 转型咨询','AI 落地陪跑','人力资本价值经营','还不确定，先聊聊'];
let recipientEditIndex=null;
async function loadGlobalConfig(){try{const d=await json('/api/admin/global-config',{headers:authHeaders()});state.globalConfig={cities:[],notificationChannels:[],recipients:[],...(d.data||{})};['tel','mail','icp','qr','oldDomain','newDomain','logo','escalationHours','dailyDigest'].forEach(key=>{const el=document.getElementById('config-'+key);if(el)el.value=state.globalConfig[key]??''});renderGlobalConfig()}catch(error){toast(error.message)}}
function renderGlobalConfig(){const config=state.globalConfig;document.getElementById('config-cities').innerHTML=config.cities.length?config.cities.map((city,index)=>`<span class="city-chip">${esc(city)}<button type="button" data-action="remove-city" data-index="${index}" title="删除">✕</button></span>`).join(''):'<span class="sub">还没有城市</span>';document.getElementById('config-notificationChannels').innerHTML=CONFIG_CHANNELS.map(channel=>`<label><input type="checkbox" data-config-channel value="${esc(channel)}" ${config.notificationChannels.includes(channel)?'checked':''}>${esc(channel)}</label>`).join('');const qr=document.getElementById('config-qrPreview');qr.innerHTML=config.qr?`<img src="${esc(config.qr)}" alt="公众号二维码预览">`:'<span>未上传<br>（前台用假码）</span>';renderRecipients()}
function renderRecipients(){const recipients=state.globalConfig.recipients||[];const fallback=document.getElementById('config-fallbackRecipient');fallback.innerHTML=recipients.length?recipients.map((item,index)=>`<option value="${esc(item._id||index)}">${esc(item.name||'未命名')} · ${esc(item.role||'')}</option>`).join(''):'<option value="">暂无接收人</option>';fallback.value=String(state.globalConfig.fallbackRecipient||'');rows('recipientRows',recipients.map((item,index)=>`<tr><td><b>${esc(item.name||'未命名')}</b><span class="sub">${esc(item.role||'')}</span></td><td>${esc(item.account||'—')}</td><td><div class="recipient-tags">${(item.scope||[]).map(scope=>`<span class="recipient-tag">${esc(scope)}</span>`).join('')||'<span class="sub">未分派</span>'}</div></td><td><span class="recipient-channel">${esc(item.channel||'—')}</span></td><td><button class="recipient-switch ${item.enabled!==false?'on':''}" data-action="toggle-recipient" data-index="${index}" aria-label="${item.enabled!==false?'停用':'启用'}接收人"></button></td><td><button data-action="edit-recipient" data-index="${index}">编辑</button><button class="danger" data-action="remove-recipient" data-index="${index}">删除</button></td></tr>`).join(''),'还没有接收人，线索来了没人知道，上线前必须至少配 1 个')}
function addConfigCity(){const input=document.getElementById('config-cityInput');const city=input.value.trim();if(!city)return;if(state.globalConfig.cities.includes(city)){toast('已经有这个城市了');return}state.globalConfig.cities.push(city);input.value='';renderGlobalConfig()}
function removeConfigCity(index){state.globalConfig.cities.splice(index,1);renderGlobalConfig()}
async function previewQrFile(file){if(!file)return;if(file.size>1.2e6){toast('二维码图片超过 1MB，压一下');return}const fd=new FormData();fd.append('file',file);try{const r=await fetch('/api/upload',{method:'POST',headers:{Authorization:'Bearer '+sessionStorage.getItem('token')},body:fd});const contentType=r.headers.get('content-type')||'';let d;if(contentType.includes('application/json')){d=await r.json();}else{const t=await r.text();try{d=JSON.parse(t);}catch(_){d={success:false,error:'服务器返回格式错误 (HTTP '+r.status+')'};}}if(!r.ok)throw new Error(d?.error||('上传失败 (HTTP '+r.status+')'));if(d.error)throw new Error(d.error);state.globalConfig.qr=d.url;document.getElementById('config-qr').value=d.url;renderGlobalConfig();toast('二维码已替换，记得保存')}catch(err){alert(err.message)}}
function openRecipientEditor(index=null){recipientEditIndex=index===null?null:Number(index);const item=recipientEditIndex===null?{name:'',role:'',account:'',channel:'企业微信',scope:[]}:state.globalConfig.recipients[recipientEditIndex];document.getElementById('recipientEditorTitle').textContent=recipientEditIndex===null?'添加接收人':'编辑接收人';document.getElementById('recipient-name').value=item.name||'';document.getElementById('recipient-role').value=item.role||'';document.getElementById('recipient-account').value=item.account||'';document.getElementById('recipient-channel').value=item.channel||'企业微信';document.getElementById('recipientScope').innerHTML=RECIPIENT_SCOPES.map(scope=>`<label><input type="checkbox" value="${esc(scope)}" ${(item.scope||[]).includes(scope)?'checked':''}>${esc(scope)}</label>`).join('');const modal=document.getElementById('recipientModal');modal.classList.add('show');modal.setAttribute('aria-hidden','false')}
function closeRecipientEditor(){const modal=document.getElementById('recipientModal');modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}
async function saveRecipient(){const name=document.getElementById('recipient-name').value.trim();const account=document.getElementById('recipient-account').value.trim();if(!name||!account){toast('姓名和接收账号必填');return}const item={name,role:document.getElementById('recipient-role').value.trim(),account,channel:document.getElementById('recipient-channel').value,scope:[...document.querySelectorAll('#recipientScope input:checked')].map(input=>input.value),enabled:recipientEditIndex===null?true:state.globalConfig.recipients[recipientEditIndex].enabled!==false};const recipients=[...state.globalConfig.recipients];if(recipientEditIndex===null)recipients.push(item);else recipients[recipientEditIndex]={...recipients[recipientEditIndex],...item};await saveGlobalConfig({recipients});closeRecipientEditor()}
async function saveGlobalConfig(patch){try{const d=await json('/api/admin/global-config',{method:'PUT',headers:authHeaders(),body:JSON.stringify({...state.globalConfig,...patch})});state.globalConfig={cities:[],notificationChannels:[],recipients:[],...(d.data||{})};renderGlobalConfig();document.getElementById('configSaved').textContent='已保存 · '+date(new Date());toast('全局配置已保存，全站生效')}catch(error){alert(error.message)}}
function collectGlobalConfig(){const form=new FormData(document.getElementById('globalConfigForm'));return {tel:String(form.get('tel')||'').trim(),mail:String(form.get('mail')||'').trim(),cities:state.globalConfig.cities,icp:String(form.get('icp')||'').trim(),qr:state.globalConfig.qr||'',oldDomain:String(form.get('oldDomain')||'').trim(),newDomain:String(form.get('newDomain')||'').trim(),logo:form.get('logo'),notificationChannels:[...document.querySelectorAll('[data-config-channel]:checked')].map(input=>input.value),escalationHours:Number(form.get('escalationHours'))||0,dailyDigest:form.get('dailyDigest')||'',fallbackRecipient:form.get('fallbackRecipient')||null}}
async function testNotification(){const enabled=(state.globalConfig.recipients||[]).filter(item=>item.enabled!==false);const channels=[...document.querySelectorAll('[data-config-channel]:checked')].map(input=>input.value);if(!enabled.length||!channels.length){toast('先配好接收人和通知渠道');return}try{await json('/api/test-dingtalk',{method:'POST',headers:authHeaders(),body:JSON.stringify({})});toast(`测试通知已发给 ${enabled.length} 人 · 渠道：${channels.join('、')}`)}catch(error){alert(error.message)}}
async function removeItem(type,id){if(!confirm('确定删除吗？此操作不可撤销。'))return;try{const urls={lead:`/api/appointments/${id}`,article:`/api/articles/${id}`,case:`/api/cases/${id}`,faq:`/api/faqs/${id}`,author:`/api/authors/${id}`};await json(urls[type],{method:'DELETE',headers:authHeaders()});await ({lead:loadLeads,article:loadArticles,case:loadCases,faq:loadFaq,author:loadAuthors}[type])();toast('已删除')}catch(error){alert(error.message)}}
let edit={type:null,id:null};
const fields={article:[['title','标题','input'],['slug','Slug','input'],['category','分类','input'],['summary','GEO 摘要','textarea'],['content','正文 HTML','textarea'],['coverImage','封面 URL','input'],['tags','标签 JSON','textarea'],['authorId','作者 ID','input'],['publishDate','发布时间','input'],['seoTitle','SEO 标题','input'],['seoDescription','SEO 描述','textarea'],['seoKeywords','SEO 关键词 JSON','textarea'],['qa','GEO 问答 JSON','textarea'],['geoScore','GEO 评分','input'],['geoDimensions','GEO 维度 JSON','textarea'],['status','状态','input']],case:[['title','标题','input'],['client','客户','input'],['industry','行业','input'],['cover','封面 URL','input'],['tags','标签 JSON','textarea'],['background','背景','textarea'],['problems','问题 JSON','textarea'],['goals','目标 JSON','textarea'],['solutions','方案 JSON','textarea'],['resultTags','成果标签 JSON','textarea'],['stats','数据成果 JSON','textarea'],['featuredOrder','精选排序','input'],['order','列表排序','input'],['status','状态','input']],faq:[['question','问题','input'],['answer','答案 HTML','textarea'],['status','状态','radio']],author:[],page:[['title','标题','input'],['sections','页面区块 JSON','textarea']]};
const ARTICLE_STATUSES=['draft','published','archived','scheduled'];const JSON_FIELDS=new Set(['sections','tags','problems','goals','solutions','resultTags','stats','seoKeywords','qa','geoDimensions']);const NUMBER_FIELDS=new Set(['order','featuredOrder','geoScore']);
function openEditor(type,id=null){if(type==='article'||type==='case'){if(window.openStudio){openStudio(type,id);return}else{console.warn('openStudio not found, fallback to modal');}}edit={type,id};document.getElementById('editorTitle').textContent=(id?'编辑':'新增')+({faq:' FAQ',author:'专家',page:'页面内容'}[type]);let html='';if(type==='author'){html=`<div class="author-form-grid"><div class="author-field"><label>姓名 <span class="required">*</span></label><input id="field-name" type="text" placeholder="输入姓名"></div><div class="author-field"><label>前台展示</label><select id="field-status"><option value="active">展示</option><option value="hidden">隐藏</option></select></div></div><div class="author-field"><label>头衔 <span class="required">*</span></label><input id="field-detail" type="text" placeholder="如：瑞华智策 副总裁 · 新质组织研究中心主任"></div><div class="author-field"><label>简介</label><textarea id="field-desc" rows="4" placeholder="输入专家简介..."></textarea></div><div class="author-field"><label>照片 <small>建议 1:1, ≥600px；上传后转为站内资源，不再依赖外链</small></label><div class="author-photo-upload"><div class="author-photo-preview" id="authorPhotoPreview">无</div><input type="file" id="authorPhotoInput" accept="image/*"><button type="button" class="upload-btn" onclick="document.getElementById('authorPhotoInput').click()">选择文件</button><span class="upload-hint" id="authorPhotoHint">未选择任何文件</span><input type="hidden" id="field-avatar"></div></div>`;}else{html=(fields[type]||[]).map(([key,label,tag])=>{if(tag==='radio'){return `<div class="field-group"><label>${label}</label><div class="radio-group"><label><input type="radio" name="field-${key}" value="published" checked> 已发布</label><label><input type="radio" name="field-${key}" value="draft"> 草稿</label></div></div>`}return `<label>${label}<${tag} id="field-${key}" ${tag==='textarea'?'rows="5"':''}></${tag}></label>`}).join('');}document.getElementById('editorForm').innerHTML=html;document.getElementById('editorModal').classList.add('show');document.getElementById('editorModal').setAttribute('aria-hidden','false');if(id)loadEditor(type,id);if(type==='author'){document.getElementById('authorPhotoInput')?.addEventListener('change',async(e)=>{const file=e.target.files[0];if(!file)return;document.getElementById('authorPhotoHint').textContent='上传中...';const userId=(id||'default').replace(/[^a-zA-Z0-9_-]/g,'_');const fd=new FormData();fd.append('file',file);try{const r=await fetch('/api/upload/author/'+encodeURIComponent(userId),{method:'POST',headers:{Authorization:'Bearer '+sessionStorage.getItem('token')},body:fd});const contentType=r.headers.get('content-type')||'';let d;if(contentType.includes('application/json')){d=await r.json();}else{const t=await r.text();try{d=JSON.parse(t);}catch(_){d={success:false,error:'服务器返回格式错误 (HTTP '+r.status+')'};}}if(!r.ok)throw new Error(d?.error||('上传失败 (HTTP '+r.status+')'));if(d.error)throw new Error(d.error);document.getElementById('field-avatar').value=d.url;document.getElementById('authorPhotoPreview').innerHTML=`<img src="${d.url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;document.getElementById('authorPhotoHint').textContent='已上传';}catch(err){document.getElementById('authorPhotoHint').textContent='上传失败';alert(err.message);}})}}
async function loadEditor(type,id){try{const urls={article:`/api/admin/articles/${id}`,faq:`/api/faqs/${id}`,author:'/api/authors',page:'/api/admin/pages'};let data=type==='case'?state.cases.find(x=>x._id===id):type==='faq'?state.faqs.find(x=>x._id===id):type==='author'?state.authors.find(x=>x._id===id):await json(urls[type],{headers:authHeaders()});if(type==='page')data=(data.data||[]).find(x=>x.key===id);if(type==='author'){document.getElementById('field-name').value=data.name||'';document.getElementById('field-status').value=data.status||'active';document.getElementById('field-detail').value=data.detail||'';document.getElementById('field-desc').value=data.desc||'';document.getElementById('field-avatar').value=data.avatar||'';if(data.avatar){document.getElementById('authorPhotoPreview').innerHTML=`<img src="${esc(data.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;document.getElementById('authorPhotoHint').textContent='已上传';}}else{(fields[type]||[]).forEach(([key,label,tag])=>{let value=data?.[key]??'';if(tag==='radio'){const radios=document.querySelectorAll(`input[name="field-${key}"]`);radios.forEach(radio=>radio.checked=radio.value===(value||'published'));}else{if(JSON_FIELDS.has(key))value=JSON.stringify(value,null,2);const el=document.getElementById('field-'+key);if(el)el.value=value}})}}catch(error){alert(error.message)}}
function closeEditor(){document.getElementById('editorModal').classList.remove('show');document.getElementById('editorModal').setAttribute('aria-hidden','true')}
function openPassword(){const modal=document.getElementById('passwordModal');document.getElementById('passwordForm').reset();modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.getElementById('currentPassword').focus()}
function closePassword(){const modal=document.getElementById('passwordModal');modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}
async function logout(){try{await json('/api/logout',{method:'POST',headers:authHeaders()})}catch(error){}sessionStorage.clear();localStorage.removeItem('adminToken');localStorage.removeItem('adminUser');location.href='/admin/index.html'}
async function changePassword(){const currentPassword=document.getElementById('currentPassword').value;const newPassword=document.getElementById('newPassword').value;const confirmPassword=document.getElementById('confirmPassword').value;if(newPassword!==confirmPassword){alert('两次输入的新密码不一致');return}if(newPassword.length<8||!/[a-zA-Z]/.test(newPassword)||!/\d/.test(newPassword)){alert('新密码至少 8 位且需包含字母和数字');return}try{await json('/api/auth/password',{method:'PUT',headers:authHeaders(),body:JSON.stringify({currentPassword,newPassword})});closePassword();toast('密码已修改，请重新登录');setTimeout(logout,900)}catch(error){alert(error.message)}}
async function saveEditor(){try{const data={};if(edit.type==='author'){data.name=document.getElementById('field-name').value;data.status=document.getElementById('field-status').value;data.detail=document.getElementById('field-detail').value;data.desc=document.getElementById('field-desc').value;data.avatar=document.getElementById('field-avatar').value;}else{(fields[edit.type]||[]).forEach(([key,label,tag])=>{if(tag==='radio'){const checked=document.querySelector(`input[name="field-${key}"]:checked`);data[key]=checked?checked.value:'published';}else{let value=document.getElementById('field-'+key)?.value;if(JSON_FIELDS.has(key))value=JSON.parse(value||'[]');if(NUMBER_FIELDS.has(key))value=Number(value)||0;data[key]=value}});}const base={article:'/api/articles',case:'/api/cases',faq:'/api/faqs',author:'/api/authors',page:'/api/admin/pages'}[edit.type];const url=edit.type==='page'?`${base}/${encodeURIComponent(edit.id)}`:(edit.id?`${base}/${edit.id}`:base);await json(url,{method:edit.id?'PUT':'POST',headers:authHeaders(),body:JSON.stringify(data)});closeEditor();await ({article:loadArticles,case:loadCases,faq:loadFaq,author:loadAuthors,page:loadPages}[edit.type])();toast('保存成功')}catch(error){alert(error.message)}}
function renderRank(id,list){document.getElementById(id).innerHTML=list.length?list.map(x=>`<div class="rank-row"><span>${esc(x._id||'未标记')}</span><b>${x.leads}</b></div>`).join(''):'<p>暂无数据</p>'}
async function loadAttribution(){try{const q=new URLSearchParams();['startDate','endDate'].forEach(key=>{const value=document.getElementById(key).value;if(value)q.set(key,value)});const d=await json('/api/admin/appointments/attribution?'+q,{headers:authHeaders()});document.getElementById('attributionTotal').textContent=d.data.total;renderRank('channelStats',d.data.sources);renderRank('campaignStats',d.data.campaigns)}catch(error){document.getElementById('attributionTotal').textContent='—';renderRank('channelStats',[]);renderRank('campaignStats',[])}}
function switchView(button,{historyMode='push'}={}){const target=button.dataset.target;if(state.activeView==='leads'&&target!=='leads')closeLead();state.activeView=target;document.querySelectorAll('[data-target],.view').forEach(el=>el.classList.remove('active'));button.classList.add('active');document.querySelector(`[data-view="${target}"]`).classList.add('active');document.getElementById('viewTitle').textContent=TITLES[target];document.getElementById('viewCrumb').textContent=target.toUpperCase();restoreFilters(target);if(historyMode!=='none'){const url=BUSINESS_ROUTES.has(target)?`/admin/${target}`:`/admin/console.html#${target}`;if(historyMode==='replace')history.replaceState(null,'',url);else history.pushState(null,'',url);if(BUSINESS_ROUTES.has(target)&&FILTERS[target])syncFiltersToUrl()}document.getElementById('sidebar').classList.remove('open');const loader={leads:()=>loadLeads({page:1}),'ai-forms':loadAiForms,articles:loadArticles,cases:loadCases,featured:loadCases,faq:loadFaq,experts:loadAuthors,settings:loadGlobalConfig,'email-marketing':window.reportCampaignLoad,crm:window.crmLoad}[target]||(target.startsWith('nqoc-')&&window.nqocLoad?()=>window.nqocLoad(target):null);if(loader)loader()}
function restoreRoute(){const target=routeFromLocation();const requested=document.querySelector(`[data-target="${target}"]:not([hidden])`);const button=requested||document.querySelector('[data-target]:not([hidden])');if(button)switchView(button,{historyMode:'none'})}
async function exportLeads() {
    try {
        const response = await fetch(leadApi + '/export?' + leadParams(), { headers: authHeaders() });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || '导出失败');
        const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
        link.href = url;
        link.download = 'leads.csv';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast(error.message); }
}
const clickActions={'load-leads':()=>loadLeads(),'reset-leads':resetLeads,'previous-leads':()=>loadLeads({page:leadListState.page-1,refreshSummary:false}),'next-leads':()=>loadLeads({page:leadListState.page+1,refreshSummary:false}),'export-leads':exportLeads,'load-ai-forms':loadAiForms,'export-ai-forms':exportAiForms,'close-ai-form':closeAiForm,'close-drawer':closeDrawer,'close-editor':closeEditor,'save-editor':saveEditor,'close-lead':closeLead,'save-global-config':()=>saveGlobalConfig(collectGlobalConfig()),'test-notification':testNotification,'add-recipient':()=>openRecipientEditor(),'close-recipient':closeRecipientEditor,'save-recipient':saveRecipient,'change-password':openPassword,'close-password':closePassword,'submit-password':changePassword,logout};
document.addEventListener('click',event=>{const target=event.target.closest('[data-target],[data-action]');if(!target)return;if(target.dataset.target){switchView(target);return}const actionName=target.dataset.action;if(actionName==='open-editor')openEditor(target.dataset.type,target.dataset.id||null);else if(actionName==='remove-item')removeItem(target.dataset.type,target.dataset.id);else if(actionName==='open-lead')openLead(target.dataset.id);else if(actionName==='open-ai-form')openAiForm(target.dataset.id);else if(actionName==='remove-ai-form')removeAiForm(target.dataset.id);else if(actionName==='remove-featured')toggleFeatured(target.dataset.id,false);else if(actionName==='move-featured')moveFeatured(target.dataset.id,target.dataset.step);else if(actionName==='move-faq')moveFaq(target.dataset.id,target.dataset.step);else if(actionName==='toggle-author-status')toggleAuthorStatus(target.dataset.id);else if(actionName==='remove-city')removeConfigCity(Number(target.dataset.index));else if(actionName==='edit-recipient')openRecipientEditor(target.dataset.index);else if(actionName==='toggle-recipient'){const index=Number(target.dataset.index);const recipients=[...state.globalConfig.recipients];recipients[index]={...recipients[index],enabled:recipients[index].enabled===false};saveGlobalConfig({recipients})}else if(actionName==='remove-recipient'){if(confirm('确认删除这个接收人？')){const index=Number(target.dataset.index);const recipients=state.globalConfig.recipients.filter((_,itemIndex)=>itemIndex!==index);const removed=state.globalConfig.recipients[index];const fallbackRecipient=String(state.globalConfig.fallbackRecipient||'')===String(removed?._id||index)?(recipients[0]?._id||null):state.globalConfig.fallbackRecipient;saveGlobalConfig({recipients,fallbackRecipient})}}else if(actionName==='article-zone'){state.articleZone=target.dataset.value;document.querySelectorAll('#articleZone button').forEach(x=>x.classList.toggle('on',x===target));renderArticles();syncFiltersToUrl()}else if(clickActions[actionName])clickActions[actionName]()});
document.addEventListener('change',event=>{const target=event.target.closest('[data-action]');if(target?.dataset.action==='toggle-featured')toggleFeatured(target.dataset.id,target.checked);if(event.target.id==='config-qrFile')previewQrFile(event.target.files[0]);if(['leadStatus','leadChannel','leadTime'].includes(event.target.id))filterLeads();if(event.target.id==='articleStatus')renderArticles();if(['caseIndustry','caseStatus'].includes(event.target.id))renderCases();if(['aiFormDept','aiFormSynced','aiFormTime'].includes(event.target.id))renderAiForms();if(Object.keys(FILTERS[state.activeView]||{}).includes(event.target.id))syncFiltersToUrl()});
document.addEventListener('input',event=>{if(event.target.id==='leadKeyword'){clearTimeout(leadListState.timer);++leadListState.request;document.querySelector('[data-action="export-leads"]').disabled=true;leadListState.timer=setTimeout(() => {if(state.activeView==='leads')filterLeads()},280)}if(event.target.id==='articleKeyword')renderArticles();if(event.target.id==='caseKeyword')renderCases();if(event.target.id==='featuredKeyword')renderFeatured();if(event.target.id==='aiFormKeyword')renderAiForms();if(Object.keys(FILTERS[state.activeView]||{}).includes(event.target.id))syncFiltersToUrl()});
document.addEventListener('keydown',event=>{if(event.target.id==='config-cityInput'&&event.key==='Enter'){event.preventDefault();addConfigCity()}if(event.key==='Escape'){closeLead();closeAiForm();closeEditor();closeRecipientEditor()}});
document.getElementById('leadFilters').addEventListener('submit', event => {
    event.preventDefault();
    void filterLeads();
});
leadStatusInput.addEventListener('change', () => {
    document.getElementById('leadStatusError').textContent = '';
    leadStatusSave.disabled = !activeLead || leadStatusInput.value === (activeLead.status || 'new');
});
leadStatusForm.addEventListener('submit', event => {
    event.preventDefault();
    void updateLead();
});
leadDrawerBody.addEventListener('submit', event => {
    if (event.target.id !== 'leadFollowForm') return;
    event.preventDefault();
    void addLeadNote(event.target);
});
leadDrawer.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...leadDrawer.querySelectorAll('button, textarea, select, summary, a[href]')].filter(node => !node.disabled && node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
const menuToggle=document.getElementById('menuToggle');if(menuToggle)menuToggle.addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
const nqocToggle=document.querySelector('.nqoc-toggle');const nqocItems=document.getElementById('nqocNavItems');if(nqocToggle&&nqocItems){const sidebarGroupsKey='adminSidebarGroups';let sidebarGroups={};try{sidebarGroups=JSON.parse(localStorage.getItem(sidebarGroupsKey)||'{}')||{}}catch(error){sidebarGroups={}}const setNqocExpanded=expanded=>{nqocToggle.setAttribute('aria-expanded',String(expanded));nqocItems.hidden=!expanded};setNqocExpanded(sidebarGroups.nqoc===true||/^\/admin\/nqoc-/.test(location.pathname)||/^nqoc-/.test(location.pathname.split('/').filter(Boolean).pop()||''));nqocToggle.addEventListener('click',()=>{const expanded=nqocToggle.getAttribute('aria-expanded')!=='true';setNqocExpanded(expanded);sidebarGroups.nqoc=expanded;localStorage.setItem(sidebarGroupsKey,JSON.stringify(sidebarGroups))})}
document.getElementById('currentUserName').textContent=currentUser.name||currentUser.username||'瑞华管理员';
window.addEventListener('popstate',restoreRoute);
applyPermissions();
restoreRoute();
