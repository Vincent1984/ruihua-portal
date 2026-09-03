const assert = require('assert');
const path = require('path');
const { extractBackendData, normalizeBackendData } = require(path.join(__dirname, '../scripts/import-2026-content.js'));

describe('2026 后台 HTML 内容导入', function () {
  it('提取后台原型中的 14 条线索、10 篇文章、27 个案例、6 个 FAQ、6 位专家和配置', function () {
    const data = extractBackendData();
    assert.strictEqual(data.leads.length, 14);
    assert.strictEqual(data.articles.length, 10);
    assert.strictEqual(data.cases.length, 27);
    assert.strictEqual(data.faqs.length, 6);
    assert.strictEqual(data.experts.length, 6);
    assert.strictEqual(data.config.tel, '400-175-0886');
  });

  it('使用稳定的外部 ID 保存线索，保证重复导入不会新增记录', function () {
    const Appointment = require(path.join(__dirname, '../models/Appointment.js'));
    assert.ok(Appointment.schema.path('externalId'));
    assert.strictEqual(Appointment.schema.path('externalId').options.unique, true);
  });

  it('将后台配置字段映射为 GlobalConfig 可保存的字段', function () {
    const data = normalizeBackendData(extractBackendData());
    assert.deepStrictEqual(data.config.notificationChannels, ['企业微信群机器人', '短信']);
    assert.strictEqual(data.config.escalationHours, 12);
    assert.strictEqual(data.config.dailyDigest, '09:00');
    assert.strictEqual(data.config.fallbackRecipient, undefined);
    assert.strictEqual(data.config.key, 'website');
  });
});
