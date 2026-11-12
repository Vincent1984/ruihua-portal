# 项目约定（AGENTS.md）

## 一、发布部署铁律（2026-11-11 / 11-12 事故复盘）

**线上环境**：火山引擎 VKE，Deployment `ruihuawebsite-app`（namespace `default`）
**镜像地址**：`ruihua-imagerepo-cn-shanghai.cr.volces.com/ruihua/ruihuawebsite:latest`
**拉取策略**：`imagePullPolicy: Always`（见 [k8s/app-deployment.yaml](k8s/app-deployment.yaml#L34-L35)）
**发布方式**：用户在 VKE 控制台点「重新部署」，不做任何其他操作。

### 1. 每次构建必须同时推两个 tag

- `…/ruihuawebsite:YYYYMMDD-<git short sha>`
- `…/ruihuawebsite:latest`

**只推日期 tag 是错的**。`imagePullPolicy: Always` 会在重新部署时重新拉取，但拉的仍然是 registry 上的 `:latest`；若 `:latest` 没更新，线上就还是旧镜像——表现为“点了重新部署，Title/文案一点没变”（2026-11-11 的 `/nqoc` TDK 事故即此）。

### 2. 用 `crane copy` 打 `:latest`，不要用 `crane tag`

实测 `crane tag <ref>:<日期tag> latest` 返回成功但 digest 不生效；`crane copy` 可靠。

### 3. 标准发布序列

```bash
# 1) 提交并推送。代理状态不固定，先判断：
#    curl -s -m 8 -o /dev/null -w '%{http_code}\n' https://github.com
#    直连 000 就走系统代理（2026-11-12 实测端口为 127.0.0.1:10903，可用 `scutil --proxy` 查）
git add -A && git commit -m "…"
https_proxy=http://127.0.0.1:10903 http_proxy=http://127.0.0.1:10903 \
  git -c http.version=HTTP/1.1 push origin master
# 若直连可用，则用 env -u http_proxy -u https_proxy -u all_proxy \
#   -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY git push origin master

# 2) 构建（Apple Silicon 必须显式指定 amd64，并关掉 provenance/sbom）
SHA=$(git rev-parse --short HEAD)
REG=ruihua-imagerepo-cn-shanghai.cr.volces.com/ruihua/ruihuawebsite
docker build --platform linux/amd64 --provenance=false --sbom=false \
  -t $REG:$(date +%Y%m%d)-$SHA .

# 3) 推送日期 tag 与 :latest（两件都要做）
docker save $REG:$(date +%Y%m%d)-$SHA -o /tmp/img.tar
crane push /tmp/img.tar $REG:$(date +%Y%m%d)-$SHA
crane copy  $REG:$(date +%Y%m%d)-$SHA  $REG:latest

# 4) 复核两个 tag 指向同一 digest（必须相等；连读 8 次，单次不可信，见第 5 条）
for i in $(seq 8); do crane digest $REG:latest | cut -c1-19; done | sort | uniq -c
crane digest $REG:$(date +%Y%m%d)-$SHA
```

### 4. 发布后必须自动校验线上真的更新了

不要只看 VKE 里 Pod 是否 Running——旧镜像同样 Running。部署完把下面整段贴进终端，只看最后的 `PASS` / `FAIL`：

```bash
SHA=$(git rev-parse --short HEAD)
BASE=https://www.ruihuaconsulting.com

# 判据 A（最强）：本次新增的路由是否存在。401 = 新镜像已生效（仅未登录）；404 = 仍是旧镜像
A=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/upload/nqoc-video/presign)

# 判据 B：线上静态文件与本次提交逐字节比对（换成当次真的改过的文件）
git show ${SHA}:admin/js/nqoc.js > /tmp/_git_nqoc.js
curl -s $BASE/admin/js/nqoc.js > /tmp/_online_nqoc.js
cmp -s /tmp/_git_nqoc.js /tmp/_online_nqoc.js && B=MATCH || B=DIFF

echo "presign=$A  nqoc.js=$B"
if [ "$A" = "401" ] && [ "$B" = "MATCH" ]; then
  echo 'PASS: 线上已是本次镜像'
else
  echo 'FAIL: 线上仍是旧镜像 → 按第 5 条排查'
fi
```

- 上面 `presign` 路由与 `nqoc.js` 只对应 `357d839` 那一版；以后每次发布换成「当次新增的路由」+「当次改过的静态文件」，判据形式不变。
- `FAIL` 处理顺序：① 连读 8 次 `crane digest $REG:latest` 确认 tag 稳定；② tag 稳定但仍 `FAIL` → 说明 Pod 没有重拉或镜像引用不是 `:latest`，按第 5 条改用不可变 tag 部署。

### 5. `:latest` 解析会抖回旧镜像（2026-11-12 事故复盘）

2026-11-12 后台视频上传改预签名直传（`357d839`）：推了 `20261112-357d839` 与 `:latest`，当场 `crane digest` 双端一致，用户也在 VKE 点了「重新部署」，但线上仍是 11 月 11 日的旧镜像。

事后取证发现 `crane digest …:latest` 在几分钟内在两个 digest 之间来回跳：

- `sha256:4e0a1e4f…` ← `20261111-e13873e`（旧）
- `sha256:e38fd236…` ← `20261112-357d839`（新）

即 registry 的 tag 解析存在多节点不一致 / 收敛延迟，节点按 `:latest` 拉取时可能命中的是旧状态，于是「Pod 重启了但镜像内容一模一样」。

因此：

- **`crane digest` 单次读取不可信**，必须连读多次确认稳定（见第 3 条第 4 步）；`crane copy` 报 `existing manifest` 也要以连读结果为准。
- 若重新部署两次仍是旧镜像，**放弃 `:latest`**：把 Deployment 的 image 改成不可变引用 `…/ruihuawebsite:YYYYMMDD-<sha>`（或 `…@sha256:<digest>`）再部署。
- 判定线上是否已是新镜像，最强判据是「新增路由是否存在」，比文案/静态文件更可靠：

```bash
# 401 = 新镜像已生效（只是没登录）；404 = 还在跑旧镜像
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://www.ruihuaconsulting.com/api/upload/nqoc-video/presign

# 或把线上静态文件与 git 里的版本逐字节比对
curl -s https://www.ruihuaconsulting.com/admin/js/nqoc.js -o /tmp/online.js
git show <sha>:admin/js/nqoc.js | diff -q - /tmp/online.js && echo MATCH
```

### 6. 部署必须按 digest 钉死（2026-11-12 定论，不再靠 `:latest`）

2026-11-12 拿到 kubeconfig 后直接查到根因：Deployment 的 image 一直是 `:latest`，控制台「重新部署」也执行了（`restartedAt`、ReplicaSet 正常推进、2/2 Ready），但 **Pod 的 `imageID` 反复是 `@sha256:4e0a1e4f…`（11 日旧镜像）**，哪怕 `crane digest :latest` 连读 8 次都是新 digest。即 registry 对可变 tag 的解析对节点侧不可信，「重启」救不了。

所以线上部署规则改为：

- **Deployment 的 image 钉 digest**：`…/ruihuawebsite@sha256:<本次 digest>`。可变 tag（`:latest`、日期 tag）只用于本地阅读，不作为部署依据。
- 每次发布跑 `./scripts/release.sh --deploy`（需 `~/.kube/config`，已配好）：构建 → 推日期 tag → 按 digest `kubectl set image` → 等滚动更新 → 自动校验线上 `PASS`。**不需要再进 VKE 控制台**。
- 只想构建推送、手动部署时跑 `./scripts/release.sh`，它会打印本次 digest；部署后跑 `./scripts/release.sh --verify` 看 `PASS`。
- 校验判据可用环境变量覆盖：`PROBE_PATH` / `PROBE_EXPECT` / `DIFF_FILE`，默认 `POST /api/upload/nqoc-video/presign` 期望 `401` + `admin/js/nqoc.js` 逐字节比对。
- 排查「部署了但没变」的最快一步：`kubectl -n default get pods -l app=ruihuawebsite-app -o custom-columns='NAME:.metadata.name,DIGEST:.status.containerStatuses[0].imageID'`，digest 不对就是没拉到新镜像。
- 注意：线上 image 已被钉成 digest，`kubectl apply -f k8s/app-deployment.yaml`（文件里写 `:latest`）会把解析问题带回来，发布一律走脚本。

## 二、本地开发注意

- 本项目**没有热重载**：改完 HTML / CSS / JS 必须杀掉旧的 `node server.js` 进程再重启，否则看到的仍是旧内容。
- NQOC 子站静态资源版本号硬编码在 [routes/nqocFrontend.js](routes/nqocFrontend.js)：改 `public/nqoc/css/app.build.css` 或 `public/nqoc/js/app-*.js` 时，必须同步递增其中的 `?v=` 值（共 4 处），否则用户浏览器/CDN 会命中旧缓存。

## 三、文档说明

[docs/docker-deployment.md](docs/docker-deployment.md) 描述的是早期 docker-compose 单机流程，且文件编码已损坏（中文乱码），**线上部署以本文件为准**。
