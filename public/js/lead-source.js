(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.RuihuaLeadSource = api;
})(typeof window === 'object' ? window : globalThis, function () {
    function host(value) {
        try { return new URL(value.includes('://') ? value : 'https://' + value).hostname.toLowerCase().replace(/^www\./, ''); }
        catch (_) { return ''; }
    }
    const internal = value => {
        const domain = host(value);
        return domain === 'ruihuaconsulting.com' || domain.endsWith('.ruihuaconsulting.com');
    };
    const groups = [
        ['搜索引擎', [['百度',['baidu','baidu.com']],['360 搜索',['360','so.com']],['搜狗',['sogou','sogou.com']],['必应',['bing','bing.com']],['Google',['google','google.com','google.com.hk']]]],
        ['AI 搜索／助手', [['豆包',['doubao','doubao_app','doubaoapp','豆包','doubao.com']],['DeepSeek',['deepseek','deepseek.com']],['WorkBuddy',['workbuddy','workbuddy.ai','workbuddy.qq.com']],['元宝',['yuanbao','yuanbao.tencent.com']],['千问',['qwen','tongyi','qianwen','qianwen.com','tongyi.com','qwen.ai']],['Kimi',['kimi','kimi.com','kimi.moonshot.cn']],['文心',['wenxin','yiyan.baidu.com']],['ChatGPT',['chatgpt','chatgpt.com','chat.openai.com']]]],
        ['外部链接', [['微信公众号',['wechat_mp','weixin_mp','mp.weixin.qq.com']],['微信其他入口',['wechat','weixin','weixin.qq.com']],['知乎',['zhihu','zhihu.com']],['微博',['weibo','weibo.com','weibo.cn']],['小红书',['xiaohongshu','xiaohongshu.com','xhslink.com']],['抖音',['douyin','douyin.com']],['B站',['bilibili','bilibili.com']],['合作网站',['partner']]]]
    ];
    const categories = { direct:'直接访问', organic:'自然搜索', ai:'AI搜索', referral:'外部链接', other:'其他' };
    const touches = { agent:'AI顾问抽屉', form:'预约诊断表单', demo:'首页演示小窗' };
    function informative(value) {
        return typeof value === 'string' && value.trim() && !['direct', 'unknown', '(direct)', 'none'].includes(value.trim().toLowerCase()) && !internal(value);
    }
    function classify(item) {
        const touchpointKeys = ['agent', 'form', 'demo', 'direct', 'organic', 'referral'];
        const values = [item.utm_source, item.external_source, item.referrer,
            !touchpointKeys.includes(item.channel) ? item.channel : ''];
        const value = values.find(informative);
        const raw = value ? value.trim().toLowerCase() : '';
        if (!raw) return { category:categories.direct, key:'direct', platform:'来源未提供', raw:'', evidence:'none' };
        const domain = host(raw);
        for (const [group, platforms] of [groups[1], groups[2], groups[0]]) {
            for (const [platform, aliases] of platforms) {
                if (aliases.some(alias => raw === alias || (alias.includes('.') && (domain === alias || domain.endsWith('.' + alias))))) {
                    const key = group === '搜索引擎' ? 'organic' : group === 'AI 搜索／助手' ? 'ai' : 'referral';
                    return { category:categories[key], key, platform, raw, evidence: value === item.utm_source ? 'utm' : 'referrer' };
                }
            }
        }
        const medium = String(item.utm_medium || '').toLowerCase();
        if (['ai', 'ai_search', 'aisearch'].includes(medium)) return { category:categories.ai, key:'ai', platform:raw, raw, evidence:'utm' };
        if (medium === 'organic') return { category:categories.organic, key:'organic', platform:raw, raw, evidence:'utm' };
        const key = /^https?:\/\//i.test(raw) || /\.[a-z]{2,}(?:\/|$)/i.test(raw) ? 'referral' : 'other';
        return { category:categories[key], key, platform:key === 'referral' ? domain || raw : raw, raw, evidence:'marked' };
    }
    function touchpoint(item) {
        if (touches[item.touchpoint]) return { key:item.touchpoint, label:touches[item.touchpoint] };
        if (/AI.*顾问/.test(item.trigger || '') || item.talk?.length) return { key:'agent', label:touches.agent };
        if (/演示|demo/i.test(item.trigger || '')) return { key:'demo', label:touches.demo };
        if (touches[item.channel]) return { key:item.channel, label:touches[item.channel] };
        if (/预约|诊断/.test(item.trigger || '') || /^\/contact(?:\/|$)/.test(item.leadPage || item.source || '')) return { key:'form', label:touches.form };
        return { key:'other', label:'其他触点' };
    }
    function entry(params, referrer, landing) {
        const tags = {};
        for (const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']) {
            const value = params.get(key);
            if (value) tags[key] = value.slice(0, 500);
        }
        if (!tags.utm_source) {
            for (const key of ['from', 'source']) {
                const value = params.get(key);
                if (value && ['organic','ai'].includes(classify({ utm_source:value }).key)) { tags.utm_source = value.slice(0, 100); break; }
            }
        }
        return { ...tags, referrer:informative(referrer) ? referrer.slice(0, 500) : '', landing_page:landing.slice(0, 500) };
    }
    function device(value) {
        if (/mobile|iphone|ipad|android|平板|手机/i.test(value)) return 'mobile';
        if (/windows|win32|win64/i.test(value)) return 'Windows';
        if (/mac/i.test(value)) return 'MAC';
        return '未知';
    }
    return { classify, internal, host, device, categories, touches, touchpoint, informative, entry };
});
