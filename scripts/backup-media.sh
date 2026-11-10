#!/bin/bash
# =============================================================================
#  媒体文件备份（案例配图 + 客户端安装包，约 270MB）
#
#  - 每周一次（见 scripts/jax-cron.sh，周日 03:30）
#  - 输出：/opt/jax-app/backups/media-YYYYmmdd-HHMM.tar.gz
#  - 同时更新 backups/latest/media-latest.tar.gz（硬链接，不占双份空间）
#  - 只保留最近 6 份
#  - 手动跑： bash /opt/jax-app/scripts/backup-media.sh
# =============================================================================
set -u

APP_DIR="${APP_DIR:-/opt/jax-app}"
MEDIA_DIR="${MEDIA_DIR:-$APP_DIR/media}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
LATEST_DIR="$BACKUP_DIR/latest"
KEEP=6
STAMP="$(date +%Y%m%d-%H%M)"

mkdir -p "$BACKUP_DIR" "$LATEST_DIR" || exit 1
if [ ! -d "$MEDIA_DIR" ]; then
  echo "media dir not found: $MEDIA_DIR"
  exit 1
fi

OUT="$BACKUP_DIR/media-$STAMP.tar.gz"
TMP="$OUT.tmp"

if ! tar -czf "$TMP" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"; then
  echo "$(date '+%F %T') tar failed"
  rm -f "$TMP"
  exit 1
fi
# 快速校验：能列出内容才算完整
if ! tar -tzf "$TMP" >/dev/null 2>&1; then
  echo "$(date '+%F %T') archive verify failed"
  rm -f "$TMP"
  exit 1
fi
mv -f "$TMP" "$OUT"

# latest 用硬链接，不额外占空间
ln -f "$OUT" "$LATEST_DIR/media-latest.tar.gz" 2>/dev/null || cp -f "$OUT" "$LATEST_DIR/media-latest.tar.gz"

# 只保留最近 KEEP 份
ls -1t "$BACKUP_DIR"/media-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r f; do
  rm -f "$f"
done

SIZE=$(du -h "$OUT" | cut -f1)
COUNT=$(ls -1 "$BACKUP_DIR"/media-*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
echo "$(date '+%F %T') media backup ok: $OUT (${SIZE}), total=$COUNT"
