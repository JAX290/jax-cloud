#!/usr/bin/env bash
set -euo pipefail

SERVER="${1:?usage: ./deploy.sh root@1.2.3.4 [domain]}"
DOMAIN="${2:-cloud.jax.markets}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -f "$HERE/.env" ]]; then
  echo ".env not found: copy .env.example first" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

tar -czf "$TMP/app.tar.gz" \
  --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude=jax.db --exclude=media --exclude=data --exclude=.env \
  -C "$HERE" .

sed -e "s|^SERVER_URL=.*|SERVER_URL=https://$DOMAIN|" \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=file:/app/data/jax.db|" \
    "$HERE/.env" > "$TMP/.env"
grep -q '^SERVER_URL=' "$TMP/.env" || echo "SERVER_URL=https://$DOMAIN" >> "$TMP/.env"
grep -q '^SITE_ADDRESS=' "$TMP/.env" || echo "SITE_ADDRESS=$DOMAIN" >> "$TMP/.env"

ssh "$SERVER" "mkdir -p /opt/jax-app/data /opt/jax-app/media /opt/jax-app/caddy-nodes /opt/jax-app/caddy-snippets"
scp "$TMP/app.tar.gz" "$TMP/.env" "$HERE/docker-compose.yml" "$HERE/Caddyfile" "$SERVER:/opt/jax-app/"

ssh "$SERVER" "cd /opt/jax-app && tar -xzf app.tar.gz && rm -f app.tar.gz"
ssh "$SERVER" "cd /opt/jax-app && chmod +x scripts/*.sh 2>/dev/null; test -f caddy-nodes/_placeholder.caddy || printf '# placeholder\n' > caddy-nodes/_placeholder.caddy"
ssh "$SERVER" "cd /opt/jax-app && docker compose up -d --build"
# 节点面板反代自动生成 + 免登录 Cookie 刷新（新节点注册后 1 分钟内自动生效）
ssh "$SERVER" "bash /opt/jax-app/scripts/jax-cron.sh --install"
ssh "$SERVER" "bash /opt/jax-app/scripts/sync-caddy-nodes.sh --once || true"
ssh "$SERVER" "bash /opt/jax-app/scripts/refresh-panel-sessions.sh || true"

echo "deployed: https://$DOMAIN"
echo "logs: ssh $SERVER 'cd /opt/jax-app && docker compose logs -f app'"
