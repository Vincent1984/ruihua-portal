const { createHash, randomBytes } = require('node:crypto');
const Token = require('../models/CrmSkillToken');

const DURATION = 30 * 86400000;
const PREFIX = 'crm_sk_';
const digest = value => createHash('sha256').update(value).digest('hex');
const objectId = '[a-f0-9]{24}';
const leadPath = new RegExp('^/leads/' + objectId + '$', 'i');
const followPath = new RegExp('^/leads/' + objectId + '/follow-up$', 'i');

function accepts(method, path) {
    return (method === 'GET' && (path === '/leads' || path === '/skill-connection' || leadPath.test(path))) ||
        (method === 'POST' && (path === '/leads' || followPath.test(path)));
}
function authWithSkillToken(adminAuth) {
    return (req, res, next) => {
        const auth = req.get('Authorization') || '';
        const header = 'Bearer ' + PREFIX;
        if (!auth.startsWith(header)) return adminAuth(req, res, next);
        const token = auth.slice(7);
        if (!/^crm_sk_[A-Za-z0-9_-]{43}$/.test(token)) return res.status(401).json({ error: '技能令牌无效或已过期' });
        if (!accepts(req.method, req.path)) return res.status(403).json({ error: '技能令牌仅用于查找、新增和跟进线索' });
        return Token.findOne({ digest: digest(token), revokedAt: null, expiresAt: { $gt: new Date() } })
            .select('ownerId expiresAt').lean().then(record => {
                if (!record) return res.status(401).json({ error: '技能令牌无效或已过期' });
                req.user = { id: String(record.ownerId) };
                req.crmSkill = record;
                return next();
            }).catch(next);
    };
}
async function issue(ownerId, label) {
    const token = PREFIX + randomBytes(32).toString('base64url');
    const entry = await Token.create({ ownerId, label, digest: digest(token), expiresAt: new Date(Date.now() + DURATION) });
    return { token, _id: entry.id, label, expiresAt: entry.expiresAt };
}
module.exports = { authWithSkillToken, issue };
