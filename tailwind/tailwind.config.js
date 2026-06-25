/**
 * Tailwind v3 build config — 试点：首页本地编译 CSS 替代 cdn.tailwindcss.com
 *
 * content 说明：
 *  - index.html：首页静态内容
 *  - public/js/**：首页加载的脚本会动态注入带 class 的 DOM（轮播、tabs、图片加载等）
 *  - server.js：首页页脚/部分模块由服务端 SSR 注入（injectFooterHTML 等），class 写在字符串里
 *  以上若不纳入扫描，相关 utility class 会被 purge 掉导致样式丢失。
 *
 * theme.extend 完整复制自 public/js/tailwind-config.js（CDN 运行时配置），保持视觉一致。
 */
module.exports = {
  content: [
    './*.html',
    './card/*.html',
    './public/**/*.html',
    './public/js/**/*.js',
    './js/**/*.js',
    './server.js'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#a78bfa",
          400: "#a855f7",
          500: "#7c4dff",
          600: "#6d28d9",
          700: "#5b21b6",
          800: "#4c1d95",
          900: "#2e1065"
        },
        vi: {
          primary: '#7C4DFF',
          secondary: '#AA00FF',
          accent: '#FFB300',
          highlight: '#EA5504',
          cyan: '#26C6DA',
          text: {
            main: '#242424',
            body: '#757575',
            light: '#BDBDBD',
            disabled: '#E0E0E0'
          },
          bg: {
            page: '#F5F7F9',
            card: '#FFFFFF',
            table: '#F2F2F2',
            hover: '#F8F8F8'
          },
          border: {
            DEFAULT: '#DDDDDD',
            light: '#E1E1E1'
          }
        },
        primary: {
          DEFAULT: '#7C4DFF',
          hover: '#AA00FF',
          light: '#d8b4fe',
          dark: '#5e35b1',
        },
        dark: {
          DEFAULT: '#0f0529',
          lighter: '#1a0b3b',
          deeper: '#2d1b5e',
        },
        slate: {
          50: "#F5F7F9",
          100: "#F2F2F2",
          200: "#E5E5E5",
          300: "#E0E0E0",
          400: "#BDBDBD",
          500: "#9E9E9E",
          600: "#757575",
          700: "#616161",
          800: "#424242",
          850: "#303030",
          900: "#242424"
        }
      },
      fontFamily: {
        sans: ['"MiSansNumbers"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
        mono: ['"MiSansNumbers"', "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", '"Liberation Mono"', '"Courier New"', "monospace"]
      },
      backgroundImage: { "grid-pattern": "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23f1f5f9' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E\")" }
    }
  },
  plugins: []
};
