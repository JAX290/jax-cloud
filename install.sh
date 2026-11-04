#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# JAX CLOUD 一键部署（Tailscale 专用）
#
# 全新 Debian 12/13 服务器，root 执行：
#   bash install.sh --authkey tskey-auth-xxxxxxxx
#
# 做的事：
#   1. 安装 Tailscale 并加入 tailnet（--ssh 开启 Tailscale SSH）
#   2. 安装 Docker
#   3. 拉取本仓库代码，构建并启动应用
#   4. 应用只绑定 Tailscale IP，公网无法访问
#   5. 开启 ufw：拒绝公网入站，只放行 tailscale0
#
# 部署完成后：
#   前台  http://<tailscale-ip>:3000
#   后台  http://<tailscale-ip>:3000/admin
# ============================================================

REPO_OWNER="${REPO_OWNER:-JAX290}"
REPO_NAME="${REPO_NAME:-jax-cloud}"
REPO_BRANCH="${REPO_BRANCH:-main}"

APP_DIR="${APP_DIR:-/opt/jax-cloud}"
TS_HOSTNAME="${TS_HOSTNAME:-jax-cloud}"
TS_AUTHKEY="${TS_AUTHKEY:-}"
ENABLE_FIREWALL="${ENABLE_FIREWALL:-1}"
APP_SRC="${APP_SRC:-}"

usage() {
  cat <<'EOF'
用法：
  bash install.sh --authkey tskey-auth-xxxx [选项]

选项：
  --authkey KEY       Tailscale Auth Key（也可用环境变量 TS_AUTHKEY）
  --hostname NAME     Tailscale 设备名，默认 jax-cloud
  --app-dir DIR       安装目录，默认 /opt/jax-cloud
  --no-firewall       不开启 ufw（调试用）
  --local DIR         使用本地代码目录，不下载 GitHub
  -h, --help          显示帮助
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --authkey) TS_AUTHKEY="${2:-}"; shift 2 ;;
    --hostname) TS_HOSTNAME="${2:-}"; shift 2 ;;
    --app-dir) APP_DIR="${2:-}"; shift 2 ;;
    --no-firewall) ENABLE_FIREWALL=0; shift ;;
    --local) APP_SRC="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $1"; usage; exit 1 ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 执行：sudo bash install.sh --authkey ..."
  exit 1
fi

echo "==> 1/7 安装基础依赖"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y curl ca-certificates tar openssl ufw

echo "==> 2/7 安装 Tailscale 并加入 tailnet"
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

if ! tailscale ip -4 >/dev/null 2>&1; then
  if [ -z "$TS_AUTHKEY" ]; then
    if [ -t 0 ]; then
      read -rsp "请输入 Tailscale Auth Key: " TS_AUTHKEY
      echo
    else
      echo "缺少 Tailscale Auth Key，请用 --authkey 或 TS_AUTHKEY 传入"
      exit 1
    fi
  fi
  tailscale up --authkey "$TS_AUTHKEY" --ssh --hostname "$TS_HOSTNAME" --accept-dns=false
fi

TS_IP=""
for _ in $(seq 1 30); do
  TS_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
  [ -n "$TS_IP" ] && break
  sleep 2
done
if [ -z "$TS_IP" ]; then
  echo "Tailscale 未就绪，请检查 auth key / ACL 后重试"
  tailscale status || true
  exit 1
fi
echo "    Tailscale IP: $TS_IP"

echo "==> 3/7 安装 Docker"
if ! command -v docker >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose || \
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2
  systemctl enable --now docker
fi

COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  else
    echo "未找到 docker compose / docker-compose"
    exit 1
  fi
fi

echo "==> 4/7 准备代码"
if [ -n "$APP_SRC" ] && [ -f "$APP_SRC/Dockerfile" ]; then
  SRC_DIR="$APP_SRC"
else
  TMP_DIR="$(mktemp -d)"
  echo "    下载 $REPO_OWNER/$REPO_NAME#$REPO_BRANCH"
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" \
      "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/tarball/$REPO_BRANCH" \
      -o "$TMP_DIR/src.tar.gz"
  else
    # 优先 API（raw.githubusercontent 在部分网络不可达），失败再走 codeload
    if ! curl -fsSL "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/tarball/$REPO_BRANCH" \
      -o "$TMP_DIR/src.tar.gz"; then
      curl -fsSL "https://codeload.github.com/$REPO_OWNER/$REPO_NAME/tar.gz/refs/heads/$REPO_BRANCH" \
        -o "$TMP_DIR/src.tar.gz"
    fi
  fi
  tar -xzf "$TMP_DIR/src.tar.gz" -C "$TMP_DIR" --strip-components=1
  SRC_DIR="$TMP_DIR"
fi

mkdir -p "$APP_DIR"
cp -a "$SRC_DIR"/. "$APP_DIR"/
mkdir -p "$APP_DIR/data" "$APP_DIR/media"
cd "$APP_DIR"

echo "==> 5/7 写入环境变量"
if [ ! -f "$APP_DIR/.env" ]; then
  SECRET="$(openssl rand -hex 32 2>/dev/null || date +%s%N | sha256sum | cut -d' ' -f1)"
  cat > "$APP_DIR/.env" <<EOF
PAYLOAD_SECRET=$SECRET
DATABASE_URL=file:/app/data/jax.db
SERVER_URL=http://$TS_IP:3000
BIND_IP=$TS_IP
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=no-reply@jax.markets
EMAIL_FROM_NAME=JAX CLOUD
EOF
else
  grep -q '^SERVER_URL=' "$APP_DIR/.env" && \
    sed -i "s|^SERVER_URL=.*|SERVER_URL=http://$TS_IP:3000|" "$APP_DIR/.env" || \
    echo "SERVER_URL=http://$TS_IP:3000" >> "$APP_DIR/.env"
  grep -q '^BIND_IP=' "$APP_DIR/.env" && \
    sed -i "s|^BIND_IP=.*|BIND_IP=$TS_IP|" "$APP_DIR/.env" || \
    echo "BIND_IP=$TS_IP" >> "$APP_DIR/.env"
fi

echo "==> 6/7 构建并启动"
$COMPOSE -f docker-compose.tailscale.yml up -d --build

if [ ! -f "$APP_DIR/data/jax.db" ]; then
  echo "    首次运行：初始化数据库"
  $COMPOSE -f docker-compose.tailscale.yml stop app
  $COMPOSE -f docker-compose.tailscale.yml run --rm -e NODE_ENV=development app \
    node_modules/.bin/tsx src/seed.ts
  $COMPOSE -f docker-compose.tailscale.yml up -d app
fi

echo "    等待应用就绪"
for _ in $(seq 1 60); do
  if curl -fsS "http://$TS_IP:3000/" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! curl -fsS "http://$TS_IP:3000/" >/dev/null 2>&1; then
  echo "应用未就绪，查看日志：cd $APP_DIR && $COMPOSE -f docker-compose.tailscale.yml logs --tail=100 app"
  exit 1
fi

echo "==> 7/7 关闭公网访问"
if [ "$ENABLE_FIREWALL" = "1" ]; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow in on tailscale0
  ufw allow 41641/udp
  ufw --force enable
  echo "    已开启 ufw：公网 22 / 80 / 443 / 3000 均不可入站"
else
  echo "    已跳过 ufw（--no-firewall）"
fi

cat <<EOF

============================================================
 部署完成
============================================================
 前台：http://$TS_IP:3000
 后台：http://$TS_IP:3000/admin

 Tailscale 设备名：$TS_HOSTNAME
 也可以用：http://$TS_HOSTNAME:3000（MagicDNS 开启时）

 默认管理员：admin@jax.local / JaxAdmin123!
 请立即登录后台修改密码。

 公网访问已关闭，只能通过 Tailscale 访问。
 如云厂商有安全组，请同时关闭 22/80/443 入站。
============================================================
EOF
