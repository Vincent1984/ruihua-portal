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
        ['AI 搜索／助手', [['豆包',['doubao','doubao.com']],['DeepSeek',['deepseek','deepseek.com']],['WorkBuddy',['workbuddy','workbuddy.ai','workbuddy.qq.com']],['元宝',['yuanbao','yuanbao.tencent.com']],['千问',['qwen','tongyi','qianwen','qianwen.com','tongyi.com','qwen.ai']],['Kimi',['kimi','kimi.com','kimi.moonshot.cn']],['文心',['wenxin','yiyan.baidu.com']],['ChatGPT',['chatgpt','chatgpt.com','chat.openai.com']]]],
        ['外部链接', [['微信公众号',['wechat_mp','weixin_mp','mp.weixin.qq.com']],['微信其他入口',['wechat','weixin','weixin.qq.com']],['知乎',['zhihu','zhihu.com']],['微博',['weibo','weibo.com','weibo.cn']],['小红书',['xiaohongshu','xiaohongshu.com','xhslink.com']],['抖音',['douyin','douyin.com']],['B站',['bilibili','bilibili.com']],['合作网站',['partner']]]]
    ];
    function classify(item) {
        const tagged = String(item.utm_source || '').trim().toLowerCase();
        const raw = tagged || String(item.external_source || item.referrer || '').trim().toLowerCase();
        if (!raw || raw === 'direct') return { category:'直接访问／来源未知', platform: raw === 'direct' ? '直接访问' : '来源未提供', raw };
        if (internal(raw)) return { category:'直接访问／来源未知', platform:'来源未提供（站内跳转）', raw };
        const domain = host(raw);
        // Match specific AI and social subdomains before their parent search domains.
        for (const [category, platforms] of [groups[1], groups[2], groups[0]]) {
            for (const [platform, aliases] of platforms) {
                if (aliases.some(alias => raw === alias || (alias.includes('.') && (domain === alias || domain.endsWith('.' + alias))))) {
                    return { category, platform, raw };
                }
            }
        }
        return { category: tagged ? '其他已标记来源' : '外部链接', platform: tagged ? tagged : domain || '其他网站', raw };
    }
    function device(value) {
        if (/mobile|iphone|ipad|android|平板|手机/i.test(value)) return 'mobile';
        if (/windows|win32|win64/i.test(value)) return 'Windows';
        if (/mac/i.test(value)) return 'MAC';
        return '未知';
    }
    return { classify, internal, host, device };
});
