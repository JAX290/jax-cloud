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

const PLAN_LABEL: Record<string, string> = {
  'deploy-independent': '独享线路',
  'deploy-shared': '共享线路',
  'ops-1c1g': '运维托管 · 1核1G',
  'ops-2c2g': '运维托管 · 2核2G',
  'ops-4c4g': '运维托管 · 4核4G',
  'ops-8c8g': '运维托管 · 8核8G',
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('zh-CN')
}

function daysLeft(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function money(value: number) {
  return `¥${Number(value).toLocaleString('zh-CN')}`
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

  const deployServices = services.docs.filter((service: any) =>
    String(service.plan || '').startsWith('deploy'),
  )
  const monthlyServices = services.docs.filter(
    (service: any) => !String(service.plan || '').startsWith('deploy'),
  )

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

        <div className="account-stack">
          <section className="panel">
            <div className="panel-head">
              <h2>我的订阅</h2>
              <span className="muted">按月服务、到期时间与续费价格</span>
            </div>

            {monthlyServices.length ? (
              <div className="subs-grid">
                {monthlyServices.map((service: any) => {
                  const remaining = daysLeft(service.expiresAt)
                  const isExpired = service.status === 'expired' || (remaining !== null && remaining < 0)
                  const monthly = Number(
                    service.renewalMonthlyPrice ??
                      (service.cycle === 'monthly' ? service.price : 0) ??
                      0,
                  )
                  const annual = monthly > 0 ? Math.round(monthly * 12 * 0.9) : 0
                  const saved = monthly > 0 ? Math.round(monthly * 12 - annual) : 0
                  const contentLines = String(service.subscriptionContent || '')
                    .split('\n')
                    .map((line: string) => line.trim())
                    .filter(Boolean)

                  return (
                    <article className="sub-card" key={service.id}>
                      <div className="sub-top">
                        <div>
                          <div className="sub-type">{PLAN_LABEL[service.plan] || '服务'}</div>
                          <h3>{service.title}</h3>
                          <div className="sub-spec">
                            {service.spec || '—'}
                            {service.startedAt ? ` · 开通于 ${formatDate(service.startedAt)}` : ''}
                          </div>
                        </div>
                        <span className={`status ${isExpired ? 'expired' : service.status}`}>
                          {isExpired ? '已到期' : STATUS_LABEL[service.status] || service.status}
                        </span>
                      </div>

                      <div className="sub-grid">
                        <div>
                          <span>服务到期</span>
                          <b>{formatDate(service.expiresAt)}</b>
                          <em className={remaining !== null && remaining <= 7 ? 'warn' : ''}>
                            {remaining === null
                              ? '长期有效'
                              : remaining < 0
                                ? `已过期 ${Math.abs(remaining)} 天`
                                : `剩余 ${remaining} 天`}
                          </em>
                        </div>
                        <div>
                          <span>续费月价</span>
                          <b>{monthly > 0 ? money(monthly) : '—'}</b>
                          <em>{monthly > 0 ? '/ 月' : '一次性服务'}</em>
                        </div>
                        <div>
                          <span>续费 12 个月</span>
                          <b>{annual > 0 ? money(annual) : '—'}</b>
                          <em>{annual > 0 ? `9 折 · 省 ${money(saved)}` : '无需续费'}</em>
                        </div>
                      </div>

                      {contentLines.length ? (
                        <div className="sub-content">
                          <div className="sub-label">订阅内容</div>
                          <ul>
                            {contentLines.map((line: string, index: number) => (
                              <li key={index}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="sub-foot">
                        <span>
                          {monthly > 0
                            ? '续费 12 个月按 9 折结算，到期前续费可保留当前配置与数据。'
                            : '一次性交付服务，无需续费。'}
                        </span>
                        {monthly > 0 ? (
                          <Link className="btn btn-ghost" href="/account/tickets/new?subject=申请续费">
                            申请续费
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="empty">还没有按月订阅。联系客服开通后会显示在这里。</div>
            )}
          </section>

          {deployServices.length ? (
            <section className="panel">
              <div className="panel-head">
                <h2>部署线路</h2>
                <span className="muted">一次性付费，已部署完成，无需续费</span>
              </div>

              {deployServices.map((service: any) => {
                const shared = service.plan === 'deploy-shared'
                return (
                  <div className="deploy-row" key={service.id}>
                    <div className="deploy-main">
                      <div className="deploy-line">
                        <b>{shared ? '共享线路已部署' : '独享线路已部署'}</b>
                        <span className="status active">正常</span>
                      </div>
                      <div className="deploy-spec">
                        {service.spec || '—'}
                        {service.startedAt ? ` · 开通于 ${formatDate(service.startedAt)}` : ''}
                        {service.serverIp ? ` · ${service.serverIp}` : ''}
                      </div>
                      <div className="deploy-note">部署费用已一次性支付，此服务不再产生续费。</div>
                    </div>

                    {shared ? (
                      <div className="upgrade">
                        <div className="upgrade-head">
                          <span>升级独享线路</span>
                          <b>+¥100</b>
                        </div>
                        <ul>
                          <li>更多流量</li>
                          <li>纯独立服务器</li>
                          <li>更高设备上限</li>
                        </ul>
                        <Link
                          className="btn btn-primary"
                          href="/account/tickets/new?subject=升级独享线路"
                        >
                          申请升级
                        </Link>
                      </div>
                    ) : (
                      <div className="deploy-ok">已是独享线路</div>
                    )}
                  </div>
                )
              })}
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-head">
              <h2>我的工单</h2>
              <span className="muted">遇到问题可以提交工单</span>
            </div>
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
