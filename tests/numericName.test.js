const { toDigitsFromSha256, clipDigits, ensureUniqueDigits } = require('../utils/numericName');
const fs = require('fs');
const path = require('path');

describe('numericName utils', () => {
  test('toDigitsFromSha256 produces digits-only for ASCII', () => {
    const d = toDigitsFromSha256('Gemini_Generated_Image');
    expect(/^[0-9]+$/.test(d)).toBe(true);
  });

  test('toDigitsFromSha256 produces digits-only for Chinese', () => {
    const d = toDigitsFromSha256('人力资本价值经营的方法论');
    expect(/^[0-9]+$/.test(d)).toBe(true);
  });

  test('clipDigits trims length to 30', () => {
    const d = '1234567890'.repeat(4);
    expect(clipDigits(d, 30).length).toBe(30);
  });

  test('ensureUniqueDigits avoids collision in directory', () => {
    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    const base = '123456789012345678901234567890';
    // create files that would collide
    fs.writeFileSync(path.join(tmpDir, base + '0.webp'), 'a');
    fs.writeFileSync(path.join(tmpDir, base + '1.webp'), 'a');
    const unique = ensureUniqueDigits(tmpDir, base);
    expect(unique).not.toBe(base);
    // cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
