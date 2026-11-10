#!/bin/bash
# =============================================================================
#  换服务器恢复脚本（在【新服务器】上跑）
#
#  目的：把备份集铺回 /opt/jax-app，之后回本地跑 deploy.ps1 就行。
#
#  用法：
#    1) 把备份集放到 /root/jax-restore/（或任意目录）：
#         jax-YYYYmmdd-HHMMSS.db.gz     数据库（必需）
#         env-YYYYmmdd-HHMMSS.bak       .env（必需）
#         traffic-history.json          流量时序（可选）
#         node-clients-cache.json       节点客户端快照（可选）
#         media-YYYYmmdd-HHMM.tar.gz    媒体文件（可选，约 270MB）
#    2) bash restore.sh /root/jax-restore
#    3) 回本地： powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -Server root@<新IP>
#
#  注意：新服务器如果是新 Tailscale 设备，IP 可能变；记得把 .env 里的
#        PANEL_HOST 改成新 IP（Caddy / 工作台面板链接都用它）。
# =============================================================================
set -u

APP_DIR="${APP_DIR:-/opt/jax-app}"
SRC="${1:-/root/jax-restore}"

say() { printf '%s %s\n' "$(date '+%F %T')" "$*"; }
die() { say "ERROR: $*"; exit 1; }

[ -d "$SRC" ] || die "备份目录不存在: $SRC"

DBGZ=$(ls -1t "$SRC"/jax-*.db.gz 2>/dev/null | head -1)
MEDIATAR=$(ls -1t "$SRC"/media-*.tar.gz 2>/dev/null | head -1)
ENVF=$(ls -1t "$SRC"/env-*.bak 2>/dev/null | head -1)
[ -n "$DBGZ" ] || die "找不到 jax-*.db.gz"
[ -n "$ENVF" ] || die "找不到 env-*.bak（.env 备份）"

say "数据库: $DBGZ"
say "媒体:   ${MEDIATAR:-未找到（跳过）}"
say "环境:   $ENVF"

mkdir -p "$APP_DIR"/{data,media,backups,caddy-nodes,caddy-snippets,backup-secrets} || die "建目录失败"

# 已经部署过的话先停服务，避免写库冲突
if [ -f "$APP_DIR/docker-compose.yml" ]; then
  (cd "$APP_DIR" && docker compose stop app caddy) >/dev/null 2>&1 || true
fi

say "恢复数据库…"
gunzip -c "$DBGZ" > "$APP_DIR/data/jax.db" || die "解压数据库失败"
python3 - "$APP_DIR/data/jax.db" <<'PY' || die "数据库校验失败"
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
ok = c.execute('pragma integrity_check').fetchone()[0]
tables = c.execute("select count(*) from sqlite_master where type='table'").fetchone()[0]
customers = c.execute("select count(*) from customers").fetchone()[0]
orders = c.execute("select count(*) from orders").fetchone()[0]
nodes = c.execute("select count(*) from nodes").fetchone()[0]
c.close()
print('integrity=%s tables=%d customers=%d orders=%d nodes=%d' % (ok, tables, customers, orders, nodes))
sys.exit(0 if ok == 'ok' else 1)
PY

for f in traffic-history.json node-clients-cache.json; do
  if [ -f "$SRC/$f" ]; then
    cp -f "$SRC/$f" "$APP_DIR/data/$f"
    say "恢复 $f"
  fi
done

if [ -n "$MEDIATAR" ]; then
  say "恢复媒体文件（约 270MB，稍慢）…"
  tar -xzf "$MEDIATAR" -C "$APP_DIR" || die "解压媒体失败"
fi

cp -f "$ENVF" "$APP_DIR/.env" || die "恢复 .env 失败"
chmod 600 "$APP_DIR/.env"

# 备份目录本身也恢复（保留历史）
mkdir -p "$APP_DIR/backups/latest" "$APP_DIR/backup-secrets"
cp -f "$DBGZ" "$APP_DIR/backups/" 2>/dev/null || true
cp -f "$ENVF" "$APP_DIR/backup-secrets/" 2>/dev/null || true
[ -n "$MEDIATAR" ] && cp -f "$MEDIATAR" "$APP_DIR/backups/" 2>/dev/null

say "恢复完成。下一步："
say "  1) 检查 $APP_DIR/.env 里的 PANEL_HOST 是否等于新服务器 Tailscale IP"
say "  2) 本地跑 deploy.ps1 -Server root@<新IP>"
say "  3) 验证 /staff、面板免登录、/api/cron/health、/sitemap.xml"
