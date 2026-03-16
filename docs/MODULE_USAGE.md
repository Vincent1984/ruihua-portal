# CMS 模块调用文档

## 概述
本系统已对"白皮书下载"和"成熟度诊断"功能进行模块化重构。新模块使用 ES6+ 语法，支持独立加载，同时保持了与原有全局方法的兼容性。

## 1. 白皮书下载模块 (downloadWhitepaper.js)

### 引入方式
在 HTML 中通过 `<script>` 标签引入，建议放在 `utils.js` 之后：
```html
<script src="/admin/js/utils.js"></script>
<script src="/admin/js/downloadWhitepaper.js"></script>
```

### 全局方法 (兼容旧代码)
引入模块后，以下方法会自动挂载到 `window` 对象，可直接调用：

| 方法名 | 参数 | 描述 |
|--------|------|------|
| `loadData(page)` | `page` (Number): 页码，默认 1 | 加载白皮书列表数据 |
| `exportData()` | 无 | 导出当前筛选条件下的数据为 CSV |
| `changePage(delta)` | `delta` (Number): 页码偏移量 | 切换分页 |
| `showWhitepaperDetail(index)` | `index` (Number): 数据索引 | 显示详情弹窗 |

### 内部逻辑
- **依赖**: 依赖 `utils.js` 中的 `toggleLoading` 和 `authHeaders`，但包含内置回退机制。
- **DOM**: 依赖页面存在特定的 ID 元素（如 `searchName`, `dataTableBody` 等）。

---

## 2. 成熟度诊断模块 (maturityDiagnosis.js)

### 引入方式
该模块基于 Vue 3，需先引入 Vue 3 库：
```html
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
<script src="/admin/js/maturityDiagnosis.js"></script>
```

### 组件实例
模块会自动创建并挂载 Vue 应用到 `#app` 元素。
可以通过 `window.maturityVm` 访问 Vue 实例进行调试或测试。

### 功能特性
- **数据展示**: 自动获取配置和列表数据。
- **权限控制**: 内置侧边栏权限检查逻辑。
- **导出功能**: 支持 CSV/Excel 导出。
- **状态管理**: 使用 Vue 3 Composition API (`ref`) 管理状态。

### 数据交互
- **配置接口**: `GET /api/config/quiz`
- **列表接口**: `GET /api/maturity/list`
- **导出接口**: `GET /api/maturity/export`
- **删除接口**: `DELETE /api/maturity/:id`

## 开发指南

### 本地测试
单元测试位于 `tests/unit/runner.html`。在浏览器中打开该文件即可运行 Mocha 测试套件。

### 浏览器兼容性
模块使用 ES6+ 语法（Async/Await, Arrow Functions, Const/Let）。
- Chrome: 60+
- Firefox: 55+
- Safari: 11+
- Edge: 79+
- IE: 不支持 (需 Babel 转译)
