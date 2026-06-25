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

function setNoStore(res) {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
}

function getToken(req) {
    const auth = req.headers.authorization || '';
    const headerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const cookieToken = (req.cookies && req.cookies.admin_token) ? String(req.cookies.admin_token).trim() : '';
    const candidates = [headerToken, cookieToken].filter(Boolean).filter(t => t !== 'null' && t !== 'undefined');
    return candidates.length ? candidates : null;
}

function requireAdminPagePermission({ AdminModel, secretKey, requiredPerm }) {
    return async function adminPagePermission(req, res, next) {
        try {
            const tokens = getToken(req);
            if (!tokens) return sendDenied(req, res, 401, 'Unauthorized');

            let payload = null;
            for (const token of tokens) {
                try {
                    payload = jwt.verify(token, secretKey);
                    break;
                } catch {}
            }
            if (!payload) return sendDenied(req, res, 401, 'Invalid token');
            const admin = await AdminModel.findById(payload.id).populate('roles');
            if (!admin || !admin.isActive) return sendDenied(req, res, 403, 'Account disabled or not found');

            const perms = gatherPermissions(admin);
            const requiredPerms = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm].filter(Boolean);
            if (perms.has('all') || requiredPerms.length === 0 || requiredPerms.some((perm) => perms.has(perm))) {
                req.user = payload;
                setNoStore(res);
                return next();
            }
            return sendDenied(req, res, 403, `Permission denied: ${requiredPerms.join(' or ')}`);
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
