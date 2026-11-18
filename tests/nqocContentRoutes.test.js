const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'api', 'nqoc.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '..', 'routes', 'nqocFrontend.js'), 'utf8');
const bannerModel = fs.readFileSync(path.join(__dirname, '..', 'models', 'NqocBanner.js'), 'utf8');

describe('NQOC 内容路由契约', function () {
    it('观点和案例创建时保留编辑器提交的 slug 并进行唯一性校验', function () {
        const buildStart = routes.indexOf('function buildPost(body, cfg, existing) {');
        const videoStart = routes.indexOf('/* ------------------------------ 值得看见', buildStart);
        const buildPost = routes.slice(buildStart, videoStart);

        assert.match(buildPost, /if \(has\(body, 'slug'\)\) d\.slug = trimStr\(body\.slug, 80\)\.toLowerCase\(\);/);
        assert.match(routes, /resolveSlug\(cfg\.Model, payload\.slug, cfg\.prefix\)/);
    });

    it('Banner 支持「最新一期」动态跳转，链接按最新已发布节目实时解析', function () {
        // 数据模型接受 latest-video
        assert.match(bannerModel, /enum:\s*\['link', 'report', 'latest-video'\]/);
        // 后台写入：latest-video 与 report 同样清空手填链接
        assert.match(routes, /includes\(body\.primaryAction\)\s*\?\s*body\.primaryAction\s*:\s*'link'/);
        assert.match(routes, /if \(b\.primaryAction !== 'link'\) b\.primaryUrl = '';/);
        // 前台首页：latest-video 解析为最新一期详情链接，无已发布节目时回退列表页
        assert.match(frontend, /banner\.primaryAction === 'latest-video'/);
        assert.match(frontend, /\/nqoc\/worth-seeing\/\$\{latestVideo\.slug\}/);
        assert.match(frontend, /const latestVideo = c\.videos\[0\] \|\| null;/);
    });
});
