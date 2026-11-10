import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { clientIpFromHeaders, isTailscaleIp } from '@/lib/tailscale'
import { findClientNode, migrateClient } from '@/lib/migrate'

export const dynamic = 'force-dynamic'

/** 把一个客户端迁到另一台节点（保留 subId，订阅链接不变） */
export async function POST(req: Request) {
  const headers = await getHeaders()
  if (!isTailscaleIp(clientIpFromHeaders(headers))) {
    return Response.json({ ok: false, error: '仅限内网访问' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const body = await req.json().catch(() => ({}))
  const email = String(body?.email || '').trim()
  const toNodeId = Number(body?.toNodeId || 0)

  if (!email || !toNodeId) {
    return Response.json({ ok: false, error: '缺少 email 或目标节点' }, { status: 400 })
  }

  const nodesRes = await payload.find({
    collection: 'nodes',
    where: { status: { equals: 'online' } },
    limit: 50,
    overrideAccess: true,
  })
  const nodes = (nodesRes.docs || []) as any[]

  const found = await findClientNode(nodes, email)
  if (!found) {
    return Response.json({ ok: false, error: `所有节点上都找不到客户端 ${email}` }, { status: 404 })
  }

  const to = nodes.find((n) => Number(n.id) === toNodeId)
  if (!to) {
    return Response.json({ ok: false, error: '目标节点不存在或不在线' }, { status: 404 })
  }

  const result = await migrateClient(found.node, to, found.client)

  if (result.ok) {
    // 记录到订单（如果有对应订单）
    try {
      const orders = await payload.find({
        collection: 'orders',
        where: { clientEmail: { equals: email } },
        limit: 5,
        overrideAccess: true,
      })
      for (const o of orders.docs as any[]) {
        const log = Array.isArray(o.changeLog) ? o.changeLog : []
        await payload.update({
          collection: 'orders',
          id: o.id,
          data: {
            operator: `${o.operator || 'system'} → ${to.name} (${to.ip})`,
            changeLog: [
              ...log,
              {
                at: new Date().toISOString(),
                by: 'staff',
                detail: `节点迁移：${found.node.name} → ${to.name}`,
                reason: '手动迁移',
              },
            ],
          },
          overrideAccess: true,
        })
      }
    } catch {
      /* 记录失败不影响迁移结果 */
    }
  }

  return Response.json(result)
}
