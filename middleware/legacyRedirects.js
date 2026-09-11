
const path = require('path');

const legacyRedirects = (req, res, next) => {
    if (process.env.ENABLE_LEGACY_REDIRECTS === 'false') {
        return next();
    }

    const redirects = {
        // 2026 新站已替换的页面：旧 URL 统一跳到新规范 URL
        '/solutions/': '/solutions',
        '/solutions.html': '/solutions',
        '/solutions-hcvm/': '/solutions/hcvm',
        '/solutions-hcvm.html': '/solutions/hcvm',
        '/solutions-hcvm': '/solutions/hcvm',
        '/solutions-ahcvm/': '/solutions/hcvm',
        '/solutions-ahcvm.html': '/solutions/hcvm',
        '/solutions-ahcvm': '/solutions/hcvm',
        '/hcvm/': '/solutions/hcvm',
        '/hcvm': '/solutions/hcvm',
        '/about/': '/about',
        '/about.html': '/about',
        '/about/team': '/about#about-team',

        '/solutions-ohcvm/': '/solutions',
        '/solutions-ohcvm.html': '/solutions',
        '/solutions-ohcvm': '/solutions'
    };

    if (redirects[req.path]) {
        return res.redirect(301, redirects[req.path]);
    }

    next();
};

module.exports = legacyRedirects;
