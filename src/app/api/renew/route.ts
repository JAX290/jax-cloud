import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { listNodeClients } from '@/lib/node-client'
import { quoteRenewal } from '@/lib/renew'

export const dynamic = 'force-dynamic'

/**
 * 客户自助续费下单
 * POST /api/renew
 * body: { clientEmail, pack: '200'|'1000', months: 1..12 }
 *
 * 只生成「待支付」订单；工作台确认收款后由 Orders 的 provisionOrder 自动延期 + 累加流量。
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user || user.collection !== 'customers') {
    return Response.json({ ok: false, message: '请先登录' }, { status: 401 })
  }

  const customer = user as any
  const customerNo = Number(customer.customerNo || 0)
  if (!customerNo) {
    return Response.json({ ok: false, message: '客户编号异常，请联系客服' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const clientEmail = String(body?.clientEmail || '').trim()
  const pack = String(body?.pack || '200')
  const monthsRaw = Number(body?.months || 1)

  if (!clientEmail.startsWith(`${customerNo}-`)) {
    return Response.json({ ok: false, message: '这个客户端不属于你' }, { status: 403 })
  }
  const quote = quoteRenewal(pack, monthsRaw)
  if (!quote) {
    return Response.json({ ok: false, message: '套餐不对' }, { status: 400 })
  }

  // 确认客户端确实存在（防止给不存在的客户端下单）
  const nodesRes: any = await payload
    .find({
      collection: 'nodes',
      where: { status: { equals: 'online' } },
      limit: 50,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [] }))

  let found: any = null
  for (const n of (nodesRes.docs || []) as any[]) {
    try {
      const cls = await listNodeClients(n)
      const c = cls.find((x) => String(x.email) === clientEmail)
      if (c) {
        found = c
        break
      }
    } catch {
      /* 单节点失败继续找 */
    }
  }
  if (!found) {
    return Response.json(
      { ok: false, message: '没找到这个客户端，可能已经迁移或停用，请刷新页面再试' },
      { status: 404 },
    )
  }

  const plan = Number(found.limitIp || 0) >= 8 ? 'advanced' : 'basic'
  try {
    const order: any = await payload.create({
      collection: 'orders',
      data: {
        customer: customer.id,
        plan,
        billing: 'traffic',
        amount: quote.amount,
        days: quote.days,
        trafficGB: quote.trafficGB,
        ipLimit: Number(found.limitIp || 4),
        status: 'pending',
        source: 'customer',
        renewClientEmail: clientEmail,
        note: `续费 ${clientEmail} · ${quote.packLabel} × ${quote.months} 个月`,
      },
      overrideAccess: true,
    })
    return Response.json({
      ok: true,
      orderNo: order.orderNo,
      amount: order.amount,
      days: quote.days,
      trafficGB: quote.trafficGB,
    })
  } catch (e: any) {
    return Response.json({ ok: false, message: `下单失败：${e?.message || '未知错误'}` }, { status: 500 })
  }
}
