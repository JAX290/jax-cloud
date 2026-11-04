import { getPayload } from 'payload'

import config from '@/payload.config'

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user || user.collection !== 'customers') {
    return Response.json({ error: '请先登录' }, { status: 401 })
  }

  const data = await request.json().catch(() => ({}))
  const subject = String(data.subject || '').trim()
  const body = String(data.body || '').trim()

  if (!subject || !body) {
    return Response.json({ error: '标题和问题描述不能为空' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const ticket = await payload.create({
    collection: 'tickets',
    overrideAccess: true,
    data: {
      subject,
      customer: user.id,
      category: data.category || 'ops',
      priority: data.priority || 'normal',
      status: 'open',
      messages: [
        {
          author: (user as any).name || user.email,
          isStaff: false,
          body,
          createdAt: now,
        },
      ],
    } as any,
  })

  return Response.json({ ok: true, id: ticket.id })
}
