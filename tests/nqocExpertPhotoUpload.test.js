const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

describe('NQOC 专家照片上传', function () {
    it('捕获 Multer 错误并返回明确的 400 提示', function () {
        assert.match(server, /function parseNqocPhotoUploadError\(err\)/);
        assert.match(server, /nqocUpload\.single\('photo'\)\(req, res, async \(uploadErr\) =>/);
        assert.match(server, /LIMIT_FILE_SIZE[\s\S]{0,200}照片大小超限/);
    });

    it('只接受常见图片格式', function () {
        assert.match(server, /const allowedNqocPhotoMimeTypes = new Set\(\[/);
        assert.match(server, /image\/jpeg/);
        assert.match(server, /image\/png/);
        assert.match(server, /image\/webp/);
    });

    it('TOS 上传失败时不回退到本地 URL', function () {
        const routeStart = server.indexOf("app.post('/api/nqoc/experts/apply'");
        const routeEnd = server.indexOf("// Admin API to get applications list", routeStart);
        const route = server.slice(routeStart, routeEnd);
        assert.doesNotMatch(route, /photoUrl = '\/uploads\/nqoc\//);
        assert.match(route, /照片上传失败，请稍后重试/);
    });

    it('成功后保存并返回 TOS 公网 URL', function () {
        assert.match(server, /const objectKey = 'nqoc\/zhuanjia\/'/);
        assert.match(server, /photoUrl = await uploadLocalFileToTos/);
        assert.match(server, /res\.json\(\{ success: true, message: '申请提交成功', photoUrl \}\)/);
    });
});
