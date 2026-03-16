
const path = require('path');

const legacyRedirects = (req, res, next) => {
    if (process.env.ENABLE_LEGACY_REDIRECTS === 'false') {
        return next();
    }

    const redirects = {
        '/solutions-hcvm.html': '/solutions-hcvm/',
        '/solutions-ahcvm.html': '/solutions-hcvm/',
        '/solutions-ohcvm.html': '/solutions-ohcvm/',
        '/solutions-hcvm': '/solutions-hcvm/',
        '/solutions-ahcvm': '/solutions-hcvm/',
        '/solutions-ohcvm': '/solutions-ohcvm/'
    };

    if (redirects[req.path]) {
        return res.redirect(301, redirects[req.path]);
    }

    next();
};

module.exports = legacyRedirects;
