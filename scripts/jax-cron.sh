#!/bin/bash
# =============================================================================
#  JAX CLOUD 定时任务（幂等安装；重复执行不会重复添加）
#
#  安装/更新： bash /opt/jax-app/scripts/jax-cron.sh --install
#  查看：      bash /opt/jax-app/scripts/jax-cron.sh --show
#
#  装的四条：
#   */5 * * * *  /api/cron/health        节点健康 + 订单超时 + 续费提醒
#   * * * * *    sync-caddy-nodes.sh     新节点自动生成反代配置
#   0 */3        refresh-panel-sessions  面板免登录 Cookie
#   */30         disk-alert.sh           磁盘告警
# =============================================================================
set -u
APP_DIR="${APP_DIR:-/opt/jax-app}"
MODE="${1:---install}"

case "$MODE" in
  --install)
    chmod +x "$APP_DIR"/scripts/*.sh 2>/dev/null || true
    SECRET=$(grep -E '^CRON_SECRET=' "$APP_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2-)
    SECRET="${SECRET:-jax-health-20261108}"
    tmp=$(mktemp)
    # 保留其它定时任务，只替换本项目的条目（注释行也要清掉，否则每跑一次多一行）
    crontab -l 2>/dev/null \
      | grep -v 'jax-app/scripts/' \
      | grep -v 'api/cron/health' \
      | grep -v 'api/cron/publish' \
      | grep -v 'api/cron/trial' \
      | grep -v 'JAX CLOUD（由 scripts/jax-cron.sh 生成' > "$tmp"
    cat >> "$tmp" <<EOF
# ===== JAX CLOUD（由 scripts/jax-cron.sh 生成，改这里会被覆盖）=====
*/5 * * * * curl -s 'https://cloud.jax.markets/api/cron/health?secret=${SECRET}' > /dev/null 2>&1
*/10 * * * * curl -s 'https://cloud.jax.markets/api/cron/publish?secret=${SECRET}' > /dev/null 2>&1
*/5 * * * * curl -s 'https://cloud.jax.markets/api/cron/trial?secret=${SECRET}' > /dev/null 2>&1
* * * * * $APP_DIR/scripts/sync-caddy-nodes.sh --once >> /var/log/jax-caddy-sync.log 2>&1
0 */3 * * * $APP_DIR/scripts/refresh-panel-sessions.sh >> /var/log/jax-panel-sessions.log 2>&1
*/30 * * * * $APP_DIR/scripts/disk-alert.sh >> /var/log/jax-disk-alert.log 2>&1
15 */6 * * * $APP_DIR/scripts/backup-db.sh >> /var/log/jax-backup.log 2>&1
30 3 * * 0 $APP_DIR/scripts/backup-media.sh >> /var/log/jax-media-backup.log 2>&1
EOF
    crontab "$tmp"
    rm -f "$tmp"
    echo "cron installed:"
    crontab -l
    ;;
  --show)
    crontab -l
    ;;
  *)
    echo "usage: jax-cron.sh [--install|--show]"
    exit 2
    ;;
esac
