# 瑞华智策官网 2026 全面升级 · 迭代计划

> 状态：待评审 | 最后更新：2026-08-20
>
> 本文档为升级的总纲。经确认的架构决策见第 3 节，NQOC 冻结边界见第 4 节，
> 分阶段任务见第 7 节，验收标准见第 9 节。

---

## 1. 背景与目标

- **输入物**
  - 新前端设计稿：`new/rh2026.html`（3641 行，单文件 hash 路由 SPA，数据硬编码）
  - 新后台设计稿：`new/瑞华智策官网管理后台.html`（1815 行，内存态原型，无后端对接）
- **目标**
  - 用新设计替换现有官网前台与管理后台的视觉与交互
  - 前端拆分为**多页服务端渲染**，保留 SEO（sitemap / 文章独立 URL / llms.txt）
  - 后台对接现有 API 与权限体系，并**新建案例（Case）与页面内容（PageContent）模型与 API**
  - 静态页（solutions/hcvm/about 等）**内容后台可编辑**（CMS 化）
  - AI 顾问改为**后端检索**，并预留 Agent 对接
  - 保留现有后台模块（活动、视频等）入口
  - **新质组织（NQOC）前后台页面与功能保持不变**（整体冻结）
- **非目标**
  - 不改动 NQOC 任何逻辑
  - 不重写现有数据模型（仅新增 Case、PageContent）
  - 本阶段不做数据迁移脚本以外的历史数据清洗

---

## 2. 现状 vs 新设计

### 2.1 新前端 `rh2026.html`
- 单文件 SPA：一个 `<style>`（第 11–1225 行）+ 一段 `<script>`（第 2180–3638 行）
- hash 路由：`route()`（第 2859 行）监听 `hashchange`，用 `.page[data-page="xxx"]` 切换显隐
- 数据硬编码在 JS 变量：`ART_DB`（文章）、`CASE_DB`（27 个案例）、`HERO_QS`、课程数据等
- 无任何 `fetch` / API 调用；AI 顾问检索基于前端内存索引 `buildSiteIndex()`
- 页面（data-page）清单：`solutions` / `p-training` / `p-consulting` / `p-fde` /
  `hcvm` / `cases` / `i-industry` / `i-thinktank` / `about` / `contact` / `article`
- 导航中「新质组织」为外链 `https://www.ruihuaconsulting.com/nqoc`（符合冻结要求）

### 2.2 新后台 `瑞华智策官网管理后台.html`
- 单页多视图，顶栏标注「演示数据 · 内存态」「v0.1 · 原型演示态」——纯前端原型
- 侧边栏视图（data-nav）：`leads`（线索）/ `articles`（文章）/ `cases`（案例）/
  `featured`（首页精选案例）/ `faq` / `experts`（讲师专家）/ `settings`（全局配置）
- **无 NQOC 菜单** —— 现有 NQOC 后台页面需保留独立入口

### 2.3 现有系统
- Express 服务端渲染 + MongoDB；约 215 条路由，多数内联在 `server.js`
- 后台为分模块独立 HTML（`admin/*.html`）+ 完整权限体系（`config/permissions.js`）
- SEO 完整：`/sitemap.xml`、文章 `/article/:slug`、`/llms.txt`、`/robots.txt`

---

## 3. 已确认的架构决策

| 议题 | 决策 |
|------|------|
| 前端架构 | **拆成多页服务端渲染**：每个 data-page 拆为独立路由/页面，套用现有 SSR 与 SEO |
| 案例数据 | **新建 Case 模型 + CRUD API + 首页精选标记**，前后台均接真实数据 |
| 推进方式 | 先出本迭代计划文档 → 评审确认 → 分阶段写代码 |
| NQOC | 整体冻结，不动任何前后台页面与 API |
| 静态页 CMS 化 | solutions / hcvm / about 等页面**内容可后台编辑**，新增页面内容模型 |
| 讲师/专家 | **复用现有 `Author` 模型**，不加新字段 |
| AI 顾问 | **后端检索纳入本期**，替换前端内存索引；接口预留 Agent 对接能力 |
| 现有后台模块 | 活动 / 视频等现有 `admin/*.html` 模块**保留入口**，并入新后台侧边栏 |

---

## 4. NQOC 冻结边界（禁止改动）

**可整体冻结的目录/文件：**
- `public/nqoc/`（12 个 HTML + js/css）
- `public/fangan/nqoc-nurture.*`
- `models/Nqoc*.js`（7 个：AwardApplication / AwardChannel / DebateConfig /
  ExpertApplication / SurveyChannel / SurveySubmission / WhitepaperRequest）
- `admin/nqoc-*.html`（5 个）、`admin/js/nqoc-*.js`（5 个）
- `tailwind/tailwind.nqoc.config.js`、`public/uploads/nqoc/`

**含 NQOC 片段的共享文件（改其他部分时勿动 NQOC 段落）：**
- `server.js`：页面路由 397–410 / 565–581、后台权限映射 446–450、
  API 区段 3070–4371（awards / whitepaper / survey / debate / experts）
- `config/permissions.js` 第 39–43 行（`nqoc:*` 权限）
- `admin/dashboard.html`、`admin/js/unified-admin-sidebar.js`、
  `admin/js/permission-management.js`

---

## 5. 新建案例（Case）模型与 API

### 5.1 数据模型 `models/Case.js`（草案）
```
{
  title,            // 案例标题
  slug,             // SEO 友好 URL（自动生成，参考文章 slug 逻辑）
  industry,         // 行业：manufacturing / retail / finance / ...
  client,           // 客户名称
  cover,            // 封面图
  background,       // 背景 bg
  problems: [],     // 问题 prob[]
  goals: [],        // 目标 goal[]
  solutions: [],    // 方案 sol[]
  stats: [{label,value}],  // 数据指标 stats[]
  featured: Boolean,       // 是否首页精选
  featuredOrder: Number,   // 精选排序
  status,           // draft / published
  seo: {title,description,keywords},
  createdAt, updatedAt
}
```
> 字段对齐 `rh2026.html` 中 `CASE_DB` 结构（bg/prob/goal/sol/stats/ind）。

### 5.2 API（对齐现有文章 API 风格）
- 前台：`GET /api/cases`（列表，支持 industry 筛选）、`GET /api/cases/:slug`
- 前台：`GET /api/cases/featured`（首页精选）
- 后台：`GET /api/admin/cases`、`POST /api/cases`、`PUT /api/cases/:id`、
  `DELETE /api/cases/:id`、`PUT /api/cases/:id/featured`
- 页面：`GET /cases`（列表页）、`GET /cases/:slug`（详情，SSR + SEO）
- 权限：新增 `case:list / case:manage / case:edit / case:delete`（参考 nqoc 权限写法）
- sitemap：将已发布案例纳入 `/sitemap.xml`

---

## 5A. 静态页内容 CMS 化（PageContent 模型）

solutions / hcvm / about（含 team）等页面内容需后台可编辑。

### 模型 `models/PageContent.js`（草案）
```
{
  key,        // 页面标识：solutions / p-training / p-consulting / p-fde /
              //          hcvm / about / about-team / contact
  title,      // 页面标题
  sections: [ // 分区块内容，结构化存储，前端 SSR 渲染
    { type, heading, body, items: [], media }
  ],
  seo: { title, description, keywords },
  updatedAt, updatedBy
}
```
- API：`GET /api/pages/:key`（前台）、`GET /api/admin/pages`、
  `PUT /api/admin/pages/:key`（后台编辑）
- 权限：新增 `page:list / page:edit`
- 迁移：以 `rh2026.html` 各页现有硬编码内容为初始值，写导入脚本落库
- 前端：SSR 时读取 PageContent 渲染；后台在「全局配置」或新增「页面管理」视图编辑

---

## 5B. AI 顾问后端检索（纳入本期）

替换前端内存索引 `buildSiteIndex()`，改为后端统一检索，并预留 Agent 对接。

- 检索接口：`POST /api/assistant/search`（入参 query，返回命中的文章/案例/页面片段 + 来源）
- 问答接口：`POST /api/assistant/qa`（可对接现有 `/api/tools/qa`，后续切换到 Agent）
- 索引来源：文章（Article）、案例（Case）、页面内容（PageContent）
- 架构预留：检索/问答层抽象为可替换 provider（本地检索 → 外部 Agent），
  通过配置切换，接口契约保持稳定
- 前端：AI 顾问抽屉改为调用上述接口，去除前端全站索引逻辑

---

## 6. 前端页面 → 路由/API 映射

| 新 data-page | 目标路由 | 数据来源 |
|--------------|----------|----------|
| 首页 `/` | `GET /` (SSR) | home content API + 精选案例 + 最新文章 |
| `solutions` | `/solutions` | **PageContent** `GET /api/pages/solutions` |
| `p-training` | `/solutions/training` | **PageContent** + 培训报名 `POST /api/training/apply` |
| `p-consulting` | `/solutions/consulting` | **PageContent** |
| `p-fde` | `/solutions/fde` | **PageContent** |
| `hcvm` | `/hcvm` | **PageContent** `GET /api/pages/hcvm` |
| `cases` | `/cases`、`/cases/:industry` | **新建 `GET /api/cases`** |
| `article`（详情） | `/article/:slug` | 现有 `GET /api/articles` 体系 |
| `i-industry` | `/insights/industry` | 现有文章按分类筛选 |
| `i-thinktank` | `/insights/thinktank` | 现有文章按分类筛选 |
| `about` / `about/team` | `/about` | **PageContent** `GET /api/pages/about` |
| `contact` | `/contact` | 现有 `POST /api/appointments` |
| AI 顾问抽屉 | 全站可用 | **新建 `/api/assistant/search`、`/api/assistant/qa`** |
| 新质组织 | 外链 `/nqoc` | **冻结，不动** |

---

## 7. 分阶段任务

### 阶段 0 · 资产抽取与基线（准备）
- 从 `rh2026.html` 抽出 `<style>` → 独立 CSS，`<script>` → 独立 JS 模块
- 抽出公共骨架：`<nav>`、mega 菜单、移动端菜单、footer、AI 顾问抽屉
- 建立页面模板/局部（header / footer / meta），供各 SSR 页面复用
- 验收：静态资产可被现有 Express 静态服务加载，首页骨架能渲染

### 阶段 1 · 新增数据模型（后端优先，因是新增）
- 案例：新建 `models/Case.js`、案例 CRUD API、权限项、sitemap 接入
- 页面内容：新建 `models/PageContent.js`、`/api/pages/*` API、`page:*` 权限
- 用 `CASE_DB` 27 条数据 + 各静态页现有内容写一次性导入脚本（`scripts/`）
- 验收：`GET /api/cases`、`GET /api/pages/:key` 返回真实数据，后台可增删改查

### 阶段 2 · 前端多页拆分（前台）
- 首页 `/` SSR：接 home content + 精选案例 + 最新文章
- 逐页拆分：solutions 系列、hcvm、about、contact、insights、cases、article
  - solutions/hcvm/about 等读 **PageContent** 渲染
- 每页独立 `<title>/meta/canonical`，套用抽出的公共骨架
- 保留原 SEO：sitemap、文章 slug、llms.txt、robots
- 验收：各页可直接通过真实 URL 访问，SEO 元信息正确

### 阶段 2A · AI 顾问后端检索
- 新建 `/api/assistant/search`、`/api/assistant/qa`，检索文章/案例/页面内容
- 检索层抽象为可替换 provider（本地检索 → 外部 Agent），配置切换
- 前端 AI 顾问抽屉改调后端接口，移除 `buildSiteIndex()` 前端索引
- 验收：抽屉问答走后端，命中真实内容并展示来源

### 阶段 3 · 管理后台对接（后台）
- 用新后台 UI 替换现有 `admin/`，视图对接真实 API：
  - leads → 现有 appointments / 各表单线索接口
  - articles → 现有文章 API
  - cases / featured → 阶段 1 新建 API
  - faq → 现有 FAQ API
  - experts → 现有 `Author` 模型 API（复用，不加新字段）
  - pages → 新增「页面管理」视图，编辑 PageContent（solutions/hcvm/about 等）
  - settings → 现有 banner / sidebar / 权限 / admin 管理
- 去掉「内存态」原型逻辑，接入登录鉴权与权限控制
- **保留现有模块入口**：活动、视频等 `admin/*.html` 并入新后台侧边栏
- **保留 NQOC 分组入口**（指向现有 `admin/nqoc-*.html`）
- 验收：后台各视图 CRUD 走真实 API，权限生效，NQOC 与现有模块入口可用

### 阶段 4 · SEO 与联调收尾
- sitemap 覆盖新页面与案例；llms.txt 重建纳入案例
- 301 兼容：旧 URL → 新 URL（若有变化）
- 全站回归：前台各页、后台各视图、NQOC 冒烟测试
- 验收：见第 9 节

---

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| SPA 硬编码内容拆多页工作量大 | 阶段 2 逐页拆，先跑通首页与案例，静态页可先整块迁移 |
| 案例是新增数据类型 | 阶段 1 先行，提供导入脚本用现有 27 条兜底 |
| 误改 NQOC | 严格按第 4 节冻结边界；改 server.js 时避开标注行段 |
| AI 顾问依赖前端全站索引 | 二期改后端检索；一期先保留前端占位不阻塞上线 |
| 后台权限对接复杂 | 复用现有 `config/permissions.js` 与鉴权中间件，不另造轮子 |
| SEO 回退 | 阶段 4 专项校验 sitemap/canonical/meta；保留旧 URL 301 |

---

## 9. 验收标准（Definition of Done）

- 前台：所有页面通过真实 URL（非 hash）访问，`<title>/meta/canonical` 正确，
  sitemap 收录，移动端菜单与 mega 菜单正常
- 案例：前台列表/详情/首页精选展示真实数据；后台可增删改查与设精选
- 后台：各视图对接真实 API，登录鉴权与权限控制生效
- NQOC：前后台页面与功能与升级前完全一致（冒烟测试全绿）
- 无控制台报错；`npm test` 通过；构建脚本正常

---

## 10. 已确认结论（原 Open Questions）

1. 静态页 solutions/hcvm/about 等 **需后台可编辑** → 新增 PageContent 模型（见 §5A）。
2. 讲师/专家团队 **复用现有 `Author` 模型，不加新字段**。
3. AI 顾问后端检索 **纳入本期**，并预留 Agent 对接（见 §5B、阶段 2A）。
4. 现有 `admin/*.html` 分模块（活动、视频等）**保留入口**，并入新后台侧边栏。

