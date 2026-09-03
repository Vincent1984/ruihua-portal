const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function schemaPath(modelFile, name) {
  const model = require(path.join(ROOT, modelFile));
  return model.schema.path(name);
}

describe('2026 内容管理模型与 API 扩展', function () {
  it('线索保留设计稿要求的来源、浏览、问答和跟进上下文，并兼容原状态', function () {
    ['email', 'intents', 'leadPage', 'trigger', 'device', 'trail', 'kb', 'talk', 'notes', 'remarks']
      .forEach(field => assert.ok(schemaPath('models/Appointment.js', field), field));

    const status = schemaPath('models/Appointment.js', 'status');
    ['new', 'processed', 'archived', 'contacted', 'opp', 'won', 'closed']
      .forEach(value => assert.ok(status.enumValues.includes(value), value));
  });

  it('文章将所属栏目、内容状态、上架和置顶拆成独立字段', function () {
    const zone = schemaPath('models/Article.js', 'zone');
    const contentStatus = schemaPath('models/Article.js', 'contentStatus');

    assert.deepStrictEqual(zone.enumValues, ['industry', 'thinktank']);
    assert.deepStrictEqual(contentStatus.enumValues, ['full', 'toc', 'soon']);
    assert.ok(schemaPath('models/Article.js', 'isOnline'));
    assert.ok(schemaPath('models/Article.js', 'top'));
  });

  it('案例和 FAQ 支持独立上下架，精选仍复用案例数据且最多返回六条', function () {
    assert.ok(schemaPath('models/Case.js', 'isOnline'));
    assert.ok(schemaPath('models/Faq.js', 'isOnline'));

    const routes = read('routes/contentRoutes.js');
    assert.match(routes, /Case\.find\(\{ status: 'published', isOnline: \{ \$ne: false \}, featured: true \}\)/);
    assert.match(routes, /\.limit\(6\)/);
    assert.match(routes, /countDocuments\(\{[^}]*featured: true/);
  });

  it('提供结构化全局配置模型和前后台 API，同时不替换原 Setting 接口', function () {
    const config = require(path.join(ROOT, 'models/GlobalConfig.js'));
    ['tel', 'mail', 'cities', 'icp', 'qr', 'oldDomain', 'newDomain', 'logo', 'notificationChannels',
      'escalationHours', 'dailyDigest', 'fallbackRecipient', 'recipients']
      .forEach(field => assert.ok(config.schema.path(field), field));

    const routes = read('routes/contentRoutes.js');
    assert.match(routes, /app\.get\('\/api\/global-config'/);
    assert.match(routes, /app\.get\('\/api\/admin\/global-config'/);
    assert.match(routes, /app\.put\('\/api\/admin\/global-config'/);
    assert.match(read('server.js'), /app\.get\('\/api\/banner'/);
    assert.match(read('server.js'), /app\.get\('\/api\/sidebar\/modules'/);
  });

  it('全局配置后台支持通知测试接口，控制台覆盖配置与接收人 CRUD', function () {
    const routes = read('server.js');
    const script = read('admin/js/admin-2026.js');
    const html = read('admin/console.html');
    assert.match(routes, /app\.post\('\/api\/test-dingtalk', authRequired/);
    assert.match(script, /\/api\/admin\/global-config/);
    assert.match(script, /\/api\/test-dingtalk/);
    ['tel', 'mail', 'cities', 'icp', 'qr', 'oldDomain', 'newDomain', 'logo', 'notificationChannels', 'escalationHours', 'dailyDigest']
      .forEach(field => assert.match(html, new RegExp(`config-${field}`)));
    ['add-recipient', 'edit-recipient', 'remove-recipient', 'toggle-recipient']
      .forEach(action => assert.match(script, new RegExp(action)));
  });

  it('全局配置严格复刻 DEMO 的提示、双栏卡片、接收人表和底部操作', function () {
    const html = read('admin/console.html');
    const css = read('admin/admin-2026.css');
    const script = read('admin/js/admin-2026.js');

    assert.match(html, /data-view="settings"[\s\S]*?清单 <b>C 节 \+ D 节<\/b>/);
    ['联系方式 · 全站页脚', '公众号二维码', '全局外链域名', '线索通知规则']
      .forEach(title => assert.match(html, new RegExp(title)));
    ['config-cityInput', 'config-qrPreview', 'config-qrFile', 'config-notificationChannels',
      'config-fallbackRecipient', 'recipientRows', 'configSaved']
      .forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
    ['姓名 / 角色', '接收账号', '负责的意向方向', '接收渠道', '启用', '操作']
      .forEach(heading => assert.match(html, new RegExp(heading)));
    assert.match(html, />保存全局配置<\/button>/);
    assert.match(html, />发送一条测试通知<\/button>/);
    assert.match(css, /\.settings-grid\{[^}]*grid-template-columns:1fr 1fr/);
    assert.match(css, /\.city-chip/);
    assert.match(css, /\.recipient-switch/);
    assert.match(script, /function addConfigCity/);
    assert.match(script, /function previewQrFile/);
    assert.match(script, /function openRecipientEditor/);
    assert.match(script, /fallbackRecipient/);
  });

  it('公开列表只展示已上架内容，旧响应外形保持不变', function () {
    const server = read('server.js');
    const routes = read('routes/contentRoutes.js');

    assert.match(server, /query\.status = 'published';[\s\S]{0,120}query\.isOnline = \{ \$ne: false \}/);
    assert.match(server, /const query = \{ status: \{ \$in: \['published', undefined\] \}, isOnline: \{ \$ne: false \} \}/);
    assert.match(server, /res\.json\(articles\)/);
    assert.match(server, /res\.json\(faqs\)/);
    assert.match(routes, /res\.json\(\{ success: true, data: list \}\)/);
  });

  it('后台文章查询声明所有扩展筛选变量', function () {
    const server = read('server.js');
    assert.match(server, /const \{ keyword, category, featured, page, limit, status, tag, zone, contentStatus, isOnline \} = req\.query;/);
  });

  it('公开文章与 FAQ 详情只返回已发布且已上架内容', function () {
    const server = read('server.js');
    assert.strictEqual((server.match(/Article\.findOne\(\{ slug, status: 'published', isOnline: \{ \$ne: false \} \}\)/g) || []).length, 3);
    assert.match(server, /Article\.findOne\(\{ _id: id, status: 'published', isOnline: \{ \$ne: false \} \}\)/);
    assert.match(server, /Faq\.findOne\(\{ _id: req\.params\.id, status: \{ \$in: \['published', undefined\] \}, isOnline: \{ \$ne: false \} \}\)/);
  });

  it('SSR 案例列表过滤下架案例', function () {
    assert.match(read('routes/frontendRoutes2026.js'), /Case\.find\(\{ status: 'published', isOnline: \{ \$ne: false \} \}\)/);
  });

  it('线索模型继续接受旧 completed 状态', function () {
    assert.ok(schemaPath('models/Appointment.js', 'status').enumValues.includes('completed'));
  });
});
