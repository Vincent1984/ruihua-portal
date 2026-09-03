# Debug Session: article-detail-error
- **Status**: [OPEN]
- **Issue**: 文章详情页提示服务器错误
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-article-detail-error.ndjson

## Reproduction Steps
1. 启动网站服务并连接 MongoDB。
2. 打开文章详情页。
3. 记录 HTTP 状态、响应内容和服务端异常堆栈。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 文章详情路由没有匹配实际 URL | Medium | Low | Rejected: pre-fix 日志显示路由成功进入 |
| B | slug、发布状态或在线状态筛选导致查询异常 | High | Low | Rejected: pre-fix 日志显示文章查询成功 |
| C | 文章内容字段数据结构导致 SSR 渲染异常 | High | Medium | Confirmed: `ReferenceError: absoluteUrl is not defined` |
| D | 关联文章、作者或 SEO 数据查询失败 | Medium | Medium | Rejected: 错误堆栈明确指向 absoluteUrl |
| E | 3000 端口运行的是旧服务进程 | Medium | Low | Confirmed as separate verification issue: 3000 由旧 PID 18121 占用 |

## Log Evidence
- Pre-fix: `/insights/enterprise-ai-application-maturity-2026-h1` entered the route and found a published online article, then failed with `ReferenceError: absoluteUrl is not defined` at `routes/frontendRoutes2026.js:263`.
- Post-fix: `/insights/enterprise-ai-application-maturity-2026-h1` returned HTTP 200 with 61205 bytes.
- Post-fix: `/insights/enterprise-ai-maturity-2026` returned HTTP 200 with 54556 bytes.

## Verification Conclusion
The shared article detail route failed during SEO image URL construction because `absoluteUrl` was referenced but never defined. Defining the local URL normalizer fixed all `/insights/:slug` pages. Debug instrumentation remains open until browser confirmation.
