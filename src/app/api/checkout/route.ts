import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

const BILLING = ['deploy', 'traffic', 'topup'] as const

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user || user.collection !== 'customers') {
    return Response.json({ message: '请先登录' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items : []

  if (!items.length) {
    return Response.json({ message: '购物车是空的' }, { status: 400 })
  }
  if (items.length > 10) {
    return Response.json({ message: '一次最多提交 10 项，请分批下单' }, { status: 400 })
  }

  const created: any[] = []
  try {
    for (const item of items) {
      const billing = BILLING.includes(item?.type) ? item.type : 'deploy'
      const order = await payload.create({
        collection: 'orders',
        data: {
          customer: user.id,
          plan: item?.plan === 'advanced' ? 'advanced' : 'basic',
          billing,
          amount: Math.max(0, Number(item?.amount) || 0),
          days: Math.max(1, Number(item?.days) || 30),
          trafficGB: Math.max(0, Number(item?.trafficGB) || 0),
          ipLimit: Math.max(1, Number(item?.ipLimit) || 4),
          status: 'pending',
          source: 'customer',
          note: String(item?.name || '').slice(0, 200),
        },
        overrideAccess: true,
      })
      created.push(order)
    }
  } catch (e: any) {
    return Response.json(
      { message: `下单失败：${e?.message || '未知错误'}` },
      { status: 500 },
    )
  }

  return Response.json({
    ok: true,
    orders: created.map((o) => ({ id: o.id, orderNo: o.orderNo, amount: o.amount })),
  })
}
