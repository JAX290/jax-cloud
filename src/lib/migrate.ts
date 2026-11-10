import { listNodeClients, nodeBase, type NodeDoc } from './node-client'
import { createClientOnNode } from './provision'

export type MigrateResult = {
  ok: boolean
  error?: string
  from?: string
  to?: string
  email?: string
  warning?: string
}

/** 在所有节点里找某个 email 所在的节点 */
export async function findClientNode(
  nodes: NodeDoc[],
  email: string,
): Promise<{ node: NodeDoc; client: any } | null> {
  for (const node of nodes) {
    try {
      const cls = await listNodeClients(node)
      const client = cls.find((c) => String(c.email) === email)
      if (client) return { node, client }
    } catch {
      continue
    }
  }
  return null
}

async function deleteClientOnNode(node: NodeDoc, email: string): Promise<boolean> {
  if (!node.token) return false
  const base = nodeBase(node)
  try {
    // 3x-ui 3.x: POST /panel/api/clients/del/{email}，body 带 email
    const res = await fetch(`${base}/panel/api/clients/del/${encodeURIComponent(email)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${node.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(10000),
    })
    const json: any = await res.json().catch(() => ({}))
    return json?.success === true
  } catch {
    return false
  }
}

/**
 * 迁移客户端到另一台节点。
 * 关键：保留 subId 和 uuid，客户端订阅链接不变、无需重新配置。
 */
export async function migrateClient(
  from: NodeDoc,
  to: NodeDoc,
  client: any,
): Promise<MigrateResult> {
  if (String(from.ip) === String(to.ip)) {
    return { ok: false, error: '源节点和目标节点相同' }
  }

  const email = String(client.email || '')
  if (!email) return { ok: false, error: '客户端 email 为空' }

  // 1. 目标节点不能已有同名
  try {
    const toClients = await listNodeClients(to)
    if (toClients.some((c) => String(c.email) === email)) {
      return { ok: false, error: '目标节点已存在同名客户端，请先处理' }
    }
  } catch (e: any) {
    return { ok: false, error: `目标节点不可达：${e?.message || e}` }
  }

  // 2. 在目标节点创建（保留 subId / uuid / 流量 / 到期）
  const created = await createClientOnNode(to, {
    email,
    limitIp: Number(client.limitIp || 4),
    totalGB: Number(client.totalGB || 0),
    expiryTime: Number(client.expiryTime || 0),
    comment: String(client.comment || ''),
    uuid: String(client.uuid || ''),
    subId: String(client.subId || ''),
  })

  if (!created.ok) {
    return { ok: false, error: `目标节点创建失败：${created.error || '未知'}` }
  }

  // 3. 删除源节点上的旧客户端
  const deleted = await deleteClientOnNode(from, email)

  return {
    ok: true,
    email,
    from: `${from.name || from.ip} (${from.ip})`,
    to: `${to.name || to.ip} (${to.ip})`,
    warning: deleted ? undefined : '旧客户端未自动删除，请到源节点面板手动删除',
  }
}
