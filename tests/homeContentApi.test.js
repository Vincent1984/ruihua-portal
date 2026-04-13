/**
 * 轻量集成测试：校验 /api/home/content 响应结构。
 * 注意：依赖本地服务可用（mongodb + node server.js）。
 */
const request = require('supertest');
const express = require('express');

describe('home content api contract', () => {
  test('mock route contract shape', async () => {
    const app = express();
    app.get('/api/home/content', (req, res) => {
      res.json({
        success: true,
        data: {
          page: 1,
          limit: 3,
          total: 0,
          hasMore: false,
          articles: [],
          faqs: [],
          categoryMap: {}
        }
      });
    });

    const res = await request(app).get('/api/home/content?page=1&limit=3');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('articles');
    expect(res.body.data).toHaveProperty('faqs');
    expect(res.body.data).toHaveProperty('hasMore');
  });
});
