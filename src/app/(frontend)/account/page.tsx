import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import LogoutButton from '@/components/LogoutButton'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  active: '正常',
  suspended: '暂停',
  expired: '已到期',
  open: '待处理',
  pending: '处理中',
  resolved: '已解决',
  closed: '已关闭',
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('zh-CN')
}

export default async function AccountPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user || user.collection !== 'customers') {
    redirect('/login')
  }

  const customer = user as any

  const [services, tickets] = await Promise.all([
    payload.find({
      collection: 'services',
      where: { customer: { equals: customer.id } },
      overrideAccess: false,
      user,
      limit: 50,
      sort: '-createdAt',
    }),
    payload.find({
      collection: 'tickets',
      where: { customer: { equals: customer.id } },
      overrideAccess: false,
      user,
      limit: 50,
      sort: '-updatedAt',
    }),
  ])

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>我的账户</h1>
            <p>
              {customer.name ? `${customer.name} · ` : ''}
              客户 ID：<b>#{customer.customerNo ?? '—'}</b> · 邮箱 {customer.email}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href="/account/tickets/new">
              提交工单
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="account-grid">
          <section className="panel">
            <h2>我的服务</h2>
            {services.docs.length ? (
              services.docs.map((service: any) => (
                <div className="row" key={service.id}>
                  <div>
                    <div className="title">{service.title}</div>
                    <div className="sub">
                      {service.spec || '—'} · 到期 {formatDate(service.expiresAt)}
                    </div>
                  </div>
                  <span className={`status ${service.status}`}>
                    {STATUS_LABEL[service.status] || service.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty">还没有服务。联系客服开通后会显示在这里。</div>
            )}
          </section>

          <section className="panel">
            <h2>我的工单</h2>
            {tickets.docs.length ? (
              tickets.docs.map((ticket: any) => (
                <Link className="row" href={`/account/tickets/${ticket.id}`} key={ticket.id}>
                  <div>
                    <div className="title">{ticket.subject}</div>
                    <div className="sub">
                      更新于 {formatDate(ticket.updatedAt)} · {ticket.messages?.length || 0} 条消息
                    </div>
                  </div>
                  <span className={`status ${ticket.status}`}>
                    {STATUS_LABEL[ticket.status] || ticket.status}
                  </span>
                </Link>
              ))
            ) : (
              <div className="empty">还没有工单。遇到问题可以提交一个。</div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
