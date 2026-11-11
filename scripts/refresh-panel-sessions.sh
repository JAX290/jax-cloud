#!/bin/bash
# =============================================================================
#  刷新各节点 3x-ui 面板 session，写到 Caddy snippet，实现「点开面板免登录」
#
#  - cron 每 3 小时跑一次（cookie 有效期 6 小时，见 3x-ui 的 sessionMaxAge）
#  - 登录失败会清空该节点的 snippet，避免注入过期 Cookie 把人卡在空白页
#  - 有任何 snippet 变化才 reload caddy
#
#  面板账号统一用 install.sh 里固定的 jaxadmin / JaxPanel@2026!Secure
# =============================================================================
set -u

APP_DIR="${APP_DIR:-/opt/jax-app}"
DB="${DB:-$APP_DIR/data/jax.db}"
SNIPPET_DIR="${SNIPPET_DIR:-$APP_DIR/caddy-snippets}"
PANEL_USER="${PANEL_USER:-jaxadmin}"
PANEL_PASS="${PANEL_PASS:-JaxPanel@2026!Secure}"
# 每台节点独立面板凭据（推荐）：{"1":{"user":"..","pass":".."}, ...}，权限 600
PANEL_CREDS="${PANEL_CREDS:-$APP_DIR/panel-creds.json}"
CADDY_CONTAINER="${CADDY_CONTAINER:-jax-caddy}"
CADDY_CONFIG="${CADDY_CONFIG:-/etc/caddy/Caddyfile}"

mkdir -p "$SNIPPET_DIR"
changed=0
count=0
failed=0

NODES_TMP=$(mktemp)
python3 - "$DB" > "$NODES_TMP" <<'PY'
import sqlite3
import sys
try:
    con = sqlite3.connect(sys.argv[1])
    for r in con.execute("select id, ip, panel_port, panel_path from nodes where status='online'"):
        print("|".join(str(x) if x is not None else "" for x in r))
    con.close()
except Exception as e:
    sys.stderr.write("db err: %s\n" % e)
PY

while IFS='|' read -r id ip port path; do
    [ -z "${id:-}" ] && continue
    path=$(echo "$path" | sed 's#^/##; s#/$##')
    [ -z "$path" ] && path="jaxpanel"
    base="http://$ip:$port/$path"
    snippet="$SNIPPET_DIR/node-${id}.caddy"

    # 取该节点自己的面板账号（没有就退回环境变量/默认值）
    node_user="$PANEL_USER"
    node_pass="$PANEL_PASS"
    if [ -f "$PANEL_CREDS" ]; then
        read -r node_user node_pass <<EOF2
$(python3 - "$PANEL_CREDS" "$id" "$PANEL_USER" "$PANEL_PASS" <<'PY'
import json
import sys
path, nid, fallback_user, fallback_pass = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
try:
    data = json.load(open(path, encoding='utf-8'))
    c = data.get(str(nid)) or {}
    print(c.get('user') or fallback_user, c.get('pass') or fallback_pass)
except Exception:
    print(fallback_user, fallback_pass)
PY
)
EOF2
    fi

    jar=$(mktemp)
    if ! curl -s -c "$jar" --max-time 10 "$base/" -o /dev/null 2>/dev/null; then
        echo "node-${id} (${ip}): unreachable"
        rm -f "$jar"
        failed=$((failed + 1))
        continue
    fi

    csrf=$(curl -s -b "$jar" -c "$jar" --max-time 10 "$base/csrf-token" 2>/dev/null \
        | python3 -c "import sys,json;print(json.load(sys.stdin).get('obj',''))" 2>/dev/null)
    if [ -z "$csrf" ]; then
        echo "node-${id} (${ip}): no csrf token"
        rm -f "$jar"
        failed=$((failed + 1))
        continue
    fi

    resp=$(curl -s -b "$jar" -c "$jar" --max-time 10 -X POST \
        -H "X-CSRF-Token: $csrf" \
        -d "username=$node_user&password=$node_pass" \
        "$base/login" 2>/dev/null)

    if printf '%s' "$resp" | grep -q '"success":true'; then
        session=$(python3 - "$jar" <<'PY'
import http.cookiejar
import sys
try:
    jar = http.cookiejar.MozillaCookieJar(sys.argv[1])
    jar.load(ignore_discard=True, ignore_expires=True)
    for c in jar:
        if c.name == '3x-ui':
            print(c.value)
            break
except Exception:
    pass
PY
)
        if [ -n "$session" ]; then
            printf 'header_up Cookie "3x-ui=%s"\n' "$session" > "$snippet"
            count=$((count + 1))
            echo "node-${id} (${ip}): session refreshed"
        else
            echo "node-${id} (${ip}): login ok but no cookie"
            failed=$((failed + 1))
        fi
    else
        # 清空旧 Cookie，否则面板会一直拿过期 Cookie 自动登出
        if [ -s "$snippet" ]; then
            : > "$snippet"
            changed=1
        fi
        echo "node-${id} (${ip}): login failed -> cleared snippet"
        failed=$((failed + 1))
    fi
    rm -f "$jar"
done < "$NODES_TMP"
rm -f "$NODES_TMP"

echo "refreshed: $count, failed: $failed"

# snippet 有新内容也要 reload 才生效
if [ -n "$(find "$SNIPPET_DIR" -name 'node-*.caddy' -newermt '-2 minutes' 2>/dev/null | head -1)" ]; then
    changed=1
fi

if [ "$changed" = "1" ] || [ "$count" -gt 0 ]; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CADDY_CONTAINER"; then
        docker exec "$CADDY_CONTAINER" caddy reload --config "$CADDY_CONFIG" 2>&1 | tail -1
    fi
fi
