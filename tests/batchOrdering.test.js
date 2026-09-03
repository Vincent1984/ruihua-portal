const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('t5 批量排序与精选保存', function () {
  it('FAQ 和专家提供受权限保护的批量排序接口', function () {
    const server = read('server.js');

    assert.match(server, /app\.put\('\/api\/faqs\/reorder', authRequired, requirePerm\('faq:edit'\)/);
    assert.match(server, /Faq\.bulkWrite\(/);
    assert.match(server, /app\.put\('\/api\/authors\/reorder', authRequired, requirePerm\('expert:edit'\)/);
    assert.match(server, /Author\.bulkWrite\(/);
  });

  it('专家模型保存排序并按排序返回', function () {
    const model = read('models/Author.js');
    const server = read('server.js');

    assert.match(model, /order:\s*\{ type: Number, default: 0 \}/);
    assert.match(server, /Author\.find\(\)\.sort\(\{ order: 1, createdAt: -1 \}\)/);
  });

  it('精选案例通过单次批量接口校验数量、重复、发布上线和连续顺序', function () {
    const routes = read('routes/contentRoutes.js');

    assert.match(routes, /app\.put\('\/api\/cases\/featured\/batch', authRequired, requirePerm\('featured-case:edit'\)/);
    assert.match(routes, /items\.length > 6/);
    assert.match(routes, /new Set\(ids\)\.size !== ids\.length/);
    assert.match(routes, /status !== 'published'/);
    assert.match(routes, /isOnline === false/);
    assert.match(routes, /order !== index \+ 1/);
    assert.match(routes, /Case\.bulkWrite\(/);
  });

  it('前端三类排序均只发一个批量请求且失败恢复本地状态', function () {
    const script = read('admin/js/admin-2026.js');

    assert.match(script, /\/api\/faqs\/reorder/);
    assert.match(script, /\/api\/authors\/reorder/);
    assert.match(script, /\/api\/cases\/featured\/batch/);
    assert.doesNotMatch(script, /Promise\.all\(state\.faqs\.map/);
    assert.doesNotMatch(script, /Promise\.all\(list\.map/);
    assert.match(script, /state\.faqs=previous/);
    assert.match(script, /state\.authors=previous/);
    assert.match(script, /state\.cases=previous/);
    assert.match(script, /data-action="move-expert"/);
  });
});
