const assert = require('assert');
const {
    buildAttribution,
    channelOf
} = require('../routes/appointmentAttributionRoutes');
const { generateDailyExternalId, saveWithUniqueExternalId } = require('../utils/dailyExternalId');
const registerAppointmentAttributionRoutes = require('../routes/appointmentAttributionRoutes');
const Appointment = require('../models/Appointment');
const DailyCounter = require('../models/DailyCounter');
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

describe('官网渠道归因', function () {
    it('请求体 UTM 优先，缺失时使用 30 天归因 Cookie', function () {
        const attribution = buildAttribution({
            utm_source: 'baidu',
            utm_campaign: ''
        }, {
            utm_source: 'wechat',
            utm_campaign: 'autumn'
        });

        assert.strictEqual(attribution.utm_source, 'baidu');
        assert.strictEqual(attribution.utm_campaign, 'autumn');
    });

    it('无 UTM 时根据 referrer 识别渠道', function () {
        assert.strictEqual(channelOf({ referrer: 'https://www.zhihu.com/question/1' }), 'zhihu.com');
        assert.strictEqual(channelOf({}), 'direct');
    });

    it('提供按日并发安全的 YYMM-NNN 编号生成器', function () {
        assert.strictEqual(typeof generateDailyExternalId, 'function');
    });

    it('外部编号冲突时重新生成编号并保存', async function () {
        let sequence = 8;
        const appointment = {
            externalId: '',
            async save() {
                if (this.externalId === '2609-009') {
                    const error = new Error('duplicate externalId');
                    error.code = 11000;
                    error.keyPattern = { externalId: 1 };
                    throw error;
                }
                return this;
            }
        };

        await saveWithUniqueExternalId(appointment, async () => `2609-${String(++sequence).padStart(3, '0')}`);

        assert.strictEqual(appointment.externalId, '2609-010');
    });

    it('预约接口保存 externalId 并在成功响应中返回编号，抽屉展示带井号编号', function () {
        const route = fs.readFileSync(path.join(__dirname, '..', 'routes/appointmentAttributionRoutes.js'), 'utf8');
        const drawer = fs.readFileSync(path.join(__dirname, '..', 'admin/js/admin-2026.js'), 'utf8');
        assert.match(route, /await saveWithUniqueExternalId\(appointment\)/);
        assert.match(route, /externalId: appointment\.externalId/);
        assert.match(drawer, /item\.externalId\?'#'\+item\.externalId\.replace\(\/\^L\/,''\)/);
    });

    it('只接受渠道白名单字段并限制长度', function () {
        const attribution = buildAttribution({
            utm_source: 'x'.repeat(600),
            injected: 'not-allowed'
        }, {});

        assert.strictEqual(attribution.utm_source.length, 500);
        assert.strictEqual(attribution.injected, undefined);
    });
});

describe('官网预约路由运行时回归', function () {
    function buildApp(notifyAppointment) {
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => { req.cookies = req.cookies || {}; next(); });
        registerAppointmentAttributionRoutes(
            app,
            (req, res, next) => next(),
            () => (req, res, next) => next(),
            notifyAppointment
        );
        return app;
    }

    it('非法手机号由 routes 新实现校验并返回新文案（证明旧内联路由不再遮蔽）', async function () {
        const res = await request(buildApp()).post('/api/appointments/website').send({ name: '张三', phone: '12345' });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, '请填写姓名和有效的11位手机号码');
    });

    it('成功提交时调用注入的钉钉通知，并返回 201 与外部编号', async function () {
        const originalSave = Appointment.prototype.save;
        const originalCounter = DailyCounter.findOneAndUpdate;
        Appointment.prototype.save = async function () { return this; };
        DailyCounter.findOneAndUpdate = async () => ({ sequence: 1 });
        const notified = [];
        try {
            const res = await request(buildApp(appointment => { notified.push(appointment); }))
                .post('/api/appointments/website')
                .send({ name: '李四', phone: '138 0013 8000', company: 'ACME', utm_source: 'baidu' });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.success, true);
            assert.ok(res.body.externalId);
            assert.strictEqual(notified.length, 1);
            assert.strictEqual(notified[0].phone, '13800138000');
            assert.strictEqual(notified[0].channel, 'baidu');
        } finally {
            Appointment.prototype.save = originalSave;
            DailyCounter.findOneAndUpdate = originalCounter;
        }
    });

    it('server.js 不再内联重复实现，避免再次遮蔽模块化路由', function () {
        const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
        assert.doesNotMatch(server, /app\.post\('\/api\/appointments\/website'/);
        assert.doesNotMatch(server, /app\.(get|post|delete)\('\/api\/admin\/survey\//);
    });
});
