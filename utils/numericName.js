const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function toDigitsFromSha256(input, salt = '') {
  const normalized = (input || '').normalize('NFKC');
  const hashHex = crypto.createHash('sha256').update(normalized + salt).digest('hex');
  const digits = BigInt('0x' + hashHex).toString(); // decimal digits-only
  return digits;
}

function clipDigits(d, length = 30) {
  if (!d || typeof d !== 'string') return '';
  if (d.length <= length) return d;
  return d.slice(0, length);
}

function ensureUniqueDigits(dir, baseDigits) {
  let candidate = baseDigits;
  let tries = 0;
  while (tries < 5) {
    const existsMain = fs.existsSync(path.join(dir, candidate + '0.webp'));
    const existsThumb = fs.existsSync(path.join(dir, candidate + '1.webp'));
    const existsAvatar = fs.existsSync(path.join(dir, candidate + '2.webp'));
    if (!existsMain && !existsThumb && !existsAvatar) return candidate;
    candidate = clipDigits(toDigitsFromSha256(candidate, String(Date.now())), 30);
    tries += 1;
  }
  return candidate + String(Date.now());
}

module.exports = {
  toDigitsFromSha256,
  clipDigits,
  ensureUniqueDigits
};
