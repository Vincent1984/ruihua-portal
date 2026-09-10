/**
 * 认证相关配置
 */

// Cookie 配置
const ADMIN_AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  domain: undefined // 由应用层设置
};

/**
 * 清除管理员认证 Cookie
 */
function clearAdminAuthCookie(res) {
  res.clearCookie('admin_token', ADMIN_AUTH_COOKIE_OPTIONS);
}

module.exports = {
  ADMIN_AUTH_COOKIE_OPTIONS,
  clearAdminAuthCookie
};
