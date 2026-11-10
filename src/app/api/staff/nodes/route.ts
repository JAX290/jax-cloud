import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { discoverNode } from '@/lib/node-discovery'
import { clientIpFromHeaders, isTailscaleIp } from '@/lib/tailscale'

export const dynamic = 'force-dynamic'

async function requireTailscale() {
  const headers = await getHeaders()
  if (!isTailscaleIp(clientIpFromHeaders(headers))) {
    return false
  }
  return true
}

/** 探测一台新 VPS 的面板 */
export async function POST(req: Request) {
  if (!(await requireTailscale())) {
    return Response.json({ ok: false, error: '仅限内网访问' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const ip = String(body?.ip || '').trim()
  if (!ip) {
    return Response.json({ ok: false, error: '请输入 IP 地址' }, { status: 400 })
  }

  const result = await discoverNode(ip)
  return Response.json(result)
}

/** 保存/更新节点 */
export async function PUT(req: Request) {
  if (!(await requireTailscale())) {
    return Response.json({ ok: false, error: '仅限内网访问' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const body = await req.json().catch(() => ({}))
  const ip = String(body?.ip || '').trim()
  const token = String(body?.token || '')
  if (!ip || !token) {
    return Response.json({ ok: false, error: '缺少 IP 或 Token' }, { status: 400 })
  }

  const data: any = {
    name: String(body?.name || `节点-${ip.split('.').pop()}`),
    ip,
    region: body?.region ? String(body.region) : undefined,
    panelPort: Number(body?.panelPort || 2053),
    panelPath: String(body?.panelPath || 'jaxpanel'),
    token,
    subPort: Number(body?.subPort || 2096),
    subPath: String(body?.subPath || '/sub/'),
    status: 'online',
    lastCheckAt: new Date().toISOString(),
    clientCount: Number(body?.clientCount || 0),
  }

  try {
    const existing = await payload.find({
      collection: 'nodes',
      where: { ip: { equals: ip } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length) {
      const updated = await payload.update({
        collection: 'nodes',
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })
      return Response.json({ ok: true, mode: 'updated', node: { id: updated.id, name: updated.name } })
    }

    const created = await payload.create({
      collection: 'nodes',
      data,
      overrideAccess: true,
    })
    return Response.json({ ok: true, mode: 'created', node: { id: created.id, name: created.name } })
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || '保存失败' }, { status: 500 })
  }
}
