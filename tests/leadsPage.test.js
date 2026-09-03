const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('线索页原型实现', function () {
  it('统计严格为今日新增、待跟进、AI 顾问和确认商机', function () {
    const html = read('admin/console.html');
    const script = read('admin/js/admin-2026.js');
    assert.match(html, /id="leadStats"[\s\S]*今日新增[\s\S]*data-stat="today"[\s\S]*待跟进[\s\S]*data-stat="pending"[\s\S]*AI 顾问[\s\S]*data-stat="agent"[\s\S]*确认商机[\s\S]*data-stat="opp"/);
    assert.doesNotMatch(html, /id="leadStats"[\s\S]*data-stat="total"/);
    assert.match(script, /counts=\{today:[\s\S]*pending:[\s\S]*agent:[\s\S]*opp:/);
  });

  it('线索表格严格七列并包含入口路径与意向', function () {
    const html = read('admin/console.html');
    const leadHead = html.match(/data-view="leads"[\s\S]*?<thead><tr>([\s\S]*?)<\/tr><\/thead>/)[1];
    assert.deepStrictEqual(
      [...leadHead.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map(match => match[1]),
      ['联系人', '联系方式', '来源渠道', '入口 / 留资页面路径', '意向方向', '状态', '留资时间']
    );
    assert.match(read('admin/js/admin-2026.js'), /leadPage[\s\S]*intentTags/);
  });

  it('列表严格按 DEMO 1147-1155 行展示联系方式与路径双层信息', function () {
    const script = read('admin/js/admin-2026.js');
    const renderLeads = script.match(/function renderLeads\(\)[\s\S]*?function openLead/)[0];
    assert.match(renderLeads, /<td><div class="mono"[^>]*>\$\{esc\(x\.phone\|\|'—'\)\}<\/div><div class="sub">\$\{esc\(x\.title\|\|'—'\)\}<\/div><\/td>/);
    assert.match(renderLeads, /class="mono lead-page"[^>]*>\$\{esc\(x\.leadPage\|\|x\.landing_page\|\|'—'\)\}/);
    assert.match(renderLeads, /\$\{esc\(x\.ref\|\|x\.referrer\|\|x\.source\|\|'—'\)\} · 浏览 \$\{trailCount\} 页/);
    assert.match(renderLeads, /talkCount\?' · 问了 '\+talkCount\+' 个问题':''/);
    assert.match(renderLeads, /filter\(message=>message\?\.r==='me'\)\.length/);
  });

  it('来源渠道显示中文枚举', function () {
    const script = read('admin/js/admin-2026.js');
    ['direct', 'agent', 'form', 'demo', 'referral', 'organic'].forEach(channel => {
      assert.match(script, new RegExp(`${channel}:'[^']*[\\u4e00-\\u9fa5][^']*'`));
    });
    assert.match(script, /channelText\(/);
  });

  it('提供五种线索状态并使用状态筛选', function () {
    const html = read('admin/console.html');
    const script = read('admin/js/admin-2026.js');
    ['new', 'contacted', 'opp', 'won', 'closed'].forEach(status => assert.match(html, new RegExp(`value="${status}"`)));
    ['contacted', 'opp', 'won', 'closed'].forEach(status => assert.match(script, new RegExp(`${status}:[^,}]+`)));
  });

  it('详情逐项展示访问轨迹、对话 RAG 来源和跟进记录', function () {
    const script = read('admin/js/admin-2026.js');
    ['访问轨迹', 'AI 顾问对话', 'RAG 来源', '跟进记录', 'addLeadNote', 'data-trail-item', 'item.talk', 'item.notes'].forEach(field => assert.match(script, new RegExp(field)));
    assert.match(script, /item\.trail[\s\S]*\.map/);
    assert.match(script, /item\.talk[\s\S]*\.map/);
    assert.match(script, /item\.notes[\s\S]*\.map/);
    assert.match(read('models/Appointment.js'), /talk:[\s\S]*rag:[\s\S]*src:/);
  });

  it('RAG 来源兼容字符串和数组且不会把字符串拆成单字', function () {
    const script = read('admin/js/admin-2026.js');
    assert.match(script, /const list=value=>Array\.isArray\(value\)\?value:value\?\[value\]:\[\]/);
    assert.match(script, /\.\.\.list\(message\.rag\)/);
    assert.doesNotMatch(script, /\.\.\.\(message\.rag\|\|\[\]\)/);
  });

  it('提供语义化 leads 管理接口并保留旧 appointments 兼容接口', function () {
    const server = read('server.js');
    assert.match(server, /app\.get\('\/api\/admin\/leads'/);
    assert.match(server, /app\.get\('\/api\/admin\/leads\/:id'/);
    assert.match(server, /app\.patch\('\/api\/admin\/leads\/:id\/status'/);
    assert.match(server, /app\.patch\('\/api\/admin\/leads\/:id\/remarks'/);
    assert.match(server, /app\.post\('\/api\/admin\/leads\/:id\/follow-ups'/);
    assert.match(server, /app\.get\('\/api\/admin\/leads\/export'/);
    assert.match(server, /findOneAndUpdate\([\s\S]*\$push:\s*\{\s*notes/);
  });

  it('新版线索前端使用语义化 leads 接口并按权限显示操作', function () {
    const script = read('admin/js/admin-2026.js');
    assert.match(script, /json\('\/api\/admin\/leads/);
    assert.match(script, /follow-ups/);
    assert.match(script, /lead:edit/);
    assert.match(script, /lead:export/);
  });

  it('统计副文案严格还原 DEMO 并支持四个动态值', function () {
    const html = read('admin/console.html');
    assert.match(html, /今日新增线索/);
    assert.match(html, /待跟进（新线索）/);
    assert.match(html, /超 24h 未联系[\s\S]*data-stat="overdue"/);
    assert.match(html, /来自 AI 顾问[\s\S]*占总量[\s\S]*data-stat="agentRate"/);
    assert.match(html, /已确认商机[\s\S]*本月转化[\s\S]*data-stat="wonMonth"/);
    assert.match(read('admin/js/admin-2026.js'), /overdue:[\s\S]*agentRate:[\s\S]*wonMonth:/);
  });

  it('来源筛选包含 agent、form、demo 并同步列表 API 与导出', function () {
    const html = read('admin/console.html');
    const script = read('admin/js/admin-2026.js');
    assert.match(html, /id="leadChannel"[\s\S]*value="agent"[\s\S]*value="form"[\s\S]*value="demo"/);
    assert.match(script, /leadChannel/);
    assert.match(script, /q\.set\('channel'/);
    assert.match(script, /export\?[\s\S]*channel/);
    const server = read('server.js');
    assert.match(server, /query\.channel\s*=\s*req\.query\.channel/);
    assert.match(server, /export[\s\S]*query\.channel/);
  });

  it('筛选栏严格还原 DEMO 文案并用 flex spacer 将导出按钮推至最右', function () {
    const html = read('admin/console.html');
    const filters = html.match(/<div class="filters" data-lead-filters>[\s\S]*?<\/div>/)[0];
    assert.match(filters, /AI 顾问抽屉/);
    assert.match(filters, /预约诊断表单/);
    assert.match(filters, /首页演示小窗/);
    assert.match(filters, /<span class="spacer"><\/span>[\s\S]*>导出 CSV<\/button>/);
  });

  it('来源单元格使用带 dot 的 chip，并按 DEMO 使用紫、暖黄、杏色', function () {
    const script = read('admin/js/admin-2026.js');
    const css = read('admin/admin-2026.css');
    assert.match(script, /channelChip\(/);
    assert.match(script, /agent:\['AI 顾问抽屉',''\]/);
    assert.match(script, /form:\['预约诊断表单','w'\]/);
    assert.match(script, /demo:\['首页演示小窗','a'\]/);
    assert.match(script, /class="dot"/);
    assert.match(css, /\.chip\.w\{[^}]*background:#fff8e6/);
    assert.match(css, /\.chip\.a\{[^}]*background:#fff3ec/);
    assert.match(css, /\.chip \.dot\{[^}]*border-radius:50%/);
  });

  it('意向方向逐项渲染为 tag，不再拼成纯文本', function () {
    const script = read('admin/js/admin-2026.js');
    assert.match(script, /const intentTags=value=>list\(value\)\.map\(intent=>`<span class="intent-tag">/);
    assert.match(script, /<td>\$\{intentTags\(x\.intents\|\|x\.intent\|\|x\.service\)\}<\/td>/);
  });

  it('列表状态显示 chip，状态修改只在详情抽屉中提供', function () {
    const script = read('admin/js/admin-2026.js');
    const renderLeads = script.match(/function renderLeads\(\)[\s\S]*?function openLead/)[0];
    assert.match(renderLeads, /<td>\$\{chip\(x\.status\)\}<\/td>/);
    assert.doesNotMatch(renderLeads, /<select/);
    assert.match(script, /id="leadDrawerStatus"[\s\S]*data-action="update-lead"/);
  });

  it('留资时间以 ago 为主文案并显示 mono MM-DD HH:mm 副文案', function () {
    const script = read('admin/js/admin-2026.js');
    assert.match(script, /const ago=v=>/);
    assert.match(script, /const shortDateTime=v=>/);
    assert.match(script, /class="lead-time"[\s\S]*ago\(x\.createdAt\)[\s\S]*class="sub mono"[\s\S]*shortDateTime\(x\.createdAt\)/);
  });

  it('线索详情抽屉严格使用 DEMO 的头部、sec/kv body 与底部状态选择器', function () {
    const html = read('admin/console.html');
    const script = read('admin/js/admin-2026.js');
    const openLead = script.match(/function openLead\(id\)[\s\S]*?function closeLead/)[0];
    assert.match(html, /id="leadDrawer"[\s\S]*id="leadDrawerName"[\s\S]*id="leadDrawerStatusChip"[\s\S]*id="leadDrawerSub"/);
    assert.match(html, /id="leadDrawerFooter"[\s\S]*id="leadDrawerStatus"/);
    assert.match(openLead, /<section class="sec"><h3>联系方式<\/h3><dl class="kv">/);
    assert.match(openLead, /<section class="sec"><h3>从哪来 · 怎么走到留资的<\/h3><dl class="kv">/);
    assert.match(openLead, /触发方式[\s\S]*外部来源[\s\S]*落地页[\s\S]*留资页面[\s\S]*设备[\s\S]*<div class="trail">\$\{trail\}<\/div>/);
    assert.doesNotMatch(openLead, /<section class="sec"><h3>访问轨迹/);
    assert.match(openLead, /channelChip\(item\.channel/);
    assert.match(openLead, /class="tr \$\{step\.hit\?'hit':''\}"/);
    assert.match(openLead, /class="talk"/);
    assert.match(openLead, /class="msg \$\{message\.r==='me'\?'me':'ai'\}"/);
    assert.match(openLead, /class="who"/);
    assert.match(openLead, /class="bub"/);
    assert.match(openLead, /RAG 来源/);
    assert.match(openLead, /class="src-tag"/);
    assert.match(openLead, /class="notes" id="leadNotes"/);
    assert.match(openLead, /class="note"/);
  });

  it('补齐线索行、抽屉原型 DOM 与状态样式的 CSS', function () {
    const css = read('admin/admin-2026.css');
    assert.match(css, /#leadList tr\[data-action="open-lead"\]\{[^}]*cursor:pointer/);
    assert.match(css, /\.intent-tag\{[^}]*border-radius:7px/);
    assert.match(css, /\.lead-time\{[^}]*font-size:12\.5px/);
    assert.match(css, /\.lead-time \.mono\{[^}]*font-family:var\(--mono\)/);
    ['.sec','.kv','.trail','.tr','.msg','.msg.me','.msg.ai','.who','.bub','.notes','.note'].forEach(selector => {
      assert.match(css, new RegExp(selector.replace('.', '\\\.') + '\\\{'));
    });
    assert.match(css, /\.chip\.contacted\{[^}]*background:#fff3ec/);
    assert.match(css, /\.chip\.opp\{[^}]*background:#fff8e6/);
    assert.match(css, /\.chip\.won\{[^}]*background:#f4f8e4/);
    assert.match(css, /\.chip\.closed\{[^}]*background:var\(--soft\)/);
  });
});
