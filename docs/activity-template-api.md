# 报名模板管理 API 文档

## 鉴权
- 除公开报名接口外，全部接口需 `Authorization: Bearer <token>`

## 模板管理
- `GET /api/activity-template/list`
  - query: `keyword, activityType, status, page, limit`
- `GET /api/activity-template/:id`
- `POST /api/activity-template`
- `PUT /api/activity-template/:id`
- `PUT /api/activity-template/:id/autosave`
- `POST /api/activity-template/:id/clone`
- `GET /api/activity-template/:id/versions`
- `POST /api/activity-template/:id/rollback/:version`
- `PATCH /api/activity-template/:id/status`
- `DELETE /api/activity-template/:id`

## 模板统计与导出
- `GET /api/activity-template/:id/stats`
- `GET /api/activity-template/:id/export?format=xlsx|csv`

## 活动联动
- `GET /api/activity-template/options?type=hr_forum|city_salon|closed_door`
- 活动创建/编辑接口支持：
  - `templateId`
  - `activityType`
  - `styleConfig`

## 公开报名
- `GET /api/public/activity/:token`
  - 返回 `templateConfig.formSchema` 和 `templateConfig.uiConfig`
- `POST /api/public/activity/register/:token`
  - body: `{ formData: {...} }`
  - 校验模板字段规则与短信验证码

## 权限建议
- 查看：`appointment:list`
- 编辑：`appointment:edit`
- 删除：`appointment:delete`
