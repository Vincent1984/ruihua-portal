const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');

/**
 * 认证与权限中间件工厂。
 * 从 server.js 抽离，避免 routes 反向依赖 server.js 的闭包变量（RUNTIME_SECRET_KEY / Admin）。
 * @param {string} secretKey JWT 签名密钥（由 server.js 运行时决定）
 */
function createAuthMiddleware(secretKey) {
    function authRequired(req, res, next) {
        try {
            const auth = req.headers.authorization || '';
            const headerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
            const cookieToken = req.cookies?.admin_token || '';
            const candidates = [headerToken, cookieToken].filter(Boolean).filter(t => t !== 'null' && t !== 'undefined');
            if (candidates.length === 0) return res.status(401).json({ error: 'Unauthorized' });
            for (const token of candidates) {
                try {
                    const payload = jwt.verify(token, secretKey);
                    req.user = payload;
                    return next();
                } catch (e) {
                    console.error('JWT verify error:', e.message || e);
                }
            }
            return res.status(401).json({ error: 'Invalid token' });
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }

    async function checkPerm(req, res, next, requiredPerm) {
        // If authRequired passed, req.user is set
        // But we need full user details to check role permissions properly
        try {
            if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

            // Fetch fresh user/role data
            const admin = await Admin.findById(req.user.id).populate('roles');
            if (!admin || !admin.isActive) return res.status(403).json({ error: 'Account disabled or not found' });

            // Check if roles exist
            if (!admin.roles || admin.roles.length === 0) return res.status(403).json({ error: 'No roles assigned' });

            // Aggregate permissions
            const allPerms = new Set();
            admin.roles.forEach(role => {
                if (role.permissions) {
                    role.permissions.forEach(p => allPerms.add(p));
                }
            });

            if (allPerms.has('all')) {
                return next();
            }

            const requiredPerms = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];
            if (requiredPerms.some(perm => allPerms.has(perm))) {
                return next();
            }

            return res.status(403).json({ error: 'Permission denied: ' + requiredPerms.join(' or ') });
        } catch (e) {
            console.error('Perm Check Error:', e);
            res.status(500).json({ error: 'Internal Error' });
        }
    }

    const requirePerm = (perm) => {
        return (req, res, next) => checkPerm(req, res, next, perm);
    };

    const requireAnyPerm = (perms) => {
        return (req, res, next) => checkPerm(req, res, next, perms);
    };

    return { authRequired, checkPerm, requirePerm, requireAnyPerm };
}

module.exports = { createAuthMiddleware };
