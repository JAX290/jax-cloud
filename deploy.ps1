[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Server,

    [string]$Domain = "cloud.jax.markets",

    [switch]$InstallDocker,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $here ".env"
if (-not (Test-Path $envPath)) { throw ".env not found: copy .env.example first" }

$tmp = Join-Path $env:TEMP ("jax-app-deploy-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null

$bundle = Join-Path $tmp "app.tar.gz"
& tar -czf $bundle --exclude=node_modules --exclude=.next --exclude=.git --exclude=jax.db --exclude=media --exclude=data --exclude=.env -C $here .
if ($LASTEXITCODE -ne 0) { throw "tar failed" }

$content = Get-Content $envPath -Raw
$content = $content -replace "(?m)^SERVER_URL=.*$", "SERVER_URL=https://$Domain"
$content = $content -replace "(?m)^DATABASE_URL=.*$", "DATABASE_URL=file:/app/data/jax.db"
if ($content -notmatch "SERVER_URL=") { $content += "`nSERVER_URL=https://$Domain`n" }
if ($content -notmatch "SITE_ADDRESS=") { $content += "SITE_ADDRESS=$Domain`n" }

$uploadEnv = Join-Path $tmp ".env"
[System.IO.File]::WriteAllText($uploadEnv, $content, (New-Object System.Text.UTF8Encoding($false)))

$remote = @(
    "mkdir -p /opt/jax-app/data /opt/jax-app/media /opt/jax-app/caddy-nodes /opt/jax-app/caddy-snippets",
    "cd /opt/jax-app && tar -xzf app.tar.gz && rm -f app.tar.gz",
    "cd /opt/jax-app && chmod +x scripts/*.sh 2>/dev/null; test -f caddy-nodes/_placeholder.caddy || printf '# placeholder\n' > caddy-nodes/_placeholder.caddy",
    "cd /opt/jax-app && docker compose up -d --build",
    "# 节点面板反代自动生成 + 免登录 Cookie 刷新（新节点注册后 1 分钟内自动生效）",
    "bash /opt/jax-app/scripts/jax-cron.sh --install",
    "bash /opt/jax-app/scripts/sync-caddy-nodes.sh --once || true",
    "bash /opt/jax-app/scripts/refresh-panel-sessions.sh || true"
)

if ($DryRun) {
    Write-Host "DryRun OK"
    Write-Host "  bundle : $bundle"
    Write-Host "  env    : $uploadEnv"
    $remote | ForEach-Object { Write-Host "  remote: $_" }
    exit 0
}

if ($InstallDocker) {
    Write-Host "==> check / install docker"
    $install = "(command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh) && (docker compose version >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y docker-compose-plugin))"
    & ssh $Server $install
    if ($LASTEXITCODE -ne 0) { throw "docker install failed" }
}

Write-Host "==> upload to ${Server}:/opt/jax-app"
& ssh $Server "mkdir -p /opt/jax-app/data /opt/jax-app/media"
if ($LASTEXITCODE -ne 0) { throw "cannot create remote directory" }

& scp $bundle $uploadEnv (Join-Path $here "docker-compose.yml") (Join-Path $here "Caddyfile") "${Server}:/opt/jax-app/"
if ($LASTEXITCODE -ne 0) { throw "upload failed" }

Write-Host "==> build & start (first build may take several minutes)"
foreach ($cmd in $remote) {
    & ssh $Server $cmd
    if ($LASTEXITCODE -ne 0) { throw "remote command failed: $cmd" }
}

Write-Host ""
Write-Host "deployed: https://$Domain"
Write-Host "logs: ssh $Server 'cd /opt/jax-app && docker compose logs -f app'"


# ---- 部署后自动清理旧镜像，避免 30G 盘被撑满 ----
Write-Host "==> cleanup dangling images"
& ssh $Server "docker image prune -af >/dev/null 2>&1"

# 磁盘用到 80% 以上时，连带清 build cache（平时留着让下次构建快一些）
$diskAware = 'USED=$(df --output=pcent / | tail -1 | tr -dc "0-9"); if [ "$USED" -ge 80 ]; then echo "disk ${USED}% -> prune build cache"; docker builder prune -af >/dev/null 2>&1; fi; df -h / | tail -1'
& ssh $Server $diskAware
