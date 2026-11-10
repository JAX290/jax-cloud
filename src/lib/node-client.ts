export type NodeDoc = {
  id: number
  name?: string
  ip: string
  region?: string
  panelPort?: number
  panelPath?: string
  token?: string
  subPort?: number
  subPath?: string
  status?: string
  clientCount?: number
}

export function nodeBase(n: NodeDoc): string {
  const path = String(n.panelPath || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  return `http://${n.ip}:${Number(n.panelPort || 2053)}${path ? `/${path}` : ''}`
}

export type NodeClient = {
  id: number
  email: string
  subId?: string
  totalGB?: number
  expiryTime?: number
  enable?: boolean
  limitIp?: number
  uuid?: string
  flow?: string
  comment?: string
  traffic?: { up?: number; down?: number; lastOnline?: number }
}

export async function listNodeClients(n: NodeDoc): Promise<NodeClient[]> {
  const res = await fetch(`${nodeBase(n)}/panel/api/clients/list`, {
    headers: { Authorization: `Bearer ${n.token}` },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
  const json: any = await res.json().catch(() => ({}))
  return Array.isArray(json?.obj) ? json.obj : []
}

export async function getClientLinks(n: NodeDoc, email: string): Promise<string[]> {
  const res = await fetch(
    `${nodeBase(n)}/panel/api/clients/links/${encodeURIComponent(email)}`,
    {
      headers: { Authorization: `Bearer ${n.token}` },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    },
  )
  const json: any = await res.json().catch(() => ({}))
  return Array.isArray(json?.obj) ? json.obj : []
}

/** 构造 Subscription-Userinfo 响应头，客户端会显示流量/到期 */
export function buildUserinfo(c: NodeClient): string {
  const up = Number(c.traffic?.up || 0)
  const down = Number(c.traffic?.down || 0)
  const total = Number(c.totalGB || 0)
  const expire = Number(c.expiryTime || 0)
  const parts = [`upload=${up}`, `download=${down}`, `total=${total}`]
  if (expire > 0) parts.push(`expire=${Math.floor(expire / 1000)}`)
  return parts.join('; ')
}
