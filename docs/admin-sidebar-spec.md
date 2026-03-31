# 后台左侧导航统一规范

## 目标
- 统一后台所有功能模块左侧导航在视觉、内容、交互上的一致性。
- 保证菜单命名与对应功能页面标题一致，链接可达。

## 视觉规范
- 宽度：默认 250px，折叠后 72px。
- 颜色：
  - 背景：`#ffffff`
  - 边框：`#e2e8f0`
  - 文本：`#334155`
  - 悬停背景：`#f8fafc`
  - 激活背景：`#eef2ff`
  - 激活文本：`#4338ca`
- 字体：14px，分组标题 11px。
- 圆角：菜单项 8px。
- 图标：统一使用 Bootstrap Icons。

## 内容规范
- 分组固定为：总览、内容管理、线索与活动、系统设置。
- 菜单命名必须与功能页面标题一致：
  - 视频管理
  - 活动报名管理
  - 资源下载记录
  - 诊断评测数据
  - 经营分析报告

## 交互规范
- 悬停：高亮背景与文本颜色增强。
- 选中：激活态背景和高亮文本。
- 折叠：支持手动折叠，状态持久化到 `localStorage(adminSidebarCollapsed)`。
- 响应式：992px 以下默认折叠展示。

## 链接与行为规范
- 所有链接必须使用绝对后台路径（`/admin/...`）。
- 指向 `dashboard.html` 内部模块时，使用 `sessionStorage.lastSection` 传递目标分区。
- 退出登录统一指向 `/admin/index.html`。

## 实施文件
- 样式：`/admin/admin-sidebar.css`
- 组件脚本：`/admin/js/unified-admin-sidebar.js`
- 接入页面：
  - `/admin/video-management.html`
  - `/admin/whitepaper-submissions.html`
  - `/admin/maturity.html`
  - `/admin/efficiency.html`
  - `/admin/activity-management.html`
