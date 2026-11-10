export type DiscoveredNode = {
  ip: string
  panelPort: number
  panelPath: string
  token: string
  subPort: number
  subPath: string
  subEnabled: boolean
  panelVersion?: string
  clientCount: number
}

export type DiscoverResult = {
  ok: boolean
  error?: string
  data?: DiscoveredNode
}

// 与 3x-ui-oneclick/scripts/install.sh 里的固定值保持一致
const PANEL_PORT = 2053
const PANEL_PATH = 'jaxpanel'
const PANEL_USER = 'jaxadmin'
const PANEL_PASS = 'JaxPanel@2026!Secure'

export const DEFAULT_PANEL_PORT = PANEL_PORT
export const DEFAULT_PANEL_PATH = PANEL_PATH

type FetchHeaders = Headers & { getSetCookie?: () => string[] }

export async function discoverNode(ip: string): Promise<DiscoverResult> {
  const cleanIp = String(ip || '').trim()
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp)) {
    return { ok: false, error: 'IP 格式不对' }
  }

  const base = `http://${cleanIp}:${PANEL_PORT}/${PANEL_PATH}`

  try {
    // 1. 探活 + 拿初始 cookie
    const homeRes = await fetch(`${base}/`, {
      signal: AbortSignal.timeout(6000),
      redirect: 'manual',
    })
    if (homeRes.status >= 500) {
      return { ok: false, error: `面板返回 ${homeRes.status}` }
    }

    const cookieParts: string[] = []
    const homeCookies = (homeRes.headers as FetchHeaders).getSetCookie?.() || []
    homeCookies.forEach((c) => cookieParts.push(c.split(';')[0]))
    let cookieHeader = cookieParts.join('; ')

    // 2. 拿 CSRF token（3x-ui 3.11 登录必须带）
    const csrfRes = await fetch(`${base}/csrf-token`, {
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
      signal: AbortSignal.timeout(6000),
    })
    const csrfCookies = (csrfRes.headers as FetchHeaders).getSetCookie?.() || []
    csrfCookies.forEach((c) => {
      const kv = c.split(';')[0]
      if (!cookieParts.some((p) => p.split('=')[0] === kv.split('=')[0])) cookieParts.push(kv)
    })
    cookieHeader = cookieParts.join('; ')

    const csrf = ((await csrfRes.json().catch(() => ({}))) as any)?.obj
    if (!csrf) {
      return { ok: false, error: '未拿到 CSRF token' }
    }

    // 3. 登录
    const loginRes = await fetch(`${base}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify({ username: PANEL_USER, password: PANEL_PASS }),
      signal: AbortSignal.timeout(8000),
    })
    const loginJson: any = await loginRes.json().catch(() => ({}))
    if (!loginJson?.success) {
      return { ok: false, error: loginJson?.msg || '登录失败（账号密码不匹配，可能不是本脚本部署的节点）' }
    }

    const loginCookies = (loginRes.headers as FetchHeaders).getSetCookie?.() || []
    loginCookies.forEach((c) => {
      const kv = c.split(';')[0]
      if (!cookieParts.some((p) => p.split('=')[0] === kv.split('=')[0])) cookieParts.push(kv)
    })
    cookieHeader = cookieParts.join('; ')

    // 4. 登录后重新拿 CSRF（3x-ui 登录后会刷新）
    const csrf2Res = await fetch(`${base}/csrf-token`, {
      headers: { Cookie: cookieHeader },
      signal: AbortSignal.timeout(6000),
    })
    const csrf2 = ((await csrf2Res.json().catch(() => ({}))) as any)?.obj || csrf

    // 5. 创建 API Token
    const tokenRes = await fetch(`${base}/panel/api/setting/apiTokens/create`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf2,
      },
      body: JSON.stringify({ name: 'jax-app', scope: 'admin', expiresAt: 0 }),
      signal: AbortSignal.timeout(8000),
    })
    const tokenJson: any = await tokenRes.json().catch(() => ({}))
    const token = tokenJson?.obj?.token
    if (!token) {
      return { ok: false, error: tokenJson?.msg || '创建 API Token 失败' }
    }

    // 5. 读设置
    const setRes = await fetch(`${base}/panel/api/setting/all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    })
    const settings: any = ((await setRes.json().catch(() => ({}))) as any)?.obj || {}

    // 6. 客户端数量
    let clientCount = 0
    try {
      const clRes = await fetch(`${base}/panel/api/clients/list`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      })
      const clJson: any = await clRes.json().catch(() => ({}))
      clientCount = Array.isArray(clJson?.obj) ? clJson.obj.length : 0
    } catch {
      /* 忽略 */
    }

    return {
      ok: true,
      data: {
        ip: cleanIp,
        panelPort: PANEL_PORT,
        panelPath: PANEL_PATH,
        token,
        subPort: Number(settings.subPort || 2096),
        subPath: String(settings.subPath || '/sub/'),
        subEnabled: Boolean(settings.subEnable),
        panelVersion: settings.panelVersion,
        clientCount,
      },
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || '探测失败（网络不通或端口被防火墙拦）' }
  }
}
