# 瑞华智策网站数据库集合梳理

> 更新时间：2026-09-10  
> 范围：根据 `models/*.js`、数据库连接配置和运行时引用静态梳理，不代表生产数据库当前的真实文档数量。

## 1. 总览

- 数据库：MongoDB，ODM 为 Mongoose。
- 默认数据库名：`ruihua_cms`。
- 连接来源：生产环境优先读取 `MONGODB_URL`；未配置时使用 `mongodb://127.0.0.1:27017/ruihua_cms`。
- 代码中注册了 **39 个独立集合**。
- Mongoose 的 `ref` 只是应用层引用，MongoDB 不会像关系型数据库一样强制外键完整性。
- Schema 内的对象和数组（例如文章 `qa`、活动 `styleConfig`）是嵌入文档，不是独立集合。

| 业务域 | 集合数 | 主要内容 |
|---|---:|---|
| 内容与网站 CMS | 10 | 文章、案例、作者、分类、FAQ、页面配置 |
| 管理后台与审计 | 3 | 管理员、角色权限、操作日志 |
| 活动与报名 | 5 | 活动、模板、渠道、报名、验证码 |
| 线索与诊断 | 6 | 预约、诊断、培训、白皮书、订阅 |
| 调研与行为跟踪 | 2 | 普通调研、调研行为事件 |
| 新质组织 NQOC | 7 | 奖项、专家、成熟度调研、白皮书、辩论配置 |
| 视频中心 | 4 | 视频、视频分类、嵌入配置及历史 |
| 技术支撑 | 2 | 每日序号、上传文件名映射 |

## 2. 内容与网站 CMS（10）

| 集合（Mongoose Model） | 用途 | 主要字段 | 关键约束/关系 |
|---|---|---|---|
| `articles` (`Article`) | 文章和行业洞察 | `title`, `category`, `zone`, `contentStatus`, `slug`, `summary`, `content`, `coverImage`, `qa`, `author`, `authorId`, `status`, `isOnline`, `tags`, SEO/GEO 字段、浏览/点赞数 | `slug` 唯一稀疏索引；`authorId -> authors`；`category` 是分类代码软关联 |
| `articlehistories` (`ArticleHistory`) | 文章编辑版本历史 | `articleId`, 标题/正文/摘要/SEO/标签快照、`editor`, `version`, `createdAt` | `articleId -> articles`；当前没有显式 `articleId + version` 索引 |
| `authors` (`Author`) | 专家/作者档案 | `name`, `avatar`, `desc`, `detail`, `order`, 时间字段 | 被文章和视频引用 |
| `categories` (`Category`) | 文章分类 | `name`, `code`, `order`, `articleCount`, `createdAt` | `name`、`code` 分别唯一；`articleCount` 是冗余计数 |
| `faqs` (`FAQ`) | 网站常见问答 | `question`, `answer`, `category`, `order`, `isActive`, 时间字段 | 分类/排序/启用状态复合索引 |
| `cases` (`Case`) | 客户案例 | `title`, `slug`, `industry`, `client`, `cover`, `tags`, 背景/问题/目标/方案/结果、精选/上下架/SEO 字段 | `slug` 唯一稀疏索引 |
| `pagecontents` (`PageContent`) | 静态页面 CMS 内容 | `key`, `title`, `sections[]`, `seo`, `updatedAt`, `updatedBy` | `key` 唯一；`sections` 为灵活嵌入结构 |
| `globalconfigs` (`GlobalConfig`) | 网站全局配置 | 电话、邮箱、城市、ICP、二维码、域名、通知渠道、接收人、升级/摘要设置 | `key` 唯一，默认 `website`；`fallbackRecipient` 是无 `ref` 的 ObjectId |
| `seoconfigs` (`SeoConfig`) | 页面级 SEO 配置 | `pagePath`, `title`, `keywords`, `description` | `pagePath` 唯一 |
| `settings` (`Setting`) | 通用键值配置 | `key`, `value`, `updatedAt` | `key` 唯一；`value` 为任意 Mixed 类型 |

## 3. 管理后台与审计（3）

| 集合（Model） | 用途 | 主要字段 | 关键约束/关系 |
|---|---|---|---|
| `admins` (`Admin`) | 后台管理员 | `username`, `password`, `name`, `roles`, `lastLogin`, 锁定/失败次数、启用状态、创建/更新人 | `username` 唯一；`roles[] -> roles`；现有创建/改密流程使用 bcrypt 哈希 |
| `roles` (`Role`) | RBAC 角色与权限 | `name`, `code`, `permissions[]`, `isSystem`, `isActive`, 审计字段 | `name`、`code` 唯一；被管理员多选引用 |
| `operationlogs` (`OperationLog`) | 后台操作审计 | `operator`, `action`, `module`, `detail`, HTTP 方法/路径/IP、`details`, `status`, 时间字段 | 当前无显式查询索引或保留期限 |

## 4. 活动与报名（5）

| 集合（Model） | 用途 | 主要字段 | 关键约束/关系 |
|---|---|---|---|
| `activities` (`Activity`) | 活动实例 | 主题、城市、月份、时间/地点、正文、截止时间、主办方、模板、活动类型、样式、渠道、状态 | `templateId -> activitytemplates`；`channels[] -> channels`；`channelConfigs[].channelId -> channels`；渠道 token 唯一 |
| `activitytemplates` (`ActivityTemplate`) | 活动落地页和报名表模板 | `name`, `code`, `activityType`, `formSchema[]`, `uiConfig`, `usageStats`, `version`, `versions[]`, `draftData` | `code` 唯一；`name + activityType` 唯一；版本快照为嵌入数组 |
| `channels` (`Channel`) | 活动来源渠道 | `name`, `code`, `isActive`, `sort` | `name`、`code` 唯一 |
| `registrations` (`Registration`) | 活动报名记录 | `activityId`, `channelId`, `templateId`, 姓名、手机、公司、职位、邮箱、自定义表单、城市、报名时间 | 三个 ObjectId 引用；`activityId + phone` 唯一，防止同活动重复报名 |
| `verificationcodes` (`VerificationCode`) | 短信验证码 | `phone`, `code`, `createdAt`, `used` | TTL 180 秒自动删除；`phone + createdAt` 索引 |

## 5. 线索与诊断（6）

| 集合（Model） | 用途 | 主要字段 | 关键约束/关系 |
|---|---|---|---|
| `appointments` (`Appointment`) | 官网预约、AI 顾问线索及归因 | 姓名、手机、公司、部门/职务、问题、邮件、意向、会话/知识库轨迹、备注、来源、UTM、状态 | `externalId` 唯一稀疏；来源、UTM、创建时间索引；含大量个人与会话数据 |
| `maturitysubmissions` (`MaturitySubmission`) | AI/组织成熟度诊断 | 姓名、手机、公司、`score`, `level`, `answers`, `resultDetail`, `createdAt` | `answers` 为 Mixed；无显式索引 |
| `efficiencysubmissions` (`EfficiencySubmission`) | 企业效能诊断 | 企业/财务/联系人信息、A/C/E 三维答案、详细答案、创建时间 | 财务数据当前按 String 保存；无显式索引 |
| `trainingapplications` (`TrainingApplication`) | 培训课程申请 | 姓名、手机、公司、课程、状态、来源、备注、创建时间 | 无显式索引 |
| `whitepapersubmissions` (`WhitepaperSubmission`) | 普通白皮书申请 | 姓名、手机、公司、职位、邮箱、白皮书、来源、UTM、提交时间 | 无显式索引 |
| `subscriptions` (`Subscription`) | 邮件订阅 | `email`, `source`, `status`, `createdAt` | 邮箱唯一并转小写；状态为 active/unsubscribed |

## 6. 调研与行为跟踪（2）

| 集合（Model） | 用途 | 主要字段 | 关键约束/关系 |
|---|---|---|---|
| `surveysubmissions` (`SurveySubmission`) | 普通活动调研提交 | 话题、参与形式、微信号、渠道、来源 URL、UTM、行为信息、时间字段 | 微信号通过 AES setter 加密；渠道/UTM/时间复合索引 |
| `surveytrackinglogs` (`SurveyTrackingLog`) | 调研漏斗和步骤行为事件 | `sessionId`, `channel`, `deviceType`, `eventType`, `stepIndex`, `durationMs`, `errorField`, `createdAt` | TTL 90 天自动清理；session、channel 索引 |

## 7. 新质组织 NQOC（7）

| 集合（Model） | 用途 | 主要字段 | 关键约束/关系 |
|---|---|---|---|
| `nqocawardapplications` (`NqocAwardApplication`) | 新质组织奖项申报 | 机构/联系人/电话、奖项类别、材料 URL、渠道、审核状态、前台展示、票数、描述 | `channel` 是对渠道代码的字符串软关联 |
| `nqocawardchannels` (`NqocAwardChannel`) | 奖项推广渠道 | `name`, `code`, `description`, `createdAt` | `code` 唯一 |
| `nqocdebateconfigs` (`NqocDebateConfig`) | 辩论投票配置和票数 | 两个议题的状态/正反票数、设备最大票数、时间字段 | 单例式配置，但 Schema 未强制单例 |
| `nqocexpertapplications` (`NqocExpertApplication`) | 专家申请 | 姓名、参与活动、所在地、职位、公司、邮箱、简介、研究领域、著作、课题需求、推荐人、照片、授权、状态 | 包含个人信息；无显式索引 |
| `nqocsurveychannels` (`NqocSurveyChannel`) | NQOC 调研渠道 | `name`, `code`, `description`, `createdAt` | `code` 唯一 |
| `nqocsurveysubmissions` (`NqocSurveySubmission`) | 新质组织成熟度调研结果 | 企业信息、填答人信息、五个维度评分、开放题、客观数据、总体评价、渠道、创建时间 | 约百个展开字段；`channel` 是字符串软关联；无显式查询索引 |
| `nqocwhitepaperrequests` (`NqocWhitepaperRequest`) | NQOC 白皮书申请 | 姓名、手机、邮箱、公司、职位、创建时间 | 包含个人信息；无显式索引 |

## 8. 视频中心（4）

| 集合（Model） | 用途 | 主要字段 | 关键约束/关系 |
|---|---|---|---|
| `videos` (`Video`) | 视频内容 | 标题、分类、slug/历史、缩略图、视频/嵌入地址、正文、讲者、时长、标签、推荐/状态、SEO/GEO/FAQ、浏览数 | `slug` 唯一稀疏；`videoCategories[] -> videocategories`；`speakers[].authorId -> authors` |
| `videocategories` (`VideoCategory`) | 视频树形分类 | `name`, `parentId`, `level`, 描述/图标/排序、SEO、状态、时间字段 | `parentId -> videocategories` 自引用；当前未限制同级重名 |
| `videoembedconfigs` (`VideoEmbedConfig`) | 视频嵌入和灰度配置 | `videoId`, `env`, 嵌入 URL/设置、位置/尺寸、访问权限、启用状态、灰度比例、版本、审计字段 | `videoId -> videos`；`videoId + env` 有普通索引但不唯一 |
| `videoembedhistories` (`VideoEmbedHistory`) | 视频嵌入配置历史 | `configId`, `configData`, `version`, `updatedBy`, `createdAt` | `configId -> videoembedconfigs`；当前无显式复合索引 |

## 9. 技术支撑（2）

| 集合（Model） | 用途 | 主要字段 | 关键约束 |
|---|---|---|---|
| `dailycounters` (`DailyCounter`) | 生成每日业务流水号 | `key`, `sequence` | `key` 唯一 |
| `filenamemaps` (`FileNameMap`) | 上传文件原名与数字文件名映射 | `originalName`, `numericName`, `directory`, `ext`, `variant`, `hashHex`, `createdAt` | `numericName` 有普通索引；未声明唯一 |

## 10. 主要关系图

```text
roles ──< admins.roles[]

authors ──< articles.authorId
authors ──< videos.speakers[].authorId
articles ──< articlehistories.articleId

activitytemplates ──< activities.templateId
activitytemplates ──< registrations.templateId
activities ──< registrations.activityId
channels ──< registrations.channelId
channels >──< activities.channels[] / channelConfigs[]

videocategories ──< videocategories.parentId
videocategories >──< videos.videoCategories[]
videos ──< videoembedconfigs.videoId
videoembedconfigs ──< videoembedhistories.configId
```

### 字符串软关联

- `articles.category` 对应 `categories.code`，没有 ObjectId `ref`。
- `nqocawardapplications.channel` 对应 `nqocawardchannels.code`，没有 ObjectId `ref`。
- `nqocsurveysubmissions.channel` 对应 `nqocsurveychannels.code`，没有 ObjectId `ref`。
- 删除被引用记录时，MongoDB 不会自动级联；是否清理依赖业务代码。

## 11. 数据保留与敏感信息

### 已设置自动过期

- `verificationcodes.createdAt`：180 秒 TTL。
- `surveytrackinglogs.createdAt`：90 天 TTL。

### 长期保存且包含个人/企业信息

`appointments`、`registrations`、`maturitysubmissions`、`efficiencysubmissions`、`trainingapplications`、`whitepapersubmissions`、`surveysubmissions`、全部 NQOC 申请/调研集合。这些集合目前大多没有代码层面的自动保留期限。

### 代码层面的安全提醒

1. `config/database.js` 当前会把完整 `MONGODB_URL` 输出到日志；如果 URL 中含用户名和密码，生产日志可能泄露数据库凭据。
2. `surveysubmissions.wechatId` 使用 AES 加密，但 `SECRET_KEY` 缺失时会使用代码内默认密钥，应在生产环境强制配置密钥。
3. 多数姓名、手机、邮箱、公司和诊断数据以明文保存，需要依靠数据库权限、备份权限和导出权限保护。
4. 验证码值以明文短期保存，但 180 秒后自动删除。
5. 管理员密码的当前创建与修改流程使用 bcrypt；登录接口拒绝遗留明文密码。

## 12. 建模与维护建议

1. 给高频后台查询补充索引，优先评估 `articlehistories(articleId, version)`、`nqocsurveysubmissions(channel, createdAt)`、`operationlogs(createdAt, operator)`、`videoembedhistories(configId, version)`。
2. 明确个人信息的保留期限、删除流程和导出审计，避免业务表无限期累积。
3. 统一渠道建模：活动模块使用 ObjectId 强引用，NQOC 使用字符串代码软关联，目前维护方式不一致。
4. 评估 `videoembedconfigs(videoId, env)` 是否应设为唯一，防止同一环境出现多条生效配置。
5. 文章 Schema 当前没有强制 `title`、`content` 等核心字段必填，建议由业务规则决定是否在 Schema 层补强。
6. `articles.category` 与 `categories.code`、分类文章计数都依赖应用代码同步，需要定期校验漂移。

## 13. 源代码入口

- 数据库连接：[`config/database.js`](../config/database.js)
- 全部模型：[`models/`](../models/)
- 主要服务入口：[`server.js`](../server.js)
- 模块化 API：[`routes/api/`](../routes/api/)
- 活动和报名：[`routes/activityRoutes.js`](../routes/activityRoutes.js)
- NQOC 接口：[`server.js`](../server.js)

## 14. 范围限制

这份文档回答的是“代码预期会使用哪些集合”。要确认生产库实际情况，还需要只读连接生产 MongoDB 后比对：

- 实际集合列表及文档数；
- 真实索引是否与 Schema 同步；
- 是否存在代码已删除但数据库仍保留的历史集合；
- 是否存在孤儿引用、重复软关联或异常数据；
- 各集合的实际存储量和增长速度。
