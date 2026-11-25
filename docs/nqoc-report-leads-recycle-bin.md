# 报告领取记录 · 删除机制分析与回收站功能设计

> 调研日期：2026-11-25
> 调研对象：后台「新质组织 → 报告领取记录」模块（代码 + 线上环境实测）
> 代码基线：`14a95be`
> 线上环境：火山引擎 VKE，`default` 命名空间，Deployment `ruihuawebsite-app` / `mongodb`

---

## 0. 结论摘要

| 问题 | 结论 |
| --- | --- |
| 现有删除是物理删除还是逻辑删除 | **物理删除**。`doc.deleteOne()` 直接删库，Schema 无 `deletedAt` / `isDeleted` 字段，全链路查询不做任何软删过滤 |
| 能否用现有手段恢复 | **不能**。审计日志只有一行 `删除：姓名 公司（手机号）`，缺 5 个字段；MongoDB 是 standalone 无 oplog；仓库内无备份脚本 |
| 数据保留时间范围 | 记录本身**无 TTL、无清理任务**，理论永久保留；但一旦删除**立即永久消失**。审计日志留存上限 ≈ Mongo 实例存活期（线上最早一条为 2025-12-31） |
| 是否已经造成实际损失 | **是**。线上 `nqocreportleads` 仅剩 **1 条**，而同模块 `delete` 审计有 **30 条** |
| 需要做回收站吗 | 需要。这是在现有架构下唯一成本可控、能兜住「误删」的手段 |
| 另有一个更高危问题 | **MongoDB `/data/db` 挂的是 `emptyDir`，单副本、无副本集、无备份脚本** —— Pod 一旦重建/被驱逐，**整个数据库（含审计日志）会一起消失**。这个问题比「误删一条记录」严重得多，见 §5 |

**建议落地路径（三档，见 §6）**：A 档最小（软删 + 恢复，约 1 个 PR）→ B 档完整回收站（加 TTL 清理 + 永久删除）→ C 档补数据底座（PVC / 副本集 / 每日备份）。**建议先做 A，同时立刻处理 C 中的 PVC 与备份**。

---

## 1. 现状梳理

### 1.1 数据模型

报告领取记录来自**两张表**，后台合并展示：

| 集合 | 模型文件 | 说明 |
| --- | --- | --- |
| `nqocreportleads` | [NqocReportLead.js](file:///Users/nic/Documents/GitHub/ruihua-portal/models/NqocReportLead.js) | 新流程（`/nqoc` 表单）写入 |
| `nqocwhitepaperrequests` | [NqocWhitepaperRequest.js](file:///Users/nic/Documents/GitHub/ruihua-portal/models/NqocWhitepaperRequest.js) | 历史「白皮书预约/下载」表单写入 |

字段对比（这是回收站必须**分别适配**的原因）：

| 字段 | NqocReportLead | NqocWhitepaperRequest |
| --- | --- | --- |
| `name` / `phone` / `company` / `position` / `email` | ✅ | ✅ |
| `mail`（邮件发送状态） | ✅ | ✅ |
| `reportSlug` / `reportTitle` | ✅ | ❌（无） |
| `sourcePage` | ✅ | ❌（序列化时硬编码 `/nqoc/whitepaper-apply`） |
| `downloadCount` / `lastDownloadedAt` | ✅ | ❌ |
| `createdAt` | ✅ | ✅ |
| 索引 | `_id_`、`createdAt_-1`、`mail.status_1_mail.nextAttemptAt_1` | `_id_`、`mail.status_1_mail.nextAttemptAt_1` |

后台通过 [serializeLegacyWhitepaperLead](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L141-L160) 把白皮书记录**投影**成统一结构，并把 id 加上 `whitepaper-` 前缀，用于区分两张表。

### 1.2 删除链路（现状）

**前端** — [admin/js/nqoc.js](file:///Users/nic/Documents/GitHub/ruihua-portal/admin/js/nqoc.js#L658-L667)：

```js
'delete-lead': async (t, id) => {
    const lead = (nqLeads || []).find(l => String(l.id) === String(id));
    if (!lead) return;
    if (!confirm(`确认删除「${lead.name}」的这条报告领取记录？删除后不可恢复。`)) return;
    try {
        await json(`${API}/report-leads/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
        await loadLeads();
        toast('记录已删除');
    } catch (e) { toast(e.message); }
}
```

按钮在表格末列，带 `data-permission="nqoc-report-leads:delete"`（[nqoc.js#L308](file:///Users/nic/Documents/GitHub/ruihua-portal/admin/js/nqoc.js#L308)），无权限时由 `nqApplyPerms` 隐藏。

**后端** — [routes/api/nqoc.js#L978-L993](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L978-L993)：

```js
router.delete('/admin/nqoc/report-leads/:id', authRequired, csrfGuard, requirePerm('nqoc-report-leads:delete'), async (req, res) => {
    const id = String(req.params.id || '');
    const legacy = id.startsWith('whitepaper-');
    const doc = legacy
        ? await NqocWhitepaperRequest.findById(id.slice('whitepaper-'.length)).catch(() => null)
        : await NqocReportLead.findById(id).catch(() => null);
    if (!doc) return res.status(404).json({ error: '记录不存在' });
    await doc.deleteOne();                       // ← 物理删除
    await logOp('delete', '新质组织-报告领取记录', `删除：${doc.name || ''} ${doc.company || ''}（${doc.phone || ''}）`, req.user && req.user.username);
    res.json({ success: true });
});
```

**判定：物理删除，无任何软删中间态。**

- `doc.deleteOne()` 是 mongoose 的硬删除；
- 两个 Schema 都没有 `deletedAt` / `isDeleted` / `deletedBy`；
- 列表 [buildLeadQuery](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L377-L387)、统计 [collectLeadPhoneStats](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L395-L410)、导出，全部不带删除态过滤（因为根本没有删除态）；
- 全仓 grep `deletedAt|isDeleted|回收站|restore|purge`：**无任何命中** —— 项目内没有可复用的软删先例。

### 1.3 删除的连带副作用

删除 `NqocReportLead` 后，指向它的**报告下载令牌立即失效**：

[routes/api/nqoc.js#L1051-L1058](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L1051-L1058) 的 `/api/nqoc/reports/download` 会用令牌里的 `lead._id` 反查：

```js
const lead = await NqocReportLead.findById(data.i).catch(() => null);
if (!lead) return res.redirect(302, REPORT_EXPIRED_PATH);   // 302 → /nqoc/report-expired
```

即：**用户手里的下载链接会突然变成「报告已过期」**。如果这条记录是误删的，用户侧立刻受损且不可解释。回收站恢复后，该链接应重新可用（`_id` 不变）。

另外，`nqocwhitepaperrequests` 记录被删后，「重复提交」统计与「累计领取人次」会同时下降——因为看板是实时对全表聚合得到的。

---

## 2. 现有恢复能力评估

### 2.1 三条可能的恢复路径，逐条否掉

| 路径 | 是否可行 | 原因 |
| --- | --- | --- |
| ① 从审计日志还原 | ❌ | 见 2.2 |
| ② 从 MongoDB oplog / 时间点恢复 | ❌ | 见 2.3 |
| ③ 从备份恢复 | ❌ | 见 2.4 |

### 2.2 审计日志还原：字段不足

审计由 [middleware/operationLog.js](file:///Users/nic/Documents/GitHub/ruihua-portal/middleware/operationLog.js) 的 `logOp(action, module, detail, operator)` 写入 `operationlogs` 集合（[OperationLog.js](file:///Users/nic/Documents/GitHub/ruihua-portal/models/OperationLog.js)）。

线上实测的删除日志样例：

```json
{
  "operator": "admin", "action": "delete", "module": "新质组织-报告领取记录",
  "detail": "删除：高 绍兴市人才市场服务有限公司（13115751185）",
  "ip": "124.217.246.172", "status": "success",
  "createdAt": "2026-11-25T01:29:20.093Z"
}
```

**恢复一条记录需要的 8 个字段 vs 审计里有的**：

| 字段 | 审计里是否有 |
| --- | --- |
| 姓名 `name` | ✅（`detail` 文本里） |
| 公司 `company` | ✅（`detail` 文本里） |
| 手机号 `phone` | ✅（`detail` 文本里） |
| 邮箱 `email` | ❌ |
| 职位 `position` | ❌ |
| 领取报告 `reportSlug` / `reportTitle` | ❌ |
| 提交页面 `sourcePage` | ❌ |
| 精确 `createdAt` | ❌（只有删除时刻，`name` 与 `company` 之间的空格还导致两者无法可靠切分） |

`OperationLog` Schema 里虽然有个 `details: Object` 字段**可以**装快照，但 `logOp` 从未写入过它——**形同没有**。

**结论：审计日志只能回答「谁、何时、删了谁」，不能还原记录本身。**

### 2.3 oplog：不存在

线上实测：

```
kubectl exec mongodb-… -- mongosh --quiet --eval 'try{rs.status()}catch(e){print("replset: "+e.message)}'
→ replset: not running with --replSet
```

- MongoDB 版本 `6.0.26`，**standalone 单机模式**；
- 未启用副本集 ⇒ **没有 oplog** ⇒ 无法做 point-in-time recovery，也无法使用 `mongorestore --oplogReplay`；
- 即使有 oplog，默认容量也仅够几个小时到几天，且需要提前知道误删时间点。

### 2.4 备份：不存在

- `scripts/` 目录 28 个脚本逐一核对，**没有任何 `mongodump` / 备份 / 归档脚本**；
- 集群内 **无 CronJob、无 Job**（`kubectl get cronjob,job` 为空）；
- [docs/database-collections.md](file:///Users/nic/Documents/GitHub/ruihua-portal/docs/DATABASE-COLLECTIONS.md) 第 11 节明确写着「这些集合目前大多没有代码层面的自动保留期限」；
- `k8s/README.md` 里只剩一句「备份策略: 定期备份 MongoDB 数据」，但该文件编码已损坏，且**没有任何实现**。

### 2.5 数据保留时间范围（当前真实情况）

| 维度 | 现状 |
| --- | --- |
| 业务数据保留 | 无 TTL、无清理任务 ⇒ **不删就永久保留** |
| 删除后 | **立即、不可逆地永久消失**（物理删除） |
| 审计日志保留 | 无 TTL 索引（线上 `operationlogs` 索引只有 `_id_`），也就是**永久保留**，但受制于 Mongo 生命周期 |
| 审计覆盖起点 | 线上最早一条日志 `2025-12-31T14:58:15Z`，Mongo Pod 已运行 328 天 ⇒ **审计留存上限 ≈ 数据库实例存活期** |
| 实证损失 | 该模块 `delete` 日志 30 条，而 `nqocreportleads` 现存 **1 条** ⇒ 至少有 29 条新增领取记录已被物理删除且无任何还原可能 |

**一句话结论：现在系统对「误删」的恢复能力为零，且这个零已经在真实业务中生效过。**

---

## 3. 回收站功能设计

### 3.1 设计目标与边界

**目标**

1. 后台「删除」不再销毁数据，改为移入回收站，可恢复；
2. 回收站有明确保留期，到期自动永久清除（满足「个人信息最短必要保存」的合规要求）；
3. 恢复后记录**完整还原**（含报告下载令牌重新可用）；
4. 永久删除必须显式二次确认 + 独立权限 + 留审计。

**明确不做（功能边界）**

- ❌ 不做「回收站里的记录继续出现在看板统计 / 导出结果」——回收站数据必须与业务视图完全隔离；
- ❌ 不做跨表批量恢复（按 id 单条恢复；批量恢复作为后续可选增强）；
- ❌ 不做「删除前自动导出备份文件到对象存储」——成本高、且会把个人信息再落一份到 TOS，与合规目标冲突；
- ❌ 不做前端（`/nqoc` 访客侧）的任何感知——访客视角这条记录就是不存在了，不需要提示；
- ❌ 不改变现有 `nqoc-report-leads:delete` 权限码的语义（否则已分配给角色的权限会失效），只**新增** restore / purge。

### 3.2 数据模型改造

两个 Schema 各追加 3 个字段（**不改动任何既有字段**，存量文档读出来 `deletedAt === undefined`，等价于未删除）：

```js
// models/NqocReportLead.js & models/NqocWhitepaperRequest.js
deletedAt:  { type: Date,   default: null },   // null = 正常；有值 = 在回收站
deletedBy:  { type: String, default: '' },     // 操作人 username，便于追责
purgeAt:    { type: Date,   default: null }    // 到期永久删除时刻 = deletedAt + 保留期
```

**索引**（避免回收站查询与业务查询互相拖累）：

```js
// 业务视图：deletedAt 为 null，配合 createdAt 倒序
nqocReportLeadSchema.index({ deletedAt: 1, createdAt: -1 });
// 回收站列表：deletedAt 有值，按删除时间倒序
nqocReportLeadSchema.index({ deletedAt: 1, purgeAt: 1 });   // TTL 索引见 3.4
```

> `nqocwhitepaperrequests` 目前除 `_id_` 外只有 `mail.status` 索引，**没有 `createdAt` 索引**，建议本次一并补上。

**为什么用 `deletedAt` 而不是 `isDeleted: Boolean`**

- 一个字段同时表达「是否删除」+「何时删除」，少一次写入；
- 可以直接派生 `purgeAt`，TTL 索引只需盯着一个 Date 字段；
- 与项目其他集合（如 `createdAt`）的写法一致，无需引入布尔 + 时间双字段。

### 3.3 接口改造与新增

现有 3 个接口需要**收窄查询范围**（全部加 `deletedAt: null`），1 个接口改语义，新增 2 个接口。

#### (1) 删除接口 —— 改为软删

[routes/api/nqoc.js#L978](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L978)：

```js
const now = new Date();
const purgeAt = new Date(now.getTime() + retentionDays * 24 * 3600 * 1000);
const res1 = await Model.findOneAndUpdate(
    { _id: id, deletedAt: null },                          // 幂等：已删除的再删一次返回 404
    { $set: { deletedAt: now, deletedBy: req.user.username, purgeAt } }
);
if (!res1) return res.status(404).json({ error: '记录不存在' });
await logOp('delete', '新质组织-报告领取记录', `移入回收站：${doc.name} ${doc.company}（${doc.phone}），保留至 ${purgeAt.toISOString().slice(0,10)}`, req.user.username);
```

> 这里 `findOneAndUpdate` 取代 `findById + deleteOne`，顺带解决了并发重复删除的竞态。

#### (2) 恢复接口 —— 新增

```js
router.post('/admin/nqoc/report-leads/:id/restore', authRequired, csrfGuard,
    requirePerm('nqoc-report-leads:restore'), async (req, res) => {
    // 解析 whitepaper- 前缀 → 定位 Model
    const doc = await Model.findOne({ _id: id, deletedAt: { $ne: null } });
    if (!doc) return res.status(404).json({ error: '回收站中没有这条记录' });
    if (doc.purgeAt && doc.purgeAt.getTime() < Date.now()) {
        return res.status(410).json({ error: '已超过保留期，记录不可恢复' });   // 410 Gone
    }
    doc.deletedAt = null; doc.deletedBy = ''; doc.purgeAt = null;
    await doc.save();
    await logOp('restore', '新质组织-报告领取记录', `从回收站恢复：${doc.name} ${doc.company}（${doc.phone}）`, req.user.username);
    res.json({ success: true });
});
```

**恢复的连带效果（需要在文档与测试里明确）**

- `_id` 未变 ⇒ 之前发出的下载令牌**重新可用**（前提：未过 `NQOC_REPORT_TOKEN_TTL_HOURS`，默认 24h）；
- 重新计入看板的 `today / week7 / all / companies / uniquePhones / duplicatePhones`；
- 如果删除后又有人用同手机号提交过，恢复后会被标为「重复提交」——这是正确行为，符合「按手机号去重」口径。

#### (3) 永久删除接口 —— 新增

```js
router.delete('/admin/nqoc/report-leads/:id/purge', authRequired, csrfGuard,
    requirePerm('nqoc-report-leads:purge'), async (req, res) => {
    // 只允许删除「已在回收站」的记录；直接调 purge 删一条正常记录应报错，避免绕过回收站
    const doc = await Model.findOne({ _id: id, deletedAt: { $ne: null } });
    if (!doc) return res.status(404).json({ error: '回收站中没有这条记录' });
    const snap = `${doc.name} ${doc.company}（${doc.phone}）`;
    await doc.deleteOne();
    await logOp('purge', '新质组织-报告领取记录', `永久删除：${snap}`, req.user.username);
    res.json({ success: true });
});
```

#### (4) 列表 / 导出 / 统计 —— 加软删过滤

改动点（共 11 处查询）——[routes/api/nqoc.js#L803-L870](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L803-L870)：

| 位置 | 改动 |
| --- | --- |
| `buildLeadQuery` | `query.deletedAt = null`（作为基础条件，列表与导出同时生效） |
| 列表 6 处 `countDocuments` | 各加 `deletedAt: null` |
| 列表 2 处 `distinct('company')` | 改 `distinct('company', { deletedAt: null })` |
| `collectLeadPhoneStats` 的 `$match` | 加 `deletedAt: null`（否则「累计领取人次」会把回收站里的也算进去） |
| 列表新增入参 `bin=1` | 命中时把 `deletedAt: null` 换成 `deletedAt: { $ne: null }`，只看回收站 |

推荐实现：`buildLeadQuery` 内部按 `bin` 决定软删条件，其余调用点统一复用，避免漏改：

```js
const bin = String(req.query.bin || '') === '1';
query.deletedAt = bin ? { $ne: null } : null;
```

#### (5) 领取接口的 60 秒防重

[routes/api/nqoc.js#L1024](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L1024) 的 `NqocReportLead.findOne({ phone, createdAt: { $gte: ... } })` 建议维持**不过滤**软删：用户刚提交就被后台误删、再提交应仍被节流挡住，行为更稳定。此点需在测试用例中固定。

### 3.4 保留期与自动清理机制

**保留期：默认 30 天**，通过环境变量 `NQOC_LEAD_TRASH_RETENTION_DAYS` 覆盖（默认 30，允许 1~180）。

**清理机制选型**（`replicas: 2` 是关键约束 —— 不能用进程内 `setInterval`，两个 Pod 会重复执行）：

| 方案 | 评价 |
| --- | --- |
| **Mongo TTL 索引（推荐）** | 在 `purgeAt` 上建 `expireAfterSeconds: 0` 索引。Mongo 后台线程每 60 秒扫描一次，`purgeAt` 到期自动删文档。**零代码、零并发风险、天然适配多副本**。缺点：不写审计日志，实际删除时间可能有最多 ~60 秒延迟（对本场景完全可接受） |
| 独立 CronJob | 需要新镜像 / 新脚本 / RBAC，运维面变大；且要处理「多 Pod 抢锁」。仅当必须在删除时留审计时才有必要 |
| 应用内 `setInterval` + 分布式锁 | 需额外加锁表，复杂度最高，**不推荐** |

**结论：用 TTL 索引。**

```js
nqocReportLeadSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
// NqocWhitepaperRequest 同
```

注意事项：
- TTL 索引只对 `Date` 类型生效；`purgeAt: null` 的文档不受影响（`null` 不是 Date，不会过期）—— 这是必须的，正常记录永远不该被 TTL 扫到；
- TTL 索引创建后，Mongo **每 60 秒**跑一次，删除是**异步**的。因此恢复接口里「`purgeAt < now` 则拒绝恢复」这一层业务校验不能省；
- 若后续想保留永久删除审计，可另外加一个轻量 CronJob 只做「统计 TTL 前天已消失的数量」，避免把审计写进 TTL 路径。

### 3.5 权限控制

在 [config/permissions.js](file:///Users/nic/Documents/GitHub/ruihua-portal/config/permissions.js#L78-L81) 的「新质组织」组追加两条：

```js
{ code: 'nqoc-report-leads:restore', name: '恢复报告领取记录' },                        // 非 dangerous：误操作可撤回，属常规操作
{ code: 'nqoc-report-leads:purge',   name: '永久删除报告领取记录', dangerous: true }     // dangerous：不可逆，必须独立授权
```

规则说明：

- `validatePermissions` 只认 `PERMISSION_CODES` 里的码 ⇒ 新码上线后，**非超管角色需要到「角色管理」里手工勾选**才会生效；超管（权限含 `all`）自动拥有；
- 权限校验是**每次请求实时查库**（[middleware/auth.js](file:///Users/nic/Documents/GitHub/ruihua-portal/middleware/auth.js) 的 `checkPerm` → `Admin.findById().populate('roles')`），改权限即时生效，**不需要数据迁移**；
- 回收站的「查看」沿用 `nqoc-report-leads:list`——能看列表就能看回收站，不额外开码（否则会出现「能看到回收站按钮但看不到内容」的割裂态）；
- 前端按钮用 `data-permission` 声明，由 `nqApplyPerms` 统一隐藏；后端每一个写接口仍然独立 `requirePerm`（前端隐藏不是安全边界）。

### 3.6 页面交互设计

在 [admin/console.html](file:///Users/nic/Documents/GitHub/ruihua-portal/admin/console.html) 报告领取记录区块的筛选行里，新增一个「视图」切换（沿用现有 `.segments` 组件，与「全部记录 / 重复提交」同构）：

```
[ 全部记录 ] [ 重复提交 ]        [ 正常 | 回收站 ]
```

**正常视图**（默认，与现在完全一致）

- 表格末列按钮改为：`发送邮件` | `删除`
- 删除确认文案改为：`确认将「{姓名}」的记录移入回收站？可在 30 天内恢复。`
- 删除成功后 toast：`已移入回收站，30 天内可恢复`

**回收站视图**

- 顶部统计卡整体替换为：`回收站记录数` / `最早一条到期时间`（提示语：`超过保留期的记录会自动永久删除`）；
- 表格列：姓名 / 手机号 / 公司·职位 / 邮箱 / 领取的报告 / **删除人** / **删除时间** / **剩余可恢复天数** / 操作；
  - 剩余天数 ≤ 3 天时用醒目色标注；
- 操作列：`恢复`（`data-permission="nqoc-report-leads:restore"`）、`彻底删除`（`data-permission="nqoc-report-leads:purge"`）；
- `彻底删除` 二次确认：`此操作不可撤销，将永久删除「{姓名}」的记录及其下载凭证，确认？`
- 回收站视图下隐藏「重复提交」筛选与「导出」按钮（回收站数据不参与导出，避免把待删数据二次外流）；
- 空态文案：`回收站是空的`。

**状态与 URL**

- 复用 `nqSyncUrl`，把 `bin=1` 写进地址栏，刷新后保持视图（与现有 `q` / `range` / `dup` 一致）；
- 缓存版本号 `?v=` 同步递增（`admin/console.html` 引用的 `nqoc.js?v=…`）。

### 3.7 与现有能力的一致性

| 能力 | 处理 |
| --- | --- |
| 看板 5 张卡 | 全部只统计 `deletedAt: null`；回收站数据不计入 |
| 重复提交标重 | `collectLeadPhoneStats` 加 `deletedAt: null`，否则回收站记录会污染重复判定 |
| Excel 导出 | 只导正常记录；回收站视图不提供导出 |
| 报告下载令牌 | 软删期间失效（302 → `/nqoc/report-expired`），恢复后重新可用 |
| 邮件发送队列 | 回收站记录的 `mail.status === 'pending'` 会继续被发送器处理 —— **需在发送器查询里加 `deletedAt: null`**，否则用户会收到一条「已被删除」的邮件 |
| 「24 小时内免填表直达」 | 前台 localStorage 缓存与后端令牌无关，删除不影响已缓存的访问；恢复后令牌可再次成功 |

> ⚠️ 邮件发送器那一项容易被漏掉，必须进实现清单（见 §4.3）。

---

## 4. 技术实现评估

### 4.1 改动面清单

| 文件 | 改动 |
| --- | --- |
| [models/NqocReportLead.js](file:///Users/nic/Documents/GitHub/ruihua-portal/models/NqocReportLead.js) | +3 字段、+2 索引（含 TTL） |
| [models/NqocWhitepaperRequest.js](file:///Users/nic/Documents/GitHub/ruihua-portal/models/NqocWhitepaperRequest.js) | +3 字段、+3 索引（含 TTL 与 `createdAt`） |
| [routes/api/nqoc.js](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js) | 删除接口改软删；新增 restore / purge；`buildLeadQuery` 加 `bin`；6 处 `countDocuments` + 2 处 `distinct` + `collectLeadPhoneStats` 加过滤；`send-email` 与邮件发送器加过滤 |
| [config/permissions.js](file:///Users/nic/Documents/GitHub/ruihua-portal/config/permissions.js) | +2 个权限码 |
| [admin/console.html](file:///Users/nic/Documents/GitHub/ruihua-portal/admin/console.html) | +视图切换、回收站表格；bump `nqoc.js?v=` |
| [admin/js/nqoc.js](file:///Users/nic/Documents/GitHub/ruihua-portal/admin/js/nqoc.js) | +`bin` 状态、+回收站渲染、+restore/purge 动作、改删除确认文案 |
| `tests/` | +1 个测试文件（约 10 个用例，见 §4.4） |

**规模判断**：单 PR 可完成，无跨表事务、无数据迁移脚本（存量文档 `deletedAt` 缺省即 `null`，语义天然兼容）。风险集中在「漏加软删过滤」这一类**遗漏型 bug**，用测试用例兜住即可。

### 4.2 性能影响

| 场景 | 影响 | 说明 |
| --- | --- | --- |
| 列表查询 | 可忽略 | 多一个等值条件 `deletedAt: null`，由新复合索引 `{deletedAt:1, createdAt:-1}` 覆盖 |
| `countDocuments` ×6 | 可忽略 | 同上；当前单表仅百级数据 |
| `distinct('company')` ×2 | 可忽略 | 数据量级 < 5000 |
| `collectLeadPhoneStats` 聚合 | 可忽略 | 已限定 `deletedAt: null`，聚合范围反而变小 |
| TTL 删除 | 极低 | Mongo 后台每 60 秒扫一次 `purgeAt` 索引，量级 < 5000 行，单次耗时毫秒级 |
| 存储 | 略增 | 回收站期间多存 ≤30 天数据；按当前量级（百级记录、单条 < 1KB），可忽略 |

**唯一的实质成本是索引**：新增 4~5 个索引，写入路径（前台表单提交）每次多维护几个索引项。当前每日提交量级很小，不构成问题。

### 4.3 数据一致性保障

| 风险 | 保障机制 |
| --- | --- |
| 软删后仍出现在某处统计 | 统一从 `buildLeadQuery` 派生软删条件；`collectLeadPhoneStats` 独立加；**用测试用例逐项覆盖 5 个统计口径** |
| 已删除记录继续发邮件 | `send-email` 与后台邮件发送器均加 `deletedAt: null`（清单项） |
| 并发重复删除 | `findOneAndUpdate({ _id, deletedAt: null })` 原子操作，第二次返回 404 |
| 并发「恢复」与「TTL 到期」 | 恢复接口先校验 `purgeAt > now` 再写；即使 TTL 已删，`save()` 会失败并返回 404，不会产生半状态 |
| 跨表操作 | 单次操作只涉及一张表（按 `whitepaper-` 前缀路由），无需事务 |
| TTL 实际删除与 `purgeAt` 有时间差 | 业务侧不依赖 TTL 的精确时刻，只依赖 `purgeAt` 判断可恢复性 |
| 回收站数据被导出外流 | 回收站视图不提供导出接口 |

**一致性总原则：以 `deletedAt` 为唯一事实来源，所有读路径必须显式声明自己要哪一侧（正常 / 回收站）。** 不做「默认全查再过滤」的写法。

### 4.4 测试验证标准

新增 `tests/nqocReportLeadsRecycleBin.test.js`（mocha + 内存/mock 方式，与现有测试风格一致），10 个必过用例：

| # | 用例 | 预期 |
| --- | --- | --- |
| 1 | 删除一条 lead | 返回 200；列表中不再出现；`nqocreportleads` 文档仍存在且 `deletedAt` 有值、`purgeAt` = 30 天后 |
| 2 | 删除后查列表统计 | `all / today / week7 / companies / uniquePhones / duplicatePhones` 均不包含该记录 |
| 3 | 删除后导出 | 导出行数不含该记录 |
| 4 | 删除后访问下载令牌 | 302 → `/nqoc/report-expired` |
| 5 | 恢复该记录 | 返回 200；列表重新出现；字段完整（姓名/手机/公司/职位/邮箱/报告/页面/时间逐一断言） |
| 6 | 恢复后访问下载令牌 | 正常返回 PDF（不受删除影响） |
| 7 | 恢复一条 `purgeAt` 已过期的记录 | 410，且记录仍处于删除态 |
| 8 | 对正常记录直接调 purge | 404，不得删除 |
| 9 | 调 purge 删回收站记录 | 200；文档彻底不存在；`OperationLog` 有 `action: 'purge'` |
| 10 | 无 `restore` / `purge` 权限的账号调用对应接口 | 403；回收站视图中对应按钮不渲染 |
| 11 | 白皮书记录（`whitepaper-` 前缀）走完 删除 → 恢复 → purge 全链路 | 与 lead 行为一致 |

**回归测试**：`npm run test:mocha` 的既有 5 个历史失败（`solutions.html` 缺失等）与本改动无关，只要求**不新增失败**。

**线上验收判据**（照 [AGENTS.md](file:///Users/nic/Documents/GitHub/ruihua-portal/AGENTS.md) 第一节）：

```bash
# 判据 A：新增路由存在 → 未登录应返回 401（不是 404）
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://www.ruihuaconsulting.com/api/admin/nqoc/report-leads/000000000000000000000000/restore

# 判据 B：静态文件逐字节比对
git show <sha>:admin/js/nqoc.js > /tmp/_git_nqoc.js
curl -s https://www.ruihuaconsulting.com/admin/js/nqoc.js > /tmp/_online_nqoc.js
cmp -s /tmp/_git_nqoc.js /tmp/_online_nqoc.js && echo MATCH || echo DIFF

# 判据 C：`./scripts/release.sh --deploy` 输出的 PASS
```

**线上人工验证（发布后由管理员执行一次）**：

1. 前台提交一条测试记录 → 后台删除 → 确认回收站中出现，剩余天数 = 30；
2. 点恢复 → 回到正常列表；
3. 再删除 → 点彻底删除 → 确认记录不再出现在任何视图；
4. 逐条核对 `operationlogs` 中有 `delete` / `restore` / `purge` 三种 action。

---

## 5. ⚠️ 必须先处理的高危项（与回收站独立）

以下三条是调研中的实测发现，**它们让「回收站」的意义变大，也让当前系统处于比「误删」更危险的裸奔状态**：

### 5.1 MongoDB 数据目录是 `emptyDir`（最严重）

```
kubectl -n default get deploy mongodb -o yaml
→ spec.template.spec.volumes: [{"emptyDir":{},"name":"mongodb-storage"}]
```

- `emptyDir` 的语义：**Pod 被删除 / 被调度到别的节点 / 节点重启 / 驱逐，数据 100% 丢失且不可找回**；
- 集群里确实有一个 `persistentvolumeclaim/mongodb-pvc  Bound  50Gi  RWO  ebs-ssd`，但 **Deployment 根本没有引用它**；
- `kubectl get deploy mongodb` 的 `generation: 1` ⇒ 这个配置从创建到现在**从未被改过**；
- 当前 `df -h /data/db` 显示落在节点盘的 `/dev/vda2`，印证了这一点。

**这一条不是「数据可能丢」，而是「一次 Pod 重建 = 全站数据库归零」**，包括 47 个集合、2600+ 条审计日志。它比误删一条 lead 严重几个量级，**建议优先级高于回收站**。

### 5.2 单副本 + standalone，没有任何时间点恢复能力

- `replicas: 1`，无副本集、无 oplog；
- 任何逻辑误操作（误删集合、误跑脚本）都无法回滚到几分钟前。

### 5.3 没有任何备份

- 无 `mongodump` 脚本、无 CronJob、无外部存储归档；
- `docs/database-collections.md` 与 `k8s/README.md` 都只是「建议」，从未实现。

**建议的最小补救（与回收站并行推进，互不阻塞）**

1. 把 `mongodb` Deployment 的 volume 从 `emptyDir` 改为引用现有的 `mongodb-pvc`（**需要停机窗口：先 `kubectl scale deploy mongodb --replicas=0`，改挂载，再起，并从当前 Pod 里把 `/data/db` 拷出来或提前 `mongodump`**）；
2. 加一个每日 `mongodump` 到对象存储（TOS）的 CronJob，保留 7/30 天两档；
3. 中长期：Mongo 转 3 节点副本集（或至少开启 `--replSet` 单节点 + oplog），换取 oplog 级别的短期回滚能力。

> 说明：这一节**不包含**在本轮回放站的代码改动范围内，需要单独确认与排期。

---

## 6. 方案档位与建议

| 档位 | 内容 | 解决什么 | 成本 |
| --- | --- | --- | --- |
| **A（最小可用）** | 两表加 `deletedAt` / `deletedBy` / `purgeAt`；删除改软删；加 restore 接口；所有读路径加 `deletedAt: null`；回收站视图（不做 purge、不做 TTL） | 「误删能捞回来」，无限期可恢复 | 1 个 PR，低风险 |
| **B（完整回收站，推荐）** | A + `purge` 接口与独立权限 + TTL 索引自动清理（默认 30 天）+ 回收站统计/剩余天数/二次确认 | 完整的回收站语义，并满足「个人信息有限期保存」的合规要求 | A + 约 30% 增量 |
| **C（数据底座）** | Mongo 换 PVC + 每日 `mongodump` 到 TOS + 副本集/oplog | 解决「Pod 重建丢全库」「误操作无法回滚」 | 独立运维任务，需停机窗口 |

**建议**：**A + B 一次做完**（两者代码重叠度极高，分两次做反而要改两遍同一批查询），**同时并行启动 C 中的「PVC + 每日备份」两项**。

---

## 7. 上线后运维规则

| 项 | 规则 |
| --- | --- |
| 保留期 | 默认 30 天，`NQOC_LEAD_TRASH_RETENTION_DAYS` 可调（1~180）；调整只影响**新删除**的记录，已在回收站的按原 `purgeAt` 执行 |
| 清理 | TTL 索引自动执行，无需人工干预；若需紧急清空回收站，用 `purge` 接口逐条删 |
| 监控 | ① 每月核对 `operationlogs` 中 `action ∈ {delete, restore, purge}` 的数量趋势；② `nqocreportleads` / `nqocwhitepaperrequests` 的 `countDocuments({ deletedAt: { $ne: null } })` 若持续上涨说明删除量大但无人恢复，需检查是否误用；③ 集合体积告警阈值按现状量级宽松设置即可 |
| 权限 | 新权限码上线后，到「角色管理」为需要的非超管角色勾选 `restore`；`purge` 只授予确认过的账号 |
| 合规 | 「永久删除」是响应个人信息删除权请求的终态动作；回收站保留期需在隐私政策中说明（如「删除后 30 天内可恢复，超期自动永久清除」） |
| 故障处置 | 若恢复接口报 410，说明已超期，只能向用户说明并请其重新提交；若同时涉及数据底座问题（§5），以数据底座修复为优先 |
| 文档维护 | 本文件与 [docs/database-collections.md](file:///Users/nic/Documents/GitHub/ruihua-portal/docs/DATABASE-COLLECTIONS.md) 同步更新（新增 3 个字段、2 个权限码、TTL 索引说明） |

---

## 附录 A：本次线上实测取证记录

```
# 环境
pod/mongodb-85f854886f-l7bm2            1/1 Running 328d
pod/ruihuawebsite-app-bdccd55f5-nzr6b   1/1 Running
pod/ruihuawebsite-app-bdccd55f5-vxg86   1/1 Running
service/mongodb-service  ClusterIP  192.168.34.166  27017/TCP  328d

# Deployment
replicas: 1
image: …/ruihua/mongodb:6.0
volumes: [{"emptyDir":{},"name":"mongodb-storage"}]      ← 无持久化
generation: 1                                            ← 创建后未改过

# MongoDB
replSet: not running with --replSet                      ← standalone，无 oplog
version: 6.0.26
databases: admin, config, local, ruihua_cms
collections: 47

# 集合规模与索引
nqocreportleads          count=1     idx=["_id_","createdAt_-1","mail.status_1_mail.nextAttemptAt_1"]
nqocwhitepaperrequests   count=112   idx=["_id_","mail.status_1_mail.nextAttemptAt_1"]   ← 无 createdAt 索引
operationlogs            count=2629  idx=["_id_"]                                        ← 无 createdAt 索引

# 磁盘
df -h /data/db → /dev/vda2  49G  25G  22G  54%

# 调度与备份
kubectl get cronjob,job → 空
kubectl get pvc → mongodb-pvc  Bound  50Gi  RWO  ebs-ssd  （未被 Deployment 引用）
scripts/ → 28 个脚本，无任何 mongodump / 备份脚本

# 审计日志（报告领取记录模块）
共 32 条，其中 action=delete 30 条
全库 action=delete 共 57 条
最早一条日志：2025-12-31T14:58:15.264Z
样例：删除：高 绍兴市人才市场服务有限公司（13115751185）

# 唯一幸存的 lead（证明删除后 8 个字段一起消失）
{ _id: ObjectId('6b0404e1346cb9c347e0f975'), name: '牛国锋', phone: '13910146021',
  company: '金风科技', position: 'OD', email: 'neal999@qq.com',
  reportSlug: 'china-new-quality-organization-report-2026',
  reportTitle: '2026 中国企业新质组织成熟度研究报告',
  sourcePage: '/nqoc/whitepaper-apply', downloadCount: 0, lastDownloadedAt: null,
  createdAt: ISODate('2026-11-23T09:18:25.323Z') }
```

---

## 附录 B：本次调用的代码位置索引

| 主题 | 位置 |
| --- | --- |
| 删除接口（物理删除） | [routes/api/nqoc.js#L978-L993](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L978-L993) |
| 列表 + 看板统计 | [routes/api/nqoc.js#L803-L848](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L803-L848) |
| 导出 | [routes/api/nqoc.js#L851-L957](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L851-L957) |
| 查询构造 / 手机号统计 | [routes/api/nqoc.js#L377-L410](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L377-L410) |
| 领取接口（60 秒防重） | [routes/api/nqoc.js#L997-L1048](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L997-L1048) |
| 下载令牌校验 | [routes/api/nqoc.js#L1051-L1058](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L1051-L1058) |
| 邮件发送入队 | [routes/api/nqoc.js#L959-L976](file:///Users/nic/Documents/GitHub/ruihua-portal/routes/api/nqoc.js#L959-L976) |
| 前端删除动作 | [admin/js/nqoc.js#L658-L667](file:///Users/nic/Documents/GitHub/ruihua-portal/admin/js/nqoc.js#L658-L667) |
| 前端表格渲染 | [admin/js/nqoc.js#L282-L314](file:///Users/nic/Documents/GitHub/ruihua-portal/admin/js/nqoc.js#L282-L314) |
| 权限码注册 | [config/permissions.js#L78-L81](file:///Users/nic/Documents/GitHub/ruihua-portal/config/permissions.js#L78-L81) |
| 权限校验中间件 | [middleware/auth.js](file:///Users/nic/Documents/GitHub/ruihua-portal/middleware/auth.js) |
| 审计写入 | [middleware/operationLog.js](file:///Users/nic/Documents/GitHub/ruihua-portal/middleware/operationLog.js) |
