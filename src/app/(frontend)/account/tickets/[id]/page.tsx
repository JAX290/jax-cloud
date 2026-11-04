import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import ReplyForm from '@/components/ReplyForm'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  open: '待处理',
  pending: '处理中',
  resolved: '已解决',
  closed: '已关闭',
}

function formatTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { hour12: false })
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user || user.collection !== 'customers') {
    redirect('/login')
  }

  let ticket: any = null
  try {
    ticket = await payload.findByID({
      collection: 'tickets',
      id,
      overrideAccess: false,
      user,
      depth: 0,
    })
  } catch {
    ticket = null
  }

  if (!ticket) {
    notFound()
  }

  const messages = Array.isArray(ticket.messages) ? ticket.messages : []

  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="page-head">
          <div>
            <h1>{ticket.subject}</h1>
            <p>
              <span className={`status ${ticket.status}`}>
                {STATUS_LABEL[ticket.status] || ticket.status}
              </span>{' '}
              · 创建于 {formatTime(ticket.createdAt)}
            </p>
          </div>
          <Link className="btn btn-ghost" href="/account">
            返回
          </Link>
        </div>

        <div className="panel">
          <div className="ticket-thread">
            {messages.map((message: any, index: number) => (
              <div className={`msg ${message.isStaff ? 'staff' : ''}`} key={index}>
                <div className="meta">
                  {message.author || '客户'} · {formatTime(message.createdAt)}
                  {message.isStaff ? ' · 官方' : ''}
                </div>
                <p>{message.body}</p>
              </div>
            ))}
          </div>

          {ticket.status !== 'closed' ? <ReplyForm ticketId={String(ticket.id)} /> : null}
        </div>
      </div>
    </div>
  )
}
