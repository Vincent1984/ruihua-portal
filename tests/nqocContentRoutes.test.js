const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'api', 'nqoc.js'), 'utf8');

describe('NQOC 内容路由契约', function () {
    it('观点和案例创建时保留编辑器提交的 slug 并进行唯一性校验', function () {
        const buildStart = routes.indexOf('function buildPost(body, cfg, existing) {');
        const videoStart = routes.indexOf('/* ------------------------------ 值得看见', buildStart);
        const buildPost = routes.slice(buildStart, videoStart);

        assert.match(buildPost, /if \(has\(body, 'slug'\)\) d\.slug = trimStr\(body\.slug, 80\)\.toLowerCase\(\);/);
        assert.match(routes, /resolveSlug\(cfg\.Model, payload\.slug, cfg\.prefix\)/);
    });
});
