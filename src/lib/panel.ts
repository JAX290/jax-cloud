export type PanelClient = {
  id: number
  email: string
  subId?: string
  totalGB: number
  expiryTime: number
  enable: boolean
  limitIp: number
  traffic?: { up?: number; down?: number; lastOnline?: number }
}

const PANEL_BASE = (process.env.PANEL_BASE_URL || '').replace(/\/$/, '')
const PANEL_TOKEN = process.env.PANEL_API_TOKEN || ''

export const panelConfigured = Boolean(PANEL_BASE && PANEL_TOKEN)

export async function listPanelClients(): Promise<PanelClient[]> {
  if (!PANEL_BASE || !PANEL_TOKEN) return []
  try {
    const res = await fetch(`${PANEL_BASE}/panel/api/clients/list`, {
      headers: { Authorization: `Bearer ${PANEL_TOKEN}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json?.obj) ? (json.obj as PanelClient[]) : []
  } catch {
    return []
  }
}

/**
 * 客户端命名规则：{customerNo}-{seq}
 * 例：10086-1、10086-2
 */
export function pickCustomerClients(clients: PanelClient[], customerNo: number | string): PanelClient[] {
  const prefix = `${customerNo}-`
  return clients
    .filter((c) => String(c.email || '').startsWith(prefix))
    .sort((a, b) => String(a.email).localeCompare(String(b.email), 'zh-CN', { numeric: true }))
}

export function clientUsedBytes(c: PanelClient): number {
  return Number(c.traffic?.up || 0) + Number(c.traffic?.down || 0)
}

export function isClientOnline(c: PanelClient, windowMs = 5 * 60 * 1000): boolean {
  const last = Number(c.traffic?.lastOnline || 0)
  return last > 0 && Date.now() - last < windowMs
}

export type CreateClientParams = {
  email: string
  limitIp: number
  totalGB: number
  expiryTime: number
  inboundId?: number
  comment?: string
}

/** 在面板创建客户端（幂等由调用方保证） */
export async function createPanelClient(params: CreateClientParams): Promise<{ ok: boolean; error?: string }> {
  if (!PANEL_BASE || !PANEL_TOKEN) return { ok: false, error: '面板未配置' }
  const client = {
    id: crypto.randomUUID(),
    email: params.email,
    flow: 'xtls-rprx-vision',
    limitIp: params.limitIp,
    totalGB: params.totalGB,
    expiryTime: params.expiryTime,
    enable: true,
    tgId: 0,
    subId: Math.random().toString(36).slice(2, 18),
    comment: params.comment || '',
    reset: 0,
  }
  try {
    const res = await fetch(`${PANEL_BASE}/panel/api/clients/add`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PANEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ client, inboundIds: [params.inboundId || 1] }),
      cache: 'no-store',
    })
    const json: any = await res.json().catch(() => ({}))
    if (!json?.success) return { ok: false, error: json?.msg || `HTTP ${res.status}` }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}

export async function findPanelClient(email: string): Promise<PanelClient | undefined> {
  const all = await listPanelClients()
  return all.find((c) => c.email === email)
}

export type SubConfig = {
  enabled: boolean
  port: number
  path: string
  domain: string
}

export async function getSubConfig(): Promise<SubConfig | null> {
  if (!PANEL_BASE || !PANEL_TOKEN) return null
  try {
    const res = await fetch(`${PANEL_BASE}/panel/api/setting/all`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PANEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    })
    const json: any = await res.json().catch(() => ({}))
    const obj = json?.obj || {}
    if (!obj || Object.keys(obj).length === 0) return null
    return {
      enabled: Boolean(obj.subEnable),
      port: Number(obj.subPort || 2096),
      path: String(obj.subPath || '/sub/'),
      domain: String(obj.subDomain || ''),
    }
  } catch {
    return null
  }
}

export function panelHost(): string {
  try {
    return new URL(PANEL_BASE).hostname
  } catch {
    return ''
  }
}

/** 订阅链接：{host}:{port}{path}{subId} */
export function buildSubLink(cfg: SubConfig | null, subId: string, host: string): string {
  if (!cfg || !cfg.enabled || !subId) return ''
  const h = cfg.domain || host
  if (!h) return ''
  const p = cfg.path.endsWith('/') ? cfg.path : `${cfg.path}/`
  return `http://${h}:${cfg.port}${p}${subId}`
}


