#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# JAX CLOUD 更新脚本
#
# 服务器上执行：
#   bash /opt/jax-cloud/update.sh
#
# 或远程一条命令：
#   curl -fsSL -H "Accept: application/vnd.github.raw" \
#     https://api.github.com/repos/JAX290/jax-cloud/contents/update.sh | bash
#
# 流程：
#   1. 备份 data / media / .env 到 /root/jax-backups
#   2. 下载 GitHub 最新代码
#   3. 同步源码（保留 data / media / .env）
#   4. 重新构建并启动
#   5. 健康检查
# ============================================================

REPO_OWNER="${REPO_OWNER:-JAX290}"
REPO_NAME="${REPO_NAME:-jax-cloud}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/jax-cloud}"
BACKUP_DIR="${BACKUP_DIR:-/root/jax-backups}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"
DO_BACKUP=1

usage() {
  cat <<'EOF'
用法：
  bash update.sh [选项]

选项：
  --branch NAME     更新到指定分支，默认 main
  --app-dir DIR     安装目录，默认 /opt/jax-cloud
  --no-backup       跳过备份（不推荐）
  -h, --help        显示帮助
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --branch) REPO_BRANCH="${2:-}"; shift 2 ;;
    --app-dir) APP_DIR="${2:-}"; shift 2 ;;
    --no-backup) DO_BACKUP=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $1"; usage; exit 1 ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 执行"
  exit 1
fi

if [ ! -f "$APP_DIR/docker-compose.tailscale.yml" ]; then
  echo "找不到 $APP_DIR/docker-compose.tailscale.yml"
  echo "请先运行 install.sh 完成首次部署"
  exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "==> 1/6 备份"
if [ "$DO_BACKUP" = "1" ]; then
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/jax-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$BACKUP_FILE" -C "$APP_DIR" data media .env
  echo "    $BACKUP_FILE"
  # 只保留最近 N 份
  ls -1t "$BACKUP_DIR"/jax-*.tar.gz 2>/dev/null | tail -n "+$((KEEP_BACKUPS + 1))" | xargs -r rm -f
else
  echo "    已跳过"
fi

echo "==> 2/6 下载最新代码"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/tarball/$REPO_BRANCH" \
    -o "$TMP_DIR/src.tar.gz"
else
  if ! curl -fsSL "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/tarball/$REPO_BRANCH" \
    -o "$TMP_DIR/src.tar.gz"; then
    curl -fsSL "https://codeload.github.com/$REPO_OWNER/$REPO_NAME/tar.gz/refs/heads/$REPO_BRANCH" \
      -o "$TMP_DIR/src.tar.gz"
  fi
fi
tar -xzf "$TMP_DIR/src.tar.gz" -C "$TMP_DIR" --strip-components=1
echo "    $REPO_OWNER/$REPO_NAME#$REPO_BRANCH"

echo "==> 3/6 同步源码（保留 data / media / .env）"
if ! command -v rsync >/dev/null 2>&1; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y rsync
fi
rsync -a --delete \
  --exclude data \
  --exclude media \
  --exclude .env \
  --exclude .git \
  "$TMP_DIR"/ "$APP_DIR"/

echo "==> 4/6 构建镜像"
cd "$APP_DIR"
COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi
$COMPOSE -f docker-compose.tailscale.yml build

echo "==> 5/6 同步数据库结构"
$COMPOSE -f docker-compose.tailscale.yml stop app || true
if ! $COMPOSE -f docker-compose.tailscale.yml run --rm -e NODE_ENV=development app \
  node_modules/.bin/tsx src/migrate.ts; then
  echo "数据库结构同步失败，尝试恢复旧容器"
  $COMPOSE -f docker-compose.tailscale.yml up -d app || true
  exit 1
fi

$COMPOSE -f docker-compose.tailscale.yml up -d
$COMPOSE -f docker-compose.tailscale.yml ps

echo "==> 6/6 健康检查"
TS_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
if [ -z "$TS_IP" ]; then
  echo "    无法获取 Tailscale IP，跳过 HTTP 检查"
  exit 0
fi

OK=0
for _ in $(seq 1 60); do
  if curl -fsS "http://$TS_IP:3000/" >/dev/null 2>&1; then
    OK=1
    break
  fi
  sleep 2
done

if [ "$OK" = "1" ]; then
  cat <<EOF

============================================================
 更新完成
============================================================
 前台：http://$TS_IP:3000
 后台：http://$TS_IP:3000/admin

 备份：$BACKUP_DIR
 日志：cd $APP_DIR && $COMPOSE -f docker-compose.tailscale.yml logs --tail=100 app
============================================================
EOF
else
  echo "应用未通过健康检查，查看日志："
  echo "cd $APP_DIR && $COMPOSE -f docker-compose.tailscale.yml logs --tail=100 app"
  exit 1
fi
