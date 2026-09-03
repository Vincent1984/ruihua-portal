# 主站统一新版导航与页脚实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 除 NQOC 相关页面外，所有主站公开页面统一复用 2026 版 `nav.html`、`mobile-nav.html` 和 `footer.html`。

**Architecture:** 保留 NQOC 页面及 `public/fangan/nqoc-nurture.html` 的独立页面壳。主站 2026 SSR 页面继续使用 `render2026()`；非 NQOC 旧版页面改由兼容渲染器读取原页面主体，并注入 2026 公共导航、移动端导航、页脚和 AI 顾问组件，避免每个页面重复维护公共 HTML。

**Tech Stack:** Node.js、Express、JSDOM、现有 2026 HTML partial、Mocha。

---

### Task 1: 固化迁移边界并补充回归测试

**Files:**
- Modify: `tests/pageReplacementRoutes.test.js`
- Modify: `tests/seoGeoOptimization.test.js`

- [ ] **Step 1: 编写失败测试**
  - 验证非 NQOC 旧页面渲染结果包含新版导航标识、移动端导航、新版页脚。
  - 验证 NQOC 页面仍使用 `.nqoc-nav`，不被主站 partial 替换。
  - 验证页面主体专属脚本和表单节点仍存在。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx mocha tests/pageReplacementRoutes.test.js tests/seoGeoOptimization.test.js
```

预期：新增统一导航断言失败。

- [ ] **Step 3: 保留测试作为迁移边界**
  - 将测试页面清单明确分为主站页面和 NQOC 页面。
  - 不把 canonical、Sitemap、NQOC API 和 NQOC 独立 HTML 作为替换对象。

---

### Task 2: 增加主站旧页面公共壳渲染器

**Files:**
- Modify: `utils/render2026.js`
- Modify: `server.js`

- [ ] **Step 1: 实现兼容渲染函数**
  - 读取旧页面 `<body>` 内的主体内容。
  - 移除旧页面的 `<nav>`、`.mnav`、`<header>` 和 `<footer>` 公共壳，保留页面主体、表单、脚本和页面专属样式。
  - 从现有 `loadCache()` 读取新版 `nav`、`mobileNav`、`footer`、`drawer`。
  - 将新版公共壳插入旧页面主体对应位置。
  - 复用页面的 title、description、canonical 和 robots 元信息，不覆盖页面 SEO 语义。

- [ ] **Step 2: 为渲染函数传入当前路径**
  - 使用当前请求路径调用 `markActive()`，保证新版导航高亮正确。
  - 保留旧页面专属脚本加载，避免诊断、视频、资源、文章页面交互失效。

- [ ] **Step 3: 运行针对性测试**

```bash
npx mocha tests/pageReplacementRoutes.test.js
```

预期：统一公共壳相关测试通过。

---

### Task 3: 迁移非 NQOC 根目录公开页面

**Files:**
- Modify: `server.js`
- Verify: `privacy.html`
- Verify: `resources.html`
- Verify: `training.html`
- Verify: `videos.html`
- Verify: `video-detail.html`
- Verify: `diagnostic.html`
- Verify: `diagnostic-result.html`
- Verify: `efficiency-diagnostic.html`
- Verify: `productivity.html`
- Verify: `event-registration.html`
- Verify: `article.html`

- [ ] **Step 1: 将旧版页面路由切换到兼容公共壳渲染器**
  - `renderStaticHtmlWithFooter()` 不再注入 `server.js` 内联旧 Footer。
  - 非 NQOC 页面统一调用新版公共壳渲染器。
  - 继续保留原有路由、301 跳转、动态数据查询和表单接口。

- [ ] **Step 2: 不迁移已由 2026 SSR 接管的旧文件**
  - `index.html`、`about.html`、`solutions.html` 只保留兼容访问或开发环境用途。
  - 生产规范 URL 继续使用 2026 SSR 页面。

- [ ] **Step 3: 验证关键页面主体功能**
  - 视频列表仍能加载视频数据。
  - 文章页仍能显示文章内容和作者信息。
  - 诊断页表单及脚本仍存在。
  - 隐私页和 404 页仍保持对应 SEO 策略。

---

### Task 4: 迁移非 NQOC `public/fangan` 页面

**Files:**
- Modify: `server.js`
- Verify: `public/fangan/nurture.html`
- Verify: `public/fangan/rui-hua-solution.html`
- Verify: `public/fangan/rui-hua-intro.html`
- Verify: `public/fangan/geo-monitor.html`
- Verify: `public/fangan/wechat-traffic-analysis.html`

- [ ] **Step 1: 增加显式主站专题页渲染路由**
  - 路由优先级高于 `express.static`。
  - 使用主站公共壳渲染器。
  - 保留专题页主体 CSS、JS、表单和 `noindex` 设置。

- [ ] **Step 2: 明确排除 NQOC 专题页**
  - `public/fangan/nqoc-nurture.html` 不接入主站公共壳。
  - `public/nqoc/` 全部页面不接入主站公共壳。

- [ ] **Step 3: 运行 NQOC 隔离测试**

```bash
npx mocha tests/pageReplacementRoutes.test.js
```

预期：主站页面使用新版壳，NQOC 页面保持原壳。

---

### Task 5: 同步新版导航入口与公共页脚

**Files:**
- Modify: `views/2026/partials/nav.html`
- Modify: `views/2026/partials/mobile-nav.html`
- Modify: `views/2026/partials/footer.html`

- [ ] **Step 1: 统一站内链接**
  - NQOC 内链使用 `/nqoc` 及 `/nqoc/...`。
  - 主站入口使用最终规范路径。
  - 不在公共 partial 中加入旧 `.html` 链接。

- [ ] **Step 2: 确认导航覆盖范围**
  - 产品与服务、案例、研究中心、HCVM、关于我们、联系我们保持新版信息架构。
  - 视频、资源、诊断、隐私等兼容页面不强行增加为主导航项，避免破坏新版信息架构；如需访问，通过页面主体或页脚入口提供。

---

### Task 6: 全量回归验证

**Files:**
- Test: `tests/pageReplacementRoutes.test.js`
- Test: `tests/seoGeoOptimization.test.js`

- [ ] **Step 1: 运行语法检查**

```bash
node --check server.js
node --check utils/render2026.js
node --check public/js/rh2026.js
node --check public/js/rh2026-engine.js
```

- [ ] **Step 2: 运行回归测试**

```bash
npx mocha tests/pageReplacementRoutes.test.js tests/seoGeoOptimization.test.js
```

- [ ] **Step 3: 检查页面边界**
  - 主站页面不再输出旧公共 nav/footer。
  - NQOC 页面仍输出 NQOC 专属 nav/footer。
  - 不改变 301、canonical、robots、Sitemap、表单接口和 API 行为。
