/**
 * NQOC 站点本地编译配置（替代 cdn.tailwindcss.com）。
 * 与主站不同：使用 Tailwind 默认调色板，仅扩展 brand / cyber 两组颜色，
 * 复刻各 NQOC 页面内联 tailwind.config 的主题。
 * 重建：npm run build:css:nqoc:tw
 */
module.exports = {
  content: [
    './public/nqoc/*.html',
    './public/nqoc/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#8b5cf6',
          600: '#7c3aed'
        },
        cyber: {
          cyan: '#00f0ff',
          purple: '#b026ff'
        }
      }
    }
  },
  plugins: []
};
