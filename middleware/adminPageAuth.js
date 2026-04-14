const jwt = require('jsonwebtoken');

function gatherPermissions(admin) {
    const allPerms = new Set();
    if (!admin || !Array.isArray(admin.roles)) return allPerms;
    admin.roles.forEach((role) => {
        if (role && Array.isArray(role.permissions)) {
            role.permissions.forEach((p) => allPerms.add(p));
        }
    });
    return allPerms;
}

function sendDenied(req, res, statusCode, message) {
    const redirectTo = `/admin/index.html?redirect=${encodeURIComponent(req.originalUrl || '/admin/dashboard.html')}`;
    const isAjax = req.xhr || (req.headers.accept || '').includes('application/json');
    if (isAjax) {
        return res.status(statusCode).json({ error: message, redirect: redirectTo });
    }
    return res
        .status(statusCode)
        .set('Location', redirectTo)
        .send(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${redirectTo}"></head><body><script>window.location.replace(${JSON.stringify(redirectTo)});</script></body></html>`);
}

function getToken(req) {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    if (req.cookies && req.cookies.admin_token) return req.cookies.admin_token;
    return null;
}

function requireAdminPagePermission({ AdminModel, secretKey, requiredPerm }) {
    return async function adminPagePermission(req, res, next) {
        try {
            const token = getToken(req);
            if (!token) return sendDenied(req, res, 401, 'Unauthorized');

            const payload = jwt.verify(token, secretKey);
            const admin = await AdminModel.findById(payload.id).populate('roles');
            if (!admin || !admin.isActive) return sendDenied(req, res, 403, 'Account disabled or not found');

            const perms = gatherPermissions(admin);
            if (perms.has('all') || perms.has(requiredPerm)) {
                req.user = payload;
                return next();
            }
            return sendDenied(req, res, 403, `Permission denied: ${requiredPerm}`);
        } catch (err) {
            return sendDenied(req, res, 401, 'Invalid token');
        }
    };
}

module.exports = {
    requireAdminPagePermission,
    gatherPermissions,
    getToken
};
