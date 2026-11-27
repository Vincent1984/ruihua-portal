const source = require('../public/js/lead-source');
module.exports = function leadEntry(req, res, next) {
    if (req.method !== 'GET' || !req.accepts('html') || /^\/(admin|api|js|css|images|uploads)(?:\/|$)/.test(req.path) || /\.(js|css|png|jpg|svg|ico|woff2?)$/i.test(req.path)) return next();
    const params = new URLSearchParams();
    for (const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','from','source']) {
        if (typeof req.query[key] === 'string') params.set(key, req.query[key]);
    }
    const entry = source.entry(params, req.get('referer') || '', req.path);
    if (source.classify(entry).key !== 'direct') {
        res.cookie('rh_entry', JSON.stringify(entry), { maxAge:30 * 86400000, httpOnly:true,
            secure:req.secure, sameSite:'lax', path:'/' });
    }
    next();
};
