module.exports = {
  plugins: [
    require('autoprefixer'),
    require('cssnano')({
      preset: ['default', {
        discardComments: {
          removeAll: true
        },
        normalizeWhitespace: true,
        reduceIdents: false,  // 保留 CSS 变量名
        zindex: false  // 不修改 z-index
      }]
    })
  ]
};
