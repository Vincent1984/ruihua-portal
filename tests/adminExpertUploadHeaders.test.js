const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'admin/js/admin-2026.js'),
    'utf8'
);

describe('正式后台专家头像上传请求头', function () {
    it('使用 FormData 上传时不应设置 application/json Content-Type', function () {
        const uploadStart = source.indexOf("fetch('/api/upload/author/'");
        assert.notStrictEqual(uploadStart, -1);
        const uploadBlock = source.slice(uploadStart, uploadStart + 500);
        assert.doesNotMatch(uploadBlock, /headers:authHeaders\(\)/);
        assert.match(uploadBlock, /headers:\{Authorization:'Bearer '\+sessionStorage\.getItem\('token'\)\}/);
    });
});
