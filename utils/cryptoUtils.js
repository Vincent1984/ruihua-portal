const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
// Ensure key is exactly 32 bytes for aes-256-cbc
const secretKey = process.env.SECRET_KEY 
    ? process.env.SECRET_KEY.padEnd(32, '0').slice(0, 32) 
    : 'default_secret_key_if_env_missin'.padEnd(32, '0').slice(0, 32);
const ivLength = 16;

function encrypt(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(ivLength);
        const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (e) {
        console.error('Encryption error:', e);
        return text;
    }
}

function decrypt(text) {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        if (textParts.length !== 2) return text;
        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = textParts[1];
        const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        // Return raw text if decryption fails (e.g. it was never encrypted)
        return text;
    }
}

module.exports = { encrypt, decrypt };