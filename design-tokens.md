# 瑞华智策 Design Tokens (设计变量)

本文档定义了瑞华智策（Ruihua Consulting）品牌在 Web 开发中的核心设计变量，确保视觉风格的统一性与品牌一致性。

## 1. 颜色系统 (Color Palette)

基于 Tailwind CSS 配置。

### 品牌主色 (Primary Brand Colors)
用于核心行动点、强调文本、图表关键数据等。

| Token Name | Hex Value | Tailwind Class | 用途 |
| :--- | :--- | :--- | :--- |
| `primary-main` | `#7c4dff` | `text-[#7c4dff]`, `bg-[#7c4dff]` | 品牌标准色，主按钮，激活状态 |
| `primary-hover` | `#651fff` | `hover:bg-[#651fff]` | 主色悬停/点击态 |
| `primary-light` | `#d8b4fe` | `text-[#d8b4fe]`, `bg-[#d8b4fe]` | 辅助浅紫色，高亮背景，装饰元素 |
| `primary-bg` | `#f3e8ff` | `bg-[#f3e8ff]` | 极浅背景色，标签背景 |

### 辅助色 (Secondary Colors)
用于区分不同模块、渐变背景等。

| Token Name | Hex Value | Tailwind Class | 用途 |
| :--- | :--- | :--- | :--- |
| `secondary-main` | `#651fff` | `text-[#651fff]`, `bg-[#651fff]` | 第二主色，用于渐变或次级强调 |
| `secondary-dark` | `#2d1b5e` | `bg-[#2d1b5e]` | 深紫色背景，Hero区域 |
| `secondary-darker` | `#0f0529` | `bg-[#0f0529]` | 极深紫色，沉浸式背景基底 |

### 中性色 (Neutral Colors)
用于文本、边框、背景。

| Token Name | Hex Value | Tailwind Class | 用途 |
| :--- | :--- | :--- | :--- |
| `text-primary` | `#0f172a` | `text-slate-900` | 主要标题，正文强强调 |
| `text-secondary` | `#334155` | `text-slate-700` | 次级标题，正文默认色 |
| `text-tertiary` | `#64748b` | `text-slate-500` | 辅助说明，不再强调的文本 |
| `border-light` | `#f1f5f9` | `border-slate-100` | 浅色边框，卡片分割线 |
| `bg-page` | `#f8fafc` | `bg-slate-50` | 页面默认背景 |
| `bg-surface` | `#ffffff` | `bg-white` | 卡片背景 |

## 2. 排版系统 (Typography)

### 字体栈 (Font Stack)
```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
```

### 标题 (Headings)

| Level | Size (Desktop) | Size (Mobile) | Weight | Line Height | Letter Spacing | Tailwind Classes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **H1** | `72px` (7xl) | `36px` (4xl) | Bold (700) | 1.1 | -0.025em | `text-4xl md:text-7xl font-bold tracking-tight` |
| **H2** | `36px` (4xl) | `30px` (3xl) | Bold (700) | 1.2 | -0.025em | `text-3xl md:text-4xl font-bold tracking-tight` |
| **H3** | `24px` (2xl) | `20px` (xl) | Bold (700) | 1.3 | Normal | `text-xl md:text-2xl font-bold` |

### 正文 (Body)

| Type | Size | Line Height | Weight | Tailwind Classes |
| :--- | :--- | :--- | :--- | :--- |
| **Large** | `18px` (lg) | 1.75 | Regular (400) | `text-lg leading-relaxed` |
| **Base** | `16px` (base) | 1.625 | Regular (400) | `text-base leading-relaxed` |
| **Small** | `14px` (sm) | 1.5 | Regular (400) | `text-sm leading-relaxed` |

## 3. 间距与布局 (Spacing & Layout)

### 容器 (Container)
*   **Max Width**: `80rem` (1280px) -> `max-w-7xl`
*   **Padding**: `1rem` (px-4) on Mobile, `2rem` (px-8) on Desktop

### 模块间距 (Section Spacing)
*   **Vertical Padding**: `6rem` (py-24) for standard sections
*   **Min Height**: `100vh` (min-h-screen) for full-screen module presentation

### 圆角 (Border Radius)
*   **Cards**: `1.5rem` (rounded-3xl) or `1rem` (rounded-2xl)
*   **Buttons**: `9999px` (rounded-full)

## 4. 阴影 (Shadows)

| Token Name | CSS Value | Tailwind Class | 用途 |
| :--- | :--- | :--- | :--- |
| `shadow-card` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | `shadow-sm` | 默认卡片状态 |
| `shadow-hover` | `0 10px 15px -3px rgb(0 0 0 / 0.1)` | `shadow-xl` | 悬停/强调状态 |
| `shadow-glow` | `0 10px 40px -10px rgba(124,77,255,0.5)` | Custom | 发光按钮/高亮元素 |

## 5. 交互 (Interactions)

*   **Transition**: `all 300ms ease-in-out` (`transition-all duration-300`)
*   **Hover Effects**:
    *   Translate Y: `-0.25rem` (`hover:-translate-y-1`)
    *   Scale: `1.05` (`hover:scale-105` for icons)
    *   Opacity: `0.8` -> `1.0`

---
*Created for Ruihua Consulting Portal Project*
