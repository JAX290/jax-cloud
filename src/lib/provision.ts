import { nodeBase, type NodeDoc } from './node-client'

type CreateResult = { ok: boolean; error?: string }

/** 生成 16 位小写字母数字的 subId（加密安全随机，避免 Math.random 被预测） */
const SUB_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
export function generateSubId(len = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let s = ''
  for (let i = 0; i < len; i++) s += SUB_ALPHABET[bytes[i] % SUB_ALPHABET.length]
  return s
}

/** 重新生成客户端密钥（uuid），用于「泄露后彻底重置」 */
export function generateUuid(): string {
  return crypto.randomUUID()
}

/**
 * 选一台可用节点：在线 + 客户端数最少。
 * clientCount 由健康检查定期刷新（未刷新时按 0 处理）。
 */
export async function pickOnlineNode(payload: any): Promise<NodeDoc | null> {
  try {
    const found = await payload.find({
      collection: 'nodes',
      where: { status: { equals: 'online' } },
      sort: 'clientCount',
      limit: 10,
      overrideAccess: true,
    })
    const docs = (found.docs || []) as any[]
    if (!docs.length) return null
    return docs[0]
  } catch {
    return null
  }
}

/** 取节点上第一个入站的 id（用于把客户端挂进去） */
async function firstInboundId(node: NodeDoc): Promise<number | null> {
  try {
    const res = await fetch(`${nodeBase(node)}/panel/api/inbounds/list`, {
      headers: { Authorization: `Bearer ${node.token}` },
      signal: AbortSignal.timeout(10000),
    })
    const json: any = await res.json().catch(() => ({}))
    const list = Array.isArray(json?.obj) ? json.obj : []
    const usable = list.find((i: any) => i && i.id && i.enable !== false) || list[0]
    return usable?.id ? Number(usable.id) : null
  } catch {
    return null
  }
}

export type CreateOnNodeParams = {
  email: string
  limitIp: number
  totalGB: number
  expiryTime: number
  comment?: string
  /** 迁移时保留原 uuid */
  uuid?: string
  /** 迁移时保留原 subId（订阅链接不变的关键） */
  subId?: string
}

export async function createClientOnNode(
  node: NodeDoc,
  params: CreateOnNodeParams,
): Promise<CreateResult> {
  if (!node.token) return { ok: false, error: '节点缺少 API Token' }

  const inboundId = await firstInboundId(node)
  if (!inboundId) return { ok: false, error: '节点上没有可用入站' }

  const client = {
    id: params.uuid || crypto.randomUUID(),
    email: params.email,
    flow: 'xtls-rprx-vision',
    limitIp: params.limitIp,
    totalGB: params.totalGB,
    expiryTime: params.expiryTime,
    enable: true,
    tgId: 0,
    subId: params.subId || generateSubId(),
    comment: params.comment || '',
    reset: 0,
  }

  try {
    const res = await fetch(`${nodeBase(node)}/panel/api/clients/add`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${node.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client, inboundIds: [inboundId] }),
      signal: AbortSignal.timeout(15000),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!json?.success) {
      return { ok: false, error: json?.msg || `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}

/** 统计某节点上的客户端数量（健康检查用） */
export async function countNodeClients(node: NodeDoc): Promise<number> {
  try {
    const res = await fetch(`${nodeBase(node)}/panel/api/clients/list`, {
      headers: { Authorization: `Bearer ${node.token}` },
      signal: AbortSignal.timeout(8000),
    })
    const json: any = await res.json().catch(() => ({}))
    return Array.isArray(json?.obj) ? json.obj.length : 0
  } catch {
    return -1
  }
}

export type ClientPatch = {
  limitIp?: number
  totalGB?: number
  expiryTime?: number
  enable?: boolean
  /** 重置订阅链接用：换一个新的 subId */
  subId?: string
  /** 彻底重置密钥用：换一个新的 uuid */
  uuid?: string
}

/**
 * 修改节点上已有客户端的参数（走 inbound update）
 * 用于「升级差价」等场景：例如把 limitIp 从 4 提到 8
 */
export async function updateClientOnNode(
  node: NodeDoc,
  email: string,
  patch: ClientPatch,
): Promise<CreateResult> {
  if (!node.token) return { ok: false, error: '节点缺少 API Token' }
  const base = nodeBase(node)
  const headers = {
    Authorization: `Bearer ${node.token}`,
    'Content-Type': 'application/json',
  }

  try {
    // 3x-ui 的 update 是「全量替换」，必须传完整且类型正确的字段，
    // 否则未传的字段会被重置（流量/到期/启用状态）。
    const getRes = await fetch(`${base}/panel/api/clients/get/${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${node.token}` },
      signal: AbortSignal.timeout(10000),
    })
    const getJson: any = await getRes.json().catch(() => ({}))
    const c = getJson?.obj?.client
    if (!c) return { ok: false, error: `节点上找不到客户端 ${email}` }

    const body = {
      id: patch.uuid ?? c.uuid, // 注意：这里必须是 uuid 字符串，不是数据库 id
      email,
      flow: c.flow || 'xtls-rprx-vision',
      limitIp: patch.limitIp ?? c.limitIp ?? 0,
      totalGB: patch.totalGB ?? c.totalGB ?? 0,
      expiryTime: patch.expiryTime ?? c.expiryTime ?? 0,
      enable: patch.enable ?? c.enable ?? true,
      tgId: 0,
      subId: patch.subId ?? (c.subId || ''),
      comment: c.comment || '',
      reset: 0,
      allowedIPs: [], // 必须是数组
      password: '',
      auth: '',
      security: 'auto',
    }

    const res = await fetch(`${base}/panel/api/clients/update/${encodeURIComponent(email)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!json?.success) {
      return { ok: false, error: json?.msg || `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}
