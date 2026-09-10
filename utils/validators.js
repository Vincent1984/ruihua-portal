/**
 * 通用验证工具函数
 */

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 转义HTML特殊字符
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str || '').replace(/[&<>"']/g, m => map[m]);
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email) {
  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  return emailRegex.test(email);
}

/**
 * 验证手机号格式（中国大陆）
 */
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 验证 URL 格式
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证 MongoDB ObjectId 格式
 */
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * 清理和验证分页参数
 */
function validatePagination(query) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '10', 10), 1), 100);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

module.exports = {
  escapeRegex,
  escapeHtml,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidObjectId,
  validatePagination
};
