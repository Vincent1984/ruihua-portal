/**
 * 响应辅助函数
 */

const path = require('path');

/**
 * 发送服务器内部错误响应
 */
function sendInternalError(res, logLabel, err) {
  if (logLabel) console.error(logLabel, err);
  return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
}

/**
 * 发送 404 页面
 */
function send404(res) {
  try {
    const { render2026, loadBlock } = require('./render2026');
    return res.status(404).send(render2026({
      title: '页面未找到 · 404 | 瑞华智策',
      description: '您访问的页面不存在或已被移动，返回首页继续浏览。',
      content: loadBlock('404')
    }));
  } catch (e) {
    console.error('404 render failed:', e);
    return res.status(404).sendFile(path.join(__dirname, '../404.html'));
  }
}

/**
 * HTML 转义
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  sendInternalError,
  send404,
  escapeHtml
};
