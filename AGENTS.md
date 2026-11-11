# 项目约定（AGENTS.md）

## 一、发布部署铁律（2026-11-11 事故复盘）

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
# 1) 提交并推送（本机代理会让 git push 失败，必须用 env -u 清掉代理变量）
git add -A && git commit -m "…"
env -u http_proxy -u https_proxy -u all_proxy \
    -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
    git push origin master

# 2) 构建（Apple Silicon 必须显式指定 amd64，并关掉 provenance/sbom）
SHA=$(git rev-parse --short HEAD)
REG=ruihua-imagerepo-cn-shanghai.cr.volces.com/ruihua/ruihuawebsite
docker build --platform linux/amd64 --provenance=false --sbom=false \
  -t $REG:$(date +%Y%m%d)-$SHA .

# 3) 推送日期 tag 与 :latest（两件都要做）
docker save $REG:$(date +%Y%m%d)-$SHA -o /tmp/img.tar
crane push /tmp/img.tar $REG:$(date +%Y%m%d)-$SHA
crane copy  $REG:$(date +%Y%m%d)-$SHA  $REG:latest

# 4) 复核两个 tag 指向同一 digest（必须相等）
crane digest $REG:$(date +%Y%m%d)-$SHA
crane digest $REG:latest
```

### 4. 线上是否真的更新，以 curl 为准

不要只看 VKE 里 Pod 是否 Running——旧镜像同样 Running。

```bash
curl -s -m 20 https://www.ruihuaconsulting.com/nqoc | grep -oE '<title>[^<]*</title>'
```

也可用 `curl -sI` 对比 `etag` / `content-length` 是否变化。

## 二、本地开发注意

- 本项目**没有热重载**：改完 HTML / CSS / JS 必须杀掉旧的 `node server.js` 进程再重启，否则看到的仍是旧内容。
- NQOC 子站静态资源版本号硬编码在 [routes/nqocFrontend.js](routes/nqocFrontend.js)：改 `public/nqoc/css/app.build.css` 或 `public/nqoc/js/app-*.js` 时，必须同步递增其中的 `?v=` 值（共 4 处），否则用户浏览器/CDN 会命中旧缓存。

## 三、文档说明

[docs/docker-deployment.md](docs/docker-deployment.md) 描述的是早期 docker-compose 单机流程，且文件编码已损坏（中文乱码），**线上部署以本文件为准**。
