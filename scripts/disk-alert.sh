#!/bin/bash
# =============================================================================
#  磁盘用量告警（主控 30G 盘容易满）
#  - 每 30 分钟由 cron 跑一次（见 scripts/jax-cron.sh）
#  - 用量 >= 阈值（默认 85%）推企业微信，同一问题 12 小时内只推一次
#  - 手动跑： bash /opt/jax-app/scripts/disk-alert.sh
# =============================================================================
set -u
APP_DIR="${APP_DIR:-/opt/jax-app}"
THRESHOLD="${DISK_ALERT_PCT:-85}"
STAMP="$APP_DIR/data/.disk-alert-stamp"
COOLDOWN_SECONDS=43200

USE=$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')
[ -n "${USE:-}" ] || exit 0
if [ "$USE" -lt "$THRESHOLD" ]; then
  exit 0
fi

# 冷却期内不重复推送
if [ -f "$STAMP" ]; then
  LAST=$(stat -c %Y "$STAMP" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  if [ $((NOW - LAST)) -lt $COOLDOWN_SECONDS ]; then
    exit 0
  fi
fi

HOOK=$(grep -E '^WECOM_WEBHOOK=' "$APP_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2-)
[ -n "${HOOK:-}" ] || exit 0

# 注意：\n 这里保持「反斜杠 + n」两个字面字符，JSON 里正好是换行转义
CONTENT="💾 **主控磁盘告警**\n当前用量：${USE}%（阈值 ${THRESHOLD}%）\n\n救急：docker builder prune -af && docker image prune -af\n检查：docker system df"
PAYLOAD=$(printf '{"msgtype":"markdown","markdown":{"content":"%s"}}' "$CONTENT")

if curl -s -m 10 -X POST "$HOOK" -H 'Content-Type: application/json' -d "$PAYLOAD" >/dev/null 2>&1; then
  mkdir -p "$(dirname "$STAMP")"
  touch "$STAMP"
  echo "$(date '+%F %T') disk alert sent: ${USE}%"
fi
