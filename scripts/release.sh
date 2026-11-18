#!/usr/bin/env bash
# VKE 发布脚本
#
#   ./scripts/release.sh            构建 amd64 → 推日期 tag → 覆盖 :latest → 等 :latest 收敛
#   ./scripts/release.sh --deploy   上面全部 + 用 kubectl 直接切镜像并等滚动更新完成
#   ./scripts/release.sh --verify   只校验线上是否已是本次镜像
#
# 背景见 AGENTS.md 第一节：registry 的 :latest 解析会抖动/延迟。
# 因此本脚本：① 用不可变日期 tag 作为权威镜像；② 覆盖 :latest 后必须连续多次读到同一 digest
# 才认为可用；③ 有 kubeconfig 时用 `kubectl set image` 直接指向日期 tag，彻底绕开 :latest 解析。

set -euo pipefail
cd "$(dirname "$0")/.."

REG=ruihua-imagerepo-cn-shanghai.cr.volces.com/ruihua/ruihuawebsite
BASE=https://www.ruihuaconsulting.com
NS=default
DEPLOY=ruihuawebsite-app
CONTAINER=ruihuawebsite-app
SHA=$(git rev-parse --short HEAD)
TAG=$(date +%Y%m%d)-$SHA
SRC=$REG:$TAG

# 线上校验判据：本次新增的路由 + 本次改过的静态文件（可用环境变量覆盖）
PROBE_METHOD=${PROBE_METHOD:-POST}
PROBE_PATH=${PROBE_PATH:-/api/upload/nqoc-video/presign}
PROBE_EXPECT=${PROBE_EXPECT:-401}
DIFF_FILE=${DIFF_FILE:-admin/js/nqoc.js}

digest_of() { crane digest "$1"; }

kubectl_hint() {
  echo
  echo "如需一键部署（不再手动改镜像），做一次性配置："
  echo "  VKE 控制台 → 集群 → 连接信息 → 下载 kubeconfig → 放到 ~/.kube/config"
  echo "  之后每次发布只跑 ./scripts/release.sh --deploy"
}

verify_online() {
  local code diff
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$PROBE_METHOD" "$BASE$PROBE_PATH")
  git show "${SHA}:${DIFF_FILE}" > /tmp/_rel_git.js 2>/dev/null || : > /tmp/_rel_git.js
  curl -s "$BASE/$DIFF_FILE" > /tmp/_rel_online.js
  if cmp -s /tmp/_rel_git.js /tmp/_rel_online.js; then diff=MATCH; else diff=DIFF; fi
  echo "  $PROBE_METHOD $PROBE_PATH -> $code (期望 $PROBE_EXPECT)   $DIFF_FILE -> $diff"
  if [ "$code" = "$PROBE_EXPECT" ] && [ "$diff" = MATCH ]; then
    echo 'PASS: 线上已是本次镜像'
    return 0
  fi
  echo 'FAIL: 线上仍是旧镜像 → 见 AGENTS.md 第 5 条'
  return 1
}

if [ "${1:-}" = "--verify" ]; then
  verify_online
  exit $?
fi

MODE=${1:-}

WANT=$(digest_of "$SRC" 2>/dev/null || true)
if [ -n "$WANT" ]; then
  echo "!! $TAG 已存在于 registry（digest ${WANT:0:19}）"
  read -r -p "   复用现有镜像、只重做 :latest？[y/N] " ans || ans=n
  [ "$ans" = y ] || exit 1
else
  echo "==> [1/3] 构建 amd64 镜像 $TAG"
  docker build --platform linux/amd64 --provenance=false --sbom=false -t "$SRC" .
  echo "==> [2/3] 推送日期 tag"
  docker save "$SRC" -o /tmp/img.tar
  crane push /tmp/img.tar "$SRC"
  WANT=$(digest_of "$SRC")
fi
echo "   本次 digest: ${WANT:0:19}"

# :latest 连续 6 次都解析到本次 digest 才算收敛（单次读取不可信）
converged() {
  local ok=0 d
  for _ in $(seq 6); do
    d=$(digest_of "$REG:latest" 2>/dev/null || echo err)
    [ "$d" = "$WANT" ] && ok=$((ok + 1)) || ok=0
    [ "$ok" -ge 6 ] && return 0
    sleep 2
  done
  return 1
}

echo "==> [3/3] 覆盖 :latest 并等待收敛"
LATEST_OK=1
for attempt in 1 2 3 4 5; do
  crane copy "$SRC" "$REG:latest" >/dev/null 2>&1 || true
  if converged; then
    echo "   :latest 已稳定指向 ${WANT:0:19}（连续 6 次一致）"
    LATEST_OK=0
    break
  fi
  echo "   第 $attempt 次覆盖后 :latest 仍在抖动，5s 后重试…"
  sleep 5
done
if [ "$LATEST_OK" != 0 ]; then
  echo "!! :latest 始终没有稳定到本次 digest（不影响按日期 tag 部署）"
fi

# 有可用 kubeconfig 就直接切镜像，绕开 :latest 解析
if [ "$MODE" = "--deploy" ] || kubectl config current-context >/dev/null 2>&1; then
  if ! kubectl config current-context >/dev/null 2>&1; then
    echo "!! 没有可用的 kubeconfig，无法自动切换镜像"
    kubectl_hint
    exit 1
  fi
  # 按 digest 钉死：:latest 与日期 tag 都可能被 registry 解析成旧 manifest，digest 不会
  echo "==> [4/4] kubectl 切换镜像到 $REG@${WANT:0:19}…"
  kubectl -n "$NS" set image "deploy/$DEPLOY" "$CONTAINER=$REG@$WANT"
  kubectl -n "$NS" rollout status "deploy/$DEPLOY" --timeout=600s
  echo "==> [5/5] 校验线上"
  sleep 5
  verify_online
  exit $?
fi

kubectl_hint
if [ "$LATEST_OK" = 0 ]; then
  echo "下一步（二选一）："
  echo "  A. VKE 控制台 → 无状态负载 $DEPLOY → 点「重新部署」（image 需为 $REG:latest）"
  echo "  B. 配置 kubeconfig 后跑 ./scripts/release.sh --deploy，之后无需再碰控制台"
  echo "部署后跑：./scripts/release.sh --verify"
else
  echo "!! 先别去点部署：改用不可变引用部署"
  echo "   VKE 控制台把镜像改成 $SRC，或配好 kubeconfig 后跑 --deploy"
fi
exit 0
