import { getPayload } from 'payload'

import config from '@/payload.config'

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user || user.collection !== 'customers') {
    return Response.json({ error: '请先登录' }, { status: 401 })
  }

  const data = await request.json().catch(() => ({}))
  const ticketId = data.ticketId
  const body = String(data.body || '').trim()

  if (!ticketId || !body) {
    return Response.json({ error: '缺少工单或内容' }, { status: 400 })
  }

  let ticket: any = null
  try {
    ticket = await payload.findByID({
      collection: 'tickets',
      id: ticketId,
      overrideAccess: true,
      depth: 0,
    })
  } catch {
    ticket = null
  }

  if (!ticket || String(ticket.customer) !== String(user.id)) {
    return Response.json({ error: '工单不存在' }, { status: 404 })
  }

  if (ticket.status === 'closed') {
    return Response.json({ error: '工单已关闭' }, { status: 400 })
  }

  const messages = Array.isArray(ticket.messages) ? ticket.messages : []

  await payload.update({
    collection: 'tickets',
    id: ticketId,
    overrideAccess: true,
    data: {
      messages: [
        ...messages,
        {
          author: (user as any).name || user.email,
          isStaff: false,
          body,
          createdAt: new Date().toISOString(),
        },
      ],
    } as any,
  })

  return Response.json({ ok: true })
}
