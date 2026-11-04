# JAX CLOUD

跨境电商服务器部署 / 运维服务的展示站 + 客户后台 + Payload 管理后台。

- 前台：Next.js 16 App Router
- 后台：Payload CMS 3（SQLite）
- 部署：Docker Compose + Tailscale（只允许 tailnet 访问，不开放公网）

## 一键部署（全新 Debian 12/13）

在 Tailscale 管理后台生成一个 Auth Key：

- Settings → Keys → Generate auth key
- 勾选 **Reusable**、**Pre-approved**
- 建议打标签 `tag:server`

然后在一台**全新 Debian 12/13** 服务器上以 root 执行：

```bash
curl -fsSL -H "Accept: application/vnd.github.raw" \
  https://api.github.com/repos/JAX290/jax-cloud/contents/install.sh | \
  sudo bash -s -- --authkey tskey-auth-xxxxxxxxxxxx
```

> 部分网络访问 `raw.githubusercontent.com` 会失败，所以这里走 GitHub API 取脚本；
> 如果 API 也限流，用下面的 clone 方式。

也可以克隆仓库后执行：

```bash
git clone https://github.com/JAX290/jax-cloud.git
cd jax-cloud
sudo bash install.sh --authkey tskey-auth-xxxxxxxxxxxx
```

脚本会依次完成：

1. 安装 Tailscale，加入 tailnet，开启 Tailscale SSH
2. 安装 Docker / docker compose
3. 下载本仓库代码到 `/opt/jax-cloud`
4. 构建镜像并启动，应用只绑定 Tailscale IP
5. 首次启动自动初始化数据库和演示数据
6. 开启 ufw：拒绝公网入站，只放行 `tailscale0`

## 部署完成后

脚本会输出 Tailscale IP，例如 `100.82.92.35`：

| 入口 | 地址 |
|---|---|
| 前台 | `http://100.82.92.35:3000` |
| 后台 | `http://100.82.92.35:3000/admin` |

开启 MagicDNS 后也可以用：

```
http://jax-cloud:3000
```

默认管理员：

```
admin@jax.local / JaxAdmin123!
```

登录后请立即修改密码。

> 流量走 Tailscale（WireGuard 加密），所以内网访问用 HTTP 即可，不需要公网证书。

## 参数

```bash
bash install.sh --help
```

| 参数 | 说明 |
|---|---|
| `--authkey KEY` | Tailscale Auth Key（必填，除非已登录） |
| `--hostname NAME` | Tailscale 设备名，默认 `jax-cloud` |
| `--app-dir DIR` | 安装目录，默认 `/opt/jax-cloud` |
| `--no-firewall` | 不开启 ufw（调试用） |
| `--local DIR` | 使用本地代码目录 |

## Tailscale ACL 建议

如果要限制谁能 SSH / 访问：

```json
{
  "tagOwners": {
    "tag:server": ["autogroup:admin"]
  },
  "ssh": [
    {
      "action": "accept",
      "src": ["autogroup:member"],
      "dst": ["tag:server"],
      "users": ["root", "autogroup:nonroot"]
    }
  ]
}
```

## 关闭公网访问

脚本默认执行：

```bash
ufw default deny incoming
ufw allow in on tailscale0
ufw allow 41641/udp
ufw --force enable
```

公网 `22 / 80 / 443 / 3000` 都会不可达，只能从 tailnet 访问。

云厂商安全组也建议一并关闭 22/80/443 入站。

如果把自己锁在外面，用云厂商的 VNC / Web Console 登录，执行：

```bash
ufw disable
```

## 更新代码

```bash
cd /opt/jax-cloud
git pull            # 或重新下载
docker compose -f docker-compose.tailscale.yml up -d --build
```

> 代码目录不是 git 仓库（脚本是下载 tar 包），更新可以重新跑一遍 `install.sh`，
> 会保留 `data/`、`media/` 和 `.env`。

## 数据

| 内容 | 位置 |
|---|---|
| SQLite | `/opt/jax-cloud/data/jax.db` |
| 上传文件 | `/opt/jax-cloud/media/` |
| 环境变量 | `/opt/jax-cloud/.env` |

备份直接打包 `data/` 和 `media/` 即可。

## 目录结构

```
src/                         Next.js + Payload 源码
public/cases/                案例配图
Dockerfile
docker-compose.tailscale.yml Tailscale 专用（只绑 Tailscale IP）
docker-compose.yml           可选：公网 Caddy 模式
install.sh                   一键部署脚本
```

## 邮件

`SMTP_*` 为空时注册/登录不受影响，但「忘记密码」发不出邮件。

配置 `/opt/jax-cloud/.env` 后重启：

```bash
cd /opt/jax-cloud
docker compose -f docker-compose.tailscale.yml up -d
```

## 常见问题

**Tailscale 没起来**

```bash
tailscale status
tailscale up --ssh
```

**应用起不来**

```bash
cd /opt/jax-cloud
docker compose -f docker-compose.tailscale.yml logs --tail=100 app
```

**磁盘不够**

Docker 构建缓存可以清理：

```bash
docker system prune -af
```
