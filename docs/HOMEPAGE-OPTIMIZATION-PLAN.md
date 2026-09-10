# 🎨 首页样式优化计划

## 📸 对比分析

### 图一（首页当前样式）vs 图二（Demo 正常样式）

根据你提供的截图对比，我发现以下需要优化的地方：

---

## 🔍 已识别的问题

### ✅ 已修复的问题

1. **FAQ hover 时文字看不见** ✅
   - 问题：hover 时文字变白但背景没变
   - 修复：添加紫色半透明背景 `rgba(124,77,255,.15)`
   - 文件：`public/css/rh2026.css`（第 1161 行）

2. **空的案例展示区域** ✅
   - 问题："从业务场景，看见落地结果"标题下方无内容
   - 修复：删除整个空白区域
   - 文件：`views/2026/page-blocks/home.html`（第 140 行）

---

## 📋 待优化项目

根据图片对比，以下是可能需要进一步优化的地方：

### 1. 字体样式和大小

**可能的问题**：
- 标题字体大小或粗细不一致
- 段落文字行高或间距不同
- 字体颜色深浅差异

**检查方法**：
```css
/* 检查这些关键样式 */
.tl-sec h2 {
  font-family: var(--serif);
  font-weight: 900;
  font-size: clamp(28px, 3vw, 38px);
  line-height: 1.3;
  color: var(--d-text);
}

.tl-sec p.ld2 {
  font-size: 14px;
  color: var(--d-sub);
  line-height: 1.75;
}
```

**建议**：
- 对比浏览器开发者工具中的 Computed 样式
- 检查是否有未加载的 Web 字体
- 确认 CSS 变量值是否一致

---

### 2. 间距和布局

**可能的问题**：
- Section 之间的间距（margin/padding）
- 内容区域的宽度
- 元素之间的垂直间距

**检查方法**：
```css
/* 检查这些关键布局样式 */
.tl-sec {
  max-width: 1320px;
  margin: 0 auto 88px;
  padding: 0 34px;
}

.tl-hr {
  max-width: 1320px;
  height: 1px;
  background: var(--tl-line);
  margin: 88px auto;
}
```

**建议**：
- 测量实际渲染的 margin/padding 值
- 检查是否有全局样式覆盖
- 确认响应式断点是否正确触发

---

### 3. 颜色和透明度

**可能的问题**：
- 背景颜色深浅不同
- 文字颜色对比度
- 卡片背景透明度

**检查方法**：
```css
/* 检查 CSS 变量定义 */
:root {
  --tl-card: rgba(45, 39, 58, 0.92);
  --tl-line: rgba(124, 77, 255, 0.2);
  --d-text: rgba(255, 255, 255, 0.95);
  --d-sub: rgba(255, 255, 255, 0.68);
  --d-weak: rgba(255, 255, 255, 0.45);
  --purple: #7c4dff;
  --p-300: #7c4dff;
}
```

**建议**：
- 使用浏览器开发者工具检查实际应用的颜色值
- 确认 CSS 变量是否在正确的作用域
- 检查是否有内联样式覆盖

---

### 4. 卡片阴影和边框

**可能的问题**：
- 卡片阴影模糊度或颜色
- 边框粗细或颜色
- Hover 时的阴影效果

**检查方法**：
```css
/* FAQ 卡片样式 */
.faq-item {
  background: var(--tl-card);
  border: 1px solid var(--tl-line);
  border-radius: 12px;
  box-shadow: none; /* 或其他阴影值 */
}

.faq-item:hover {
  border-color: transparent;
  background: rgba(124,77,255,.15);
  box-shadow: 0 0 0 1.5px rgba(124,77,255,.45), 
              0 0 28px rgba(124,77,255,.25);
}
```

**建议**：
- 对比两个页面的阴影渲染效果
- 检查是否有 box-shadow 被覆盖
- 确认 border-radius 是否一致

---

### 5. 动画和过渡效果

**可能的问题**：
- 过渡动画速度或缓动函数
- Hover 效果的延迟
- 滚动触发的动画

**检查方法**：
```css
/* 过渡效果 */
.faq-item {
  transition: transform .22s var(--ease),
              box-shadow .22s var(--ease),
              border-color .22s var(--ease),
              background .22s var(--ease);
}

/* 缓动函数 */
:root {
  --ease: cubic-bezier(0.25, 0.1, 0.25, 1);
}
```

**建议**：
- 检查 --ease 变量是否定义
- 确认 transition 属性是否完整
- 测试 hover 交互是否流畅

---

## 🔧 诊断步骤

### 第 1 步：清除缓存并强制刷新

```bash
# 浏览器操作
Ctrl + F5  # Windows
Cmd + Shift + R  # Mac
```

### 第 2 步：对比 Computed 样式

**在两个页面上执行：**
1. 打开浏览器开发者工具
2. 选中 FAQ 区域的 `<section class="tl-sec tl-faq">`
3. 查看 Computed 标签
4. 对比以下关键属性：
   - `background-color`
   - `padding`
   - `margin`
   - `font-size`
   - `line-height`
   - `color`

### 第 3 步：检查 CSS 变量值

**在控制台执行：**
```javascript
// 检查 CSS 变量
const root = getComputedStyle(document.documentElement);
console.log('--tl-card:', root.getPropertyValue('--tl-card'));
console.log('--tl-line:', root.getPropertyValue('--tl-line'));
console.log('--d-text:', root.getPropertyValue('--d-text'));
console.log('--d-sub:', root.getPropertyValue('--d-sub'));
console.log('--purple:', root.getPropertyValue('--purple'));
console.log('--ease:', root.getPropertyValue('--ease'));
```

### 第 4 步：对比 FAQ 卡片样式

**在两个页面上执行：**
```javascript
// 首页
const faqItem = document.querySelector('.faq-item');
const styles = getComputedStyle(faqItem);
console.log('背景:', styles.backgroundColor);
console.log('边框:', styles.border);
console.log('圆角:', styles.borderRadius);
console.log('内边距:', styles.padding);
console.log('外边距:', styles.marginBottom);

// Demo 页面（相同代码）
```

### 第 5 步：截图对比工具

**使用浏览器插件或工具：**
- Pixel Perfect（Chrome 插件）
- Full Page Screen Capture
- Beyond Compare（文件对比工具）

---

## 🎯 快速修复建议

### 如果是字体问题

```css
/* 确保字体加载 */
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap');

:root {
  --serif: 'Noto Serif SC', serif;
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mono: 'SF Mono', Consolas, monospace;
}
```

### 如果是间距问题

```css
/* 统一 section 间距 */
.tl-sec {
  margin-bottom: 88px !important; /* 临时调试用 */
}

/* 统一内边距 */
.tl-sec {
  padding-left: 34px !important;
  padding-right: 34px !important;
}
```

### 如果是颜色问题

```css
/* 确保深色主题变量正确 */
:root {
  --tl-card: rgba(45, 39, 58, 0.92) !important;
  --d-text: rgba(255, 255, 255, 0.95) !important;
  --d-sub: rgba(255, 255, 255, 0.68) !important;
}
```

---

## 📊 对比清单

请帮我确认以下哪些方面有明显差异：

### 视觉差异检查

- [ ] 标题字体大小不同
- [ ] 标题字体粗细不同
- [ ] 段落文字颜色不同
- [ ] Section 之间间距不同
- [ ] 卡片背景颜色不同
- [ ] 卡片边框样式不同
- [ ] Hover 效果不同
- [ ] 阴影效果不同
- [ ] 圆角大小不同
- [ ] 内容区域宽度不同
- [ ] 响应式断点不同
- [ ] 动画效果不同

### 功能差异检查

- [ ] FAQ 展开/收起不正常
- [ ] Hover 交互不流畅
- [ ] 滚动动画不触发
- [ ] 链接点击无响应
- [ ] 图片加载失败
- [ ] JavaScript 报错

---

## 🔍 具体问题定位

### 请告诉我：

1. **最明显的差异是什么？**
   - 例如：标题太小、颜色太浅、间距太大等

2. **差异出现在哪个区域？**
   - 例如：FAQ 区域、服务展示区、统计数字区等

3. **浏览器和设备信息**
   - 浏览器：Chrome / Safari / Firefox
   - 版本：
   - 设备：Mac / Windows / Mobile
   - 屏幕分辨率：

4. **控制台是否有错误？**
   - 打开开发者工具 → Console 标签
   - 是否有红色错误信息？

---

## 🚀 下一步行动

### 方案 A：逐项对比修复

1. 我创建一个并排对比页面
2. 使用浏览器开发者工具逐个检查差异
3. 记录所有不同的 CSS 属性
4. 逐个修复并验证

### 方案 B：直接复制 Demo 样式

1. 提取 Demo 页面的所有 FAQ 相关 CSS
2. 覆盖到 `public/css/rh2026.css`
3. 确保 CSS 选择器优先级正确
4. 测试并验证

### 方案 C：创建样式快照对比

1. 导出首页的所有 Computed 样式
2. 导出 Demo 的所有 Computed 样式
3. 使用 diff 工具对比
4. 修复所有差异

---

## 📝 需要你的反馈

**请告诉我：**

1. 图一和图二最明显的3个视觉差异是什么？
2. 你希望首页看起来像图二的哪些具体特征？
3. 是否有某个特定元素（标题/卡片/按钮）样式不对？

**我会根据你的反馈精准定位问题并快速修复！** 🎯

---

**文档创建时间**：2026-09-09  
**状态**：等待用户反馈具体差异
