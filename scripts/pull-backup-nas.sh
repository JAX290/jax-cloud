#!/bin/bash
# =============================================================================
#  在 NAS（或任意 Linux 机器）上定时拉取主控机的最新数据库备份
#
#  - 走 Tailscale 内网 HTTP：默认 http://100.124.251.8/backups/latest
#  - 用法： bash pull-backup-nas.sh [目标目录]
#           （默认 /volume1/backups/jax，按你的 NAS 卷改；也可用环境变量 DEST=）
#  - 建议：加到 NAS 的「任务计划 / 计划任务」里，每天跑一次
#  - 保留：默认 60 天（KEEP_DAYS 可改）
# =============================================================================
set -u

BASE="${BASE:-http://100.124.251.8/backups/latest}"
DEST="${1:-${DEST:-/volume1/backups/jax}}"
KEEP_DAYS="${KEEP_DAYS:-60}"
# WITH_MEDIA=1 时一并拉媒体包（约 270MB，建议单独每周跑一次）
WITH_MEDIA="${WITH_MEDIA:-0}"
STAMP="$(date +%Y%m%d-%H%M)"
DAY="$(date +%Y%m%d)"

mkdir -p "$DEST" || { echo "无法创建 $DEST"; exit 1; }

fail=0
fetch() { # $1=远端文件 $2=本地文件名
  local url="$BASE/$1" out="$DEST/$2"
  if curl -fsSL --max-time 120 -o "$out.tmp" "$url"; then
    mv -f "$out.tmp" "$out"
    echo "ok: $2"
  else
    echo "FAIL: $1"
    rm -f "$out.tmp"
    fail=$((fail + 1))
  fi
}

fetch 'jax-latest.db.gz' "jax-$STAMP.db.gz"
fetch 'traffic-history.json' "traffic-history-$DAY.json"
fetch 'node-clients-cache.json' "node-clients-cache-$DAY.json"
if [ "$WITH_MEDIA" = "1" ]; then
  fetch 'media-latest.tar.gz' "media-$DAY.tar.gz"
  # 媒体包只留最近 4 份
  ls -1t "$DEST"/media-*.tar.gz 2>/dev/null | tail -n +5 | while read -r f; do rm -f "$f"; done
fi

# 保留最近 KEEP_DAYS 天
find "$DEST" -name 'jax-*.db.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null
find "$DEST" -name 'traffic-history-*.json' -mtime +"$KEEP_DAYS" -delete 2>/dev/null
find "$DEST" -name 'node-clients-cache-*.json' -mtime +"$KEEP_DAYS" -delete 2>/dev/null

if [ "$fail" -ne 0 ]; then
  echo "$(date '+%F %T') 有 $fail 个文件拉取失败，检查 Tailscale 是否在线"
  exit 1
fi
echo "$(date '+%F %T') 备份已拉取到 $DEST"
