import { getPayload } from 'payload'

import config from '@/payload.config'
import { getClientLinks, listNodeClients } from './node-client'

export type ResolvedSub = {
  node: any
  client: any
  links: string[]
}

/**
 * 根据 subId 找到它所在的节点和客户端，返回 vless 链接列表。
 * 遍历所有在线节点，命中即返回。
 */
export async function resolveSubscription(subId: string): Promise<ResolvedSub | null> {
  const key = String(subId || '').trim()
  if (!key) return null

  const payload = await getPayload({ config })

  let nodes: any[] = []
  try {
    const found = await payload.find({
      collection: 'nodes',
      where: { status: { equals: 'online' } },
      limit: 50,
      overrideAccess: true,
    })
    nodes = found.docs as any[]
  } catch {
    return null
  }

  for (const node of nodes) {
    try {
      const clients = await listNodeClients(node)
      const client = clients.find((c) => String(c.subId || '') === key)
      if (!client) continue

      const links = await getClientLinks(node, client.email)
      if (links.length) {
        return { node, client, links }
      }
    } catch {
      continue
    }
  }

  return null
}
