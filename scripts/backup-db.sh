#!/bin/bash
# =============================================================================
#  JAX CLOUD 数据库自动备份
#
#  - 用 sqlite3 的 backup API 做一致性快照（WAL 模式下直接 cp 可能拷到半个库）
#  - 输出：/opt/jax-app/backups/jax-YYYYmmdd-HHMMSS.db.gz，保留 30 天
#  - 同时更新 backups/latest/ 下的固定文件名，供 NAS/电脑定时拉取
#  - 含密钥的 .env 备份单独放 backup-secrets/，不进可下载目录
#  - 顺带备份 traffic-history.json / node-clients-cache.json
#  - 失败会推企业微信；由 cron 每 6 小时跑一次（见 scripts/jax-cron.sh）
#  - 手动跑： bash /opt/jax-app/scripts/backup-db.sh
#  - 恢复： gunzip -c backups/jax-xxx.db.gz > data/jax.db && docker compose restart app
# =============================================================================
set -u

APP_DIR="${APP_DIR:-/opt/jax-app}"
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
SECRETS_DIR="${SECRETS_DIR:-$APP_DIR/backup-secrets}"
LATEST_DIR="$BACKUP_DIR/latest"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TMP_DB="$BACKUP_DIR/jax-$STAMP.db"

notify_fail() {
  local msg="$1"
  local hook
  hook=$(grep -E '^WECOM_WEBHOOK=' "$APP_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2-)
  if [ -n "${hook:-}" ]; then
    curl -s -m 10 -X POST "$hook" -H 'Content-Type: application/json' \
      -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"JAX 备份失败：$msg\"}}" >/dev/null 2>&1
  fi
}

if ! mkdir -p "$BACKUP_DIR"; then
  echo "cannot create $BACKUP_DIR"
  exit 1
fi
if [ ! -f "$DATA_DIR/jax.db" ]; then
  notify_fail "找不到 $DATA_DIR/jax.db"
  exit 1
fi

# 1. 一致性快照
python3 - "$DATA_DIR/jax.db" "$TMP_DB" <<'PY'
import sqlite3, sys
src = sqlite3.connect(sys.argv[1])
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
dst.close()
src.close()
PY
if [ $? -ne 0 ]; then
  notify_fail "sqlite backup 出错"
  rm -f "$TMP_DB"
  exit 1
fi

# 2. 校验
python3 - "$TMP_DB" <<'PY'
import sqlite3, sys, os
p = sys.argv[1]
size = os.path.getsize(p)
c = sqlite3.connect(p)
ok = c.execute('pragma integrity_check').fetchone()[0]
c.close()
if ok != 'ok' or size < 20000:
    sys.exit('bad backup: integrity=%s size=%d' % (ok, size))
print('integrity=ok size=%d' % size)
PY
if [ $? -ne 0 ]; then
  notify_fail "备份文件校验失败"
  rm -f "$TMP_DB"
  exit 1
fi

gzip -f "$TMP_DB" || exit 1

# 3. 附带文件 + 可下载的「最新一份」
mkdir -p "$LATEST_DIR" "$SECRETS_DIR" 2>/dev/null
chmod 700 "$SECRETS_DIR" 2>/dev/null

for f in traffic-history.json node-clients-cache.json; do
  if [ -f "$DATA_DIR/$f" ]; then
    cp -f "$DATA_DIR/$f" "$BACKUP_DIR/$f.latest"
    cp -f "$DATA_DIR/$f" "$LATEST_DIR/$f"
  fi
done
cp -f "$TMP_DB.gz" "$LATEST_DIR/jax-latest.db.gz"

# .env 含密钥：单独放不可下载目录
if [ -f "$APP_DIR/.env" ]; then
  cp -f "$APP_DIR/.env" "$SECRETS_DIR/env-$STAMP.bak" 2>/dev/null && chmod 600 "$SECRETS_DIR/env-$STAMP.bak" 2>/dev/null
fi

# 4. 清理过期
find "$BACKUP_DIR" -name 'jax-*.db.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null
find "$SECRETS_DIR" -name 'env-*.bak' -mtime +"$KEEP_DAYS" -delete 2>/dev/null

COUNT=$(find "$BACKUP_DIR" -name 'jax-*.db.gz' | wc -l | tr -d ' ')
SIZE=$(du -h "$TMP_DB.gz" 2>/dev/null | cut -f1)
echo "$(date '+%F %T') backup ok: $TMP_DB.gz (${SIZE:-?}), total=$COUNT"
