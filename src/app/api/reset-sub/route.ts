import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { findClientNode } from '@/lib/migrate'
import { generateSubId, generateUuid, updateClientOnNode } from '@/lib/provision'
import { sendWecom } from '@/lib/wecom'

export const dynamic = 'force-dynamic'

/**
 * 客户自助重置订阅
 * POST /api/reset-sub
 * body: { clientEmail, mode: 'subId' | 'full' }
 *
 *  - subId：只换订阅链接（旧订阅 URL 立刻 404，已导入设备不用动）
 *  - full ：重新生成 uuid + subId（真正吊销泄露的节点链接，但所有设备要重新导入）
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user || user.collection !== 'customers') {
    return Response.json({ ok: false, message: '请先登录' }, { status: 401 })
  }

  const customerNo = Number((user as any).customerNo || 0)
  if (!customerNo) {
    return Response.json({ ok: false, message: '客户编号异常，请联系客服' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const clientEmail = String(body?.clientEmail || '').trim()
  const mode = body?.mode === 'full' ? 'full' : 'subId'

  if (!clientEmail.startsWith(`${customerNo}-`)) {
    return Response.json({ ok: false, message: '这个客户端不属于你' }, { status: 403 })
  }

  const nodesRes: any = await payload
    .find({ collection: 'nodes', where: { status: { equals: 'online' } }, limit: 50, overrideAccess: true })
    .catch(() => ({ docs: [] }))
  const found = await findClientNode(nodesRes.docs || [], clientEmail)
  if (!found) {
    return Response.json(
      { ok: false, message: '客户端不在线或没找到，稍后再试' },
      { status: 404 },
    )
  }

  const subId = generateSubId()
  const res =
    mode === 'full'
      ? await updateClientOnNode(found.node, clientEmail, { subId, uuid: generateUuid() })
      : await updateClientOnNode(found.node, clientEmail, { subId })

  if (!res.ok) {
    return Response.json({ ok: false, message: res.error || '重置失败' }, { status: 500 })
  }

  if (mode === 'full') {
    await sendWecom(
      `🔑 **客户重置订阅密钥**\n客户端：${clientEmail}\n节点：${found.node.name} (${found.node.ip})\n动作：重新生成 UUID + 订阅链接\n提示：该客户所有设备需重新导入。`,
    )
  }

  return Response.json({
    ok: true,
    mode,
    subLink: `https://sub.jax.markets/sub/${subId}`,
    needReimport: mode === 'full',
  })
}
