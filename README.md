# JAX CLOUD · 全栈版（本地开发）

Next.js 16 + Payload CMS 3 + SQLite（本地开发用）。

已包含：

- 邮箱注册 / 验证 / 登录 / 找回密码 / 重置密码
- 客户中心：我的服务、我的工单
- 工单：新建、对话、状态
- 管理后台 `/admin`：客户、服务、工单、案例、站点设置
- 邮件：本地 SMTP 捕获器（开发）；生产填企业邮箱 SMTP

## 环境要求

- Node.js ≥ 20.9（本机 24.x）
- pnpm（本机 12.x）

## 首次启动

```powershell
cd D:\project\tools\jax-app
& "$env:APPDATA\npm\pnpm.cmd" install
```

复制环境变量：

```powershell
Copy-Item .env.example .env
```

初始化数据（会创建管理员、演示客户、示例服务/工单/案例）：

```powershell
& "$env:APPDATA\npm\pnpm.cmd" seed
```

启动本地邮件捕获器（另开一个终端）：

```powershell
pnpm dev:smtp
```

启动开发服务器：

```powershell
pnpm dev
```

打开：

- 前台：http://localhost:3000
- 后台：http://localhost:3000/admin

## 演示账号

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 管理员 | `admin@jax.local` | `JaxAdmin123!` |
| 客户 | `demo@jax.local` | `Demo123456!` |

> 演示客户已标记邮箱验证，可直接登录。

## 验证邮件在哪看

本地 SMTP 捕获器会把整封邮件打印在 `pnpm dev:smtp` 的终端里，包括验证链接和重置链接。不会真正发出去。

## 生产邮件

把 `.env` 改成企业邮箱 SMTP：

```
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_USER=no-reply@jax.markets
SMTP_PASS=你的授权码
EMAIL_FROM=no-reply@jax.markets
```

并配置 SPF / DKIM / DMARC。

## 常用脚本

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm start` | 生产启动 |
| `pnpm seed` | 初始化演示数据 |
| `pnpm dev:smtp` | 本地邮件捕获器 |
| `pnpm generate:types` | 生成 Payload 类型 |
| `pnpm generate:importmap` | 生成后台 importMap |

## 目录

```
jax-app/
├─ src/
│  ├─ app/
│  │  ├─ (frontend)/        # 前台：首页、注册、登录、账户、工单
│  │  ├─ (payload)/         # Payload 管理后台与 API
│  │  └─ api/               # 自定义接口：建工单、回复工单、退出
│  ├─ collections/          # Users / Customers / Services / Tickets / Cases / Media
│  ├─ globals/SiteSettings.ts
│  ├─ components/           # 客户端表单组件
│  ├─ payload.config.ts
│  └─ seed.ts
├─ .env.example
└─ package.json
```

## 生产构建

```powershell
& "$env:APPDATA\npm\pnpm.cmd" build
& "$env:APPDATA\npm\pnpm.cmd" start
```

## Docker 一键部署

前置：

- 干净的 VPS（**建议 2 核 4 GB 起**；首次构建比较吃内存）
- 已安装 Docker 与 compose（或让脚本代装）
- 域名 A 记录指向 VPS 公网 IP
- 安全组放行 80 / 443

Windows：

```powershell
cd D:\project\tools\jax-app
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 `
  -Server root@<VPS_IP> -Domain cloud.jax.markets -InstallDocker
```

Linux / macOS：

```bash
cd jax-app
./deploy.sh root@<VPS_IP> cloud.jax.markets
```

脚本会：打包源码（排除 node_modules）→ 上传到 `/opt/jax-app` → `docker compose up -d --build`。
首次构建在服务器上跑，约 5–15 分钟；Caddy 自动申请 HTTPS。

数据卷：

- `./data` → SQLite 数据库（`/app/data/jax.db`）
- `./media` → 上传的图片
- `./caddy-nodes` → 节点面板反代片段（自动生成）
- `./caddy-snippets` → 面板免登录 Cookie（自动生成）

更新：改完代码重新执行同一条部署命令即可。

## 节点面板反代（自动生成，不用手改）

每台节点的 3x-ui 面板都通过主控 Caddy 反代给 Tailscale 内网：端口 = `31000 + 节点 id`，
例如节点 id=1 → `http://100.124.251.8:31001/hsdf.../`。

- `scripts/sync-caddy-nodes.sh`：每分钟按数据库生成 `caddy-nodes/node-<id>.caddy`，有变化才 reload Caddy；
  节点删除后自动清理片段。部署时还会顺手装好 cron。
- `docker-compose.yml`：端口区间 `31001-31050` 一次映射完，新增节点不用再改编排文件。
- `scripts/refresh-panel-sessions.sh`：每 3 小时登录各节点面板，把 session Cookie 写进
  `caddy-snippets/node-<id>.caddy`，实现点开面板免登录；登录失败会清空旧 Cookie。

所以新节点用一键脚本装完、自动注册到主控后，**1 分钟内**反代和免登录都会自动生效。


日志：

```bash
ssh root@<VPS_IP> "cd /opt/jax-app && docker compose logs -f app"
```

## 已验证的流程

- `pnpm build` 通过，生产模式路由 200
- 注册 → SMTP 捕获器收到验证邮件 → 点击链接验证成功
- 登录 → `/account` 显示客户信息、服务、工单
- 浏览器内新建工单 → 跳转工单详情 → 回复成功
- 管理员 `admin@jax.local` 可登录 `/api/users/login` 与 `/admin`

## 正式上线前

1. 改 `.env`：`PAYLOAD_SECRET`、`SERVER_URL`、`SITE_ADDRESS`
2. 改管理员密码（后台或数据库）
3. 邮件改成企业邮箱 SMTP，并配置 SPF / DKIM / DMARC
4. 备份 `data/jax.db` 与 `media/`
5. 删除或修改演示账号 `demo@jax.local`
6. 如需更大规模，把 SQLite 换成 Postgres（Payload 支持 `@payloadcms/db-postgres`）

## 安全说明

- 客户只能读取自己的服务与工单（Payload access control + 接口二次校验）
- 自定义工单接口会校验登录态与工单归属
- 生产请修改 `PAYLOAD_SECRET`、管理员密码，并启用 HTTPS
