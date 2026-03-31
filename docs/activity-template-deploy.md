# 报名模板管理系统部署文档

## 环境要求
- Node.js 18+
- MongoDB 5+
- 已配置后台管理员账号与权限体系

## 安装步骤
1. 安装依赖  
   `npm install`
2. 配置环境变量  
   - `MONGODB_URL`
   - `JWT_SECRET`
   - `SITE_URL`
3. 启动服务  
   `node server.js`

## 数据初始化
- 系统首次启动会自动初始化三类默认模板：
  - HR领袖活动论坛
  - 城市沙龙
  - 闭门研讨会

## 路由检查
- 后台页：`/admin/template-management.html`
- 活动页：`/admin/activity-management.html`
- 公开页：`/event/register/:token`

## 反向代理建议
- 强制 HTTPS
- 代理超时：>= 60s
- 上传大小按业务需要设置

## 回滚方案
- 代码回滚后，数据库保留模板版本历史，不影响活动报名数据。
