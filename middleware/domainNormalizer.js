
const domainNormalizer = (req, res, next) => {
    // Feature flag check
    if (process.env.ENABLE_DOMAIN_NORMALIZATION !== 'true') {
        return next();
    }

    const host = req.get('host');
    
    // Skip localhost and IP addresses in development unless forced
    if (host.includes('localhost') || host.includes('127.0.0.1') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        if (process.env.FORCE_DOMAIN_NORMALIZATION_DEV !== 'true') {
            return next();
        }
    }

    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const isWww = host.startsWith('www.');
    const isHttps = protocol === 'https';

    // If already correct, proceed
    if (isWww && isHttps) {
        return next();
    }

    // Construct new URL
    // If host doesn't start with www., prepend it.
    // Be careful with ports. host includes port.
    let newHost = host;
    if (!isWww) {
        newHost = `www.${host}`;
    }
    
    const newProtocol = 'https';
    
    // Perform redirect
    // 301 Permanent Redirect
    res.redirect(301, `${newProtocol}://${newHost}${req.originalUrl}`);
};

module.exports = domainNormalizer;
