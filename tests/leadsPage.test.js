const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('线索页原型实现', function () {
  it('显示四项独立于列表筛选的统计', function () {
    const html = read('admin/console.html');
    const script = read('admin/js/admin-2026.js');
    assert.match(html, /id="leadStats"[\s\S]*今日新增[\s\S]*data-stat="today"[\s\S]*待跟进[\s\S]*data-stat="pending"[\s\S]*AI 顾问[\s\S]*data-stat="agent"[\s\S]*确认商机[\s\S]*data-stat="opp"/);
    assert.match(script, /result\.summary[\s\S]*renderLeadStats\(result\.summary\)/);
    assert.match(read('server.js'), /leadOverviewStats[\s\S]*overdue:[\s\S]*agentRate:[\s\S]*wonMonth:/);
  });

  it('列表按联系人、联系方式、需求、来源、状态和时间组织', function () {
    const html = read('admin/console.html');
    const script = read('admin/js/admin-2026.js');
    const leadHead = html.match(/<table class="website-lead-table"[\s\S]*?<thead[^>]*>([\s\S]*?)<\/thead>/)[1];
    assert.deepStrictEqual(
      [...leadHead.matchAll(/<th[^>]+scope="col"[^>]*>(.*?)<\/th>/g)].map(match => match[1]),
      ['联系人 / 公司', '电话 / 邮箱', '意向 / 需求', '跟进状态', '操作']
    );
    assert.match(script, /\[item\.phone, item\.email\]/);
    assert.match(script, /更多，查看/);
    assert.match(script, /website-lead-demand/);
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
    assert.match(script, /sourceNames\(message\.rag\)/);
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
    assert.match(script, /leadApi='\/api\/admin\/leads'/);
    assert.match(script, /follow-ups/);
    assert.match(script, /lead:edit/);
    assert.match(script, /lead:export/);
  });

  it('按同一组筛选条件加载和导出，列表有实际分页', function () {
    const html = read('admin/console.html');
    const script = read('admin/js/admin-2026.js');
    const server = read('server.js');
    assert.match(html, /id="leadFilters"[\s\S]*清除筛选[\s\S]*id="leadPagination"/);
    assert.match(html, /id="leadChannel"[\s\S]*value="agent"[\s\S]*value="form"[\s\S]*value="demo"/);
    assert.match(script, /const query = leadParams\(\)/);
    assert.match(script, /leadApi \+ '\/export\?' \+ leadParams\(\)/);
    assert.match(script, /query\.set\('page'/);
    assert.match(server, /leadListQuery\(req\.query, now\)/);
    assert.match(server, /Appointment\.find\(leadListQuery\(req\.query\)\)/);
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

  it('意向仍逐项渲染，状态修改需在详情内显式保存', function () {
    const html = read('admin/console.html');
    const script = read('admin/js/admin-2026.js');
    const row = script.match(/function renderLeadRow[\s\S]*?function resetLeads/)[0];
    assert.match(row, /intentTags\(intents\)/);
    assert.match(row, /chip\(item\.status/);
    assert.doesNotMatch(row, /<select/);
    assert.match(html, /<form id="leadDrawerFooter"[\s\S]*id="leadDrawerStatus"[\s\S]*type="submit"[^>]*>保存状态/);
    assert.match(script, /leadStatusForm\.addEventListener\('submit'/);
  });

  it('详情突出联系信息、意向和跟进，访问轨迹与对话可展开', function () {
    const html = read('admin/console.html');
    const script = read('admin/js/admin-2026.js');
    assert.match(html, /id="leadDrawer"[^>]*role="dialog"[^>]*aria-labelledby="leadDrawerName"/);
    assert.match(script, /联系信息[\s\S]*意向与需求[\s\S]*跟进记录[\s\S]*<details[^>]*><summary>留资来源与访问轨迹/);
    assert.match(script, /<details[^>]*><summary>AI 顾问对话/);
    assert.match(script, /<form id="leadFollowForm"[\s\S]*class="notes" id="leadNotes"/);
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
