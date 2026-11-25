# 报告自动邮件

最新的单条发送、完整历史与批量补发能力见 [报告发送与历史追踪](report-delivery-history.md)。以下保留初版邮件接入说明。

## 行为

- `/api/nqoc/whitepaper/apply` 和 `/api/nqoc/reports/apply` 成功保存时，将待发送状态一并写入记录。
- 仅处理带 `mail.status=pending` 的记录；部署不会自动补发历史数据。
- 每个 Pod 每 15 秒处理每个来源最多一条任务。MongoDB 原子更新领取任务，两个 Pod 不会同时领取同一任务。
- 邮件发送当前 2026 研究报告的七天签名链接；文件通过已有 PDF 代理流式读取，不附带 33MB 附件。
- 状态 `accepted` 仅表示 SMTP 服务接受邮件，不代表已经进入收件箱。未接入投递/退信回执。
- 临时明确失败最多尝试三次，间隔一分钟、两分钟。永久拒绝停止重试。DATA 阶段断线或任务进程中断标记 `uncertain`，需核实后手动重发。
- 后台新增邮件状态及逐条发送/重发操作，使用独立 `nqoc-report-leads:send` 权限，并弹窗确认收件地址。
- 公开提交按邮箱限制每日三个带邮件任务的新申请；白皮书入口另有限流。此限制是防刷措施，并非身份认证。

## 配置

在 `ruihuawebsite-app-secret` 配置以下键，凭据禁止提交仓库：

- `REPORT_MAIL_ENABLED=true`
- `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`
- `SMTP_USER`、`SMTP_PASS`（客户端专用密码）
- `SMTP_FROM_NAME`

签名密钥与 PDF 预览共用运行时 JWT 密钥。修改 Secret 后需滚动更新容器，环境变量才会刷新。关闭自动发送：将 `REPORT_MAIL_ENABLED=false` 后滚动更新；待发任务保留。

SMTP 使用短连接，连接/问候/空闲超时分别为 15/10/45 秒，启用证书校验。服务不打印凭据、邮件正文或签名下载地址。

## 验证

普通测试：`npx mocha tests/reportMail.test.js`。

队列集成测试使用单独临时数据库，测试结束删除测试数据库，不触碰业务集合：

```sh
kubectl -n default port-forward svc/mongodb-service 37019:27017
REPORT_MAIL_TEST_MONGO=mongodb://127.0.0.1:37019/ruihua_mail_test_local npx mocha tests/reportMail.test.js
```

上线复核两个 Pod 的 digest、文件 SHA256、后台未登录接口 401，以及自动邮件启用日志。真实测试邮件只向用户明确指定的测试邮箱发送；SMTP 接收结果与用户确认实际收件分开记录。
