const assert = require('node:assert/strict');
const source = require('../public/js/lead-source');
const { buildAttribution } = require('../routes/appointmentAttributionRoutes');
describe('Lead source and device normalization', () => {
    it('excludes the site and its subdomains while preserving genuine external sources', () => {
        for (const referrer of ['https://ruihuaconsulting.com/', 'https://www.ruihuaconsulting.com/contact', 'https://sub.ruihuaconsulting.com/x']) {
            assert.equal(buildAttribution({ referrer }).external_source, 'direct');
            assert.equal(source.classify({ referrer }).category, '直接访问');
        }
        assert.equal(source.classify({ referrer: 'https://ruihuaconsulting.com.evil.test/' }).category, '外部链接');
    });
    it('distinguishes AI and social subdomains from their parent search domains', () => {
        assert.deepEqual(source.classify({ referrer: 'https://yiyan.baidu.com/' }).platform, '文心');
        assert.equal(source.classify({ referrer: 'https://www.baidu.com/s' }).category, '自然搜索');
        assert.equal(source.classify({ utm_source: 'workbuddy' }).platform, 'WorkBuddy');
        assert.equal(source.classify({ referrer: 'https://mp.weixin.qq.com/s/a' }).platform, '微信公众号');
        assert.equal(source.classify({ referrer: 'https://www.zhihu.com/' }).platform, '知乎');
        assert.equal(source.classify({ utm_source: 'custom-campaign' }).category, '其他');
        assert.equal(source.classify({ utm_source:'new-ai-platform', utm_medium:'ai_search' }).key, 'ai');
    });
    it('recovers Doubao evidence hidden by a legacy direct label and separates touchpoints', () => {
        const row = { external_source:'direct', referrer:'https://www.doubao.com/chat/123', channel:'agent' };
        assert.equal(source.classify(row).key, 'ai');
        assert.equal(source.classify(row).platform, '豆包');
        assert.equal(source.touchpoint(row).key, 'agent');
        assert.equal(source.classify({ utm_source:'doubao_app' }).key, 'ai');
        assert.equal(source.entry(new URLSearchParams('from=doubao'), '', '/').utm_source, 'doubao');
        const stored = JSON.stringify({ referrer:'https://www.doubao.com/', landing_page:'/insights' });
        const saved = buildAttribution({ referrer:'https://www.ruihuaconsulting.com/contact' }, { rh_entry:stored, utm_source:'baidu' });
        assert.equal(saved.acquisitionChannel, 'ai');
        assert.equal(saved.sourcePlatform, '豆包');
        assert.equal(saved.landing_page, '/insights');
    });
    it('normalizes known devices and preserves uncertainty for legacy desktop labels', () => {
        assert.equal(source.device('Mozilla Macintosh'), 'MAC');
        assert.equal(source.device('Mozilla Windows NT 10.0'), 'Windows');
        assert.equal(source.device('Mozilla iPhone Mobile'), 'mobile');
        assert.equal(source.device('桌面'), '未知');
        assert.equal(source.device('Linux'), '未知');
    });
});
