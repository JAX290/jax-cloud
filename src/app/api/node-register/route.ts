import { getPayload } from 'payload'

import config from '@/payload.config'
import { sendWecom } from '@/lib/wecom'

export const dynamic = 'force-dynamic'

/**
 * 新节点自动注册（由 VPS 上的 install.sh 部署完成后回调）
 * POST /api/node-register
 * body: { secret, ip, panelPort, panelPath, token, subPort, subPath, region, note, panelUser }
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const body = await req.json().catch(() => ({} as any))

  const expected = process.env.NODE_REGISTER_SECRET || ''
  if (!expected || String(body?.secret || '') !== expected) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const ip = String(body?.ip || '').trim()
  if (!ip) return Response.json({ ok: false, error: 'missing ip' }, { status: 400 })

  const panelPort = Number(body?.panelPort || 2053)
  const panelPath = String(body?.panelPath || 'jaxpanel').replace(/^\/+|\/+$/g, '')
  const token = String(body?.token || '')
  const subPort = Number(body?.subPort || 2096)
  const subPath = String(body?.subPath || '').replace(/^\/+|\/+$/g, '')
  const region = String(body?.region || '')
  const note = String(body?.note || '')

  // 查重：同 IP 已存在则更新
  const existing = await payload.find({
    collection: 'nodes',
    where: { ip: { equals: ip } },
    limit: 1,
    overrideAccess: true,
  })

  const data: any = {
    ip,
    panelPort,
    panelPath: `/${panelPath}/`,
    token,
    subPort,
    subPath: subPath ? `/${subPath}/` : '',
    region,
    note,
    status: 'online',
  }

  let node: any
  let created = false
  if (existing.docs.length) {
    node = await payload.update({
      collection: 'nodes',
      id: (existing.docs[0] as any).id,
      data,
      overrideAccess: true,
    })
  } else {
    // 自动编号：节点-01、节点-02...
    const all = await payload.find({ collection: 'nodes', limit: 200, overrideAccess: true })
    const nums = (all.docs as any[])
      .map((n) => Number(String(n.name || '').replace(/\D/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0)
    const next = nums.length ? Math.max(...nums) + 1 : 1
    data.name = `节点-${String(next).padStart(2, '0')}`

    node = await payload.create({
      collection: 'nodes',
      data,
      overrideAccess: true,
    })
    created = true
  }

  const proxyPort = 31000 + Number(node.id)

  await sendWecom(
    `🆕 **${created ? '新节点已注册' : '节点信息已更新'}**\n名称：${node.name}\nIP：${ip}\n面板端口：${panelPort}\n反代端口：${proxyPort}\n\n反代配置和面板免登录会自动生成，1 分钟内生效，不用手改 Caddyfile 或 docker-compose。`,
  )

  return Response.json({
    ok: true,
    created,
    nodeId: node.id,
    name: node.name,
    proxyPort,
    panelUrl: `http://100.124.251.8:${proxyPort}/${panelPath}/`,
  })
}
