const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
// 新版密文前缀，用于区分历史格式，实现平滑迁移
const V2_PREFIX = 'v2:';

// 密钥来源：优先 SECRET_KEY，其次 JWT_SECRET（生产环境 JWT_SECRET 由 K8s Secret 注入且必填）
const rawSecret = process.env.SECRET_KEY || process.env.JWT_SECRET;

// 旧实现曾在缺少环境变量时使用该硬编码兜底密钥。
// 仅保留用于解密历史密文，绝不再用于加密。
const LEGACY_FALLBACK_SECRET = 'default_secret_key_if_env_missin';

// v2 密钥派生：SHA-256 输出固定 32 字节，避免 padEnd/截断带来的弱密钥与碰撞
function deriveKeyV2(secret) {
    return crypto.createHash('sha256').update(String(secret), 'utf8').digest();
}

// 旧版密钥派生：padEnd(32, '0') + slice(0, 32)，仅用于解密历史密文
function deriveKeyLegacy(secret) {
    return String(secret).padEnd(32, '0').slice(0, 32);
}

function resolveSecret() {
    if (rawSecret) return rawSecret;
    const err = new Error('[cryptoUtils] 未配置 SECRET_KEY/JWT_SECRET，无法加密敏感字段');
    if (process.env.NODE_ENV === 'production') {
        // 生产环境必须配置密钥，直接抛错，避免使用弱兜底密钥
        throw err;
    }
    console.warn(err.message);
    return null;
}

function encrypt(text) {
    if (!text || typeof text !== 'string') return text;
    const secret = resolveSecret();
    // 非生产环境且无密钥时不加密，避免退回硬编码兜底
    if (!secret) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, deriveKeyV2(secret), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return V2_PREFIX + iv.toString('hex') + ':' + encrypted;
    } catch (e) {
        console.error('Encryption error:', e);
        return text;
    }
}

function decryptV2(text, secret) {
    const [ivHex, encryptedHex] = text.slice(V2_PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, deriveKeyV2(secret), Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// 历史格式 ivHex:cipherHex，按候选密钥依次尝试（当前密钥 → 旧兜底密钥）
function decryptLegacy(text) {
    const [ivHex, encryptedHex] = text.split(':');
    if (!ivHex || !encryptedHex) return null;
    const candidates = [rawSecret, LEGACY_FALLBACK_SECRET].filter(Boolean);
    for (const secret of candidates) {
        try {
            const decipher = crypto.createDecipheriv(ALGORITHM, deriveKeyLegacy(secret), Buffer.from(ivHex, 'hex'));
            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (e) {
            // 尝试下一个候选密钥
        }
    }
    return null;
}

function decrypt(text) {
    if (!text || typeof text !== 'string') return text;
    try {
        if (text.startsWith(V2_PREFIX)) {
            const secret = resolveSecret();
            return secret ? decryptV2(text, secret) : text;
        }
        const legacy = decryptLegacy(text);
        // 无法解密时按未加密原始值返回
        return legacy === null ? text : legacy;
    } catch (e) {
        return text;
    }
}

module.exports = { encrypt, decrypt };
