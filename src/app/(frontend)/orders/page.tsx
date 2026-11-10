import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '我的订单 · JAX CLOUD',
}

const PLAN_LABEL: Record<string, string> = {
  basic: '基础版',
  advanced: '进阶版',
}
const BILLING_LABEL: Record<string, string> = {
  deploy: '部署费',
  traffic: '流量费',
  topup: '加油包',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '待支付',
  paid: '已收款',
  active: '已开通',
  expired: '已取消',
  failed: '开通失败',
}

function fmtDate(v?: string) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default async function OrdersPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user || user.collection !== 'customers') {
    redirect('/login')
  }

  const orders = await payload.find({
    collection: 'orders',
    where: { customer: { equals: user.id } },
    sort: '-createdAt',
    limit: 50,
    overrideAccess: true,
  })

  const pending = orders.docs.filter((o: any) => o.status === 'pending')

  return (
    <div className="page staff-page">
      <div className="wrap staff-wrap">
        <div className="staff-head">
          <div>
            <h1>我的订单</h1>
            <p className="staff-sub">
              共 <b>{orders.totalDocs}</b> 笔 · 待支付 <b>{pending.length}</b>
            </p>
          </div>
          <Link className="staff-btn ghost" href="/account">
            账户
          </Link>
        </div>

        {pending.length ? (
          <div className="order-tip">
            待支付的订单，请微信转账给客服并备注订单号，客服确认后会自动开通。
          </div>
        ) : null}

        <div className="staff-list" style={{ marginTop: 16 }}>
          {orders.docs.length ? (
            orders.docs.map((o: any) => {
              const status = String(o.status || 'pending')
              return (
                <article className={`staff-order ${status}`} key={o.id}>
                  <div className="staff-order-top">
                    <div>
                      <div className="staff-order-no">{o.orderNo}</div>
                      <div className="staff-order-who">{fmtDate(o.createdAt)}</div>
                    </div>
                    <span className={`staff-badge ${status}`}>{STATUS_LABEL[status] || status}</span>
                  </div>

                  <div className="staff-order-info">
                    <span>{PLAN_LABEL[o.plan] || o.plan}</span>
                    <span>{BILLING_LABEL[o.billing] || o.billing}</span>
                    <span className="staff-amount">¥{o.amount}</span>
                  </div>

                  <div className="order-desc">
                    {o.days} 天 · {o.trafficGB}G · {o.ipLimit} 台设备
                  </div>

                  {o.note ? <div className="staff-note">备注：{o.note}</div> : null}

                  {status === 'active' ? (
                    <div className="staff-done">已开通 · 客户端 {o.clientEmail || '—'}</div>
                  ) : status === 'pending' ? (
                    <div className="order-actions">
                      <a className="staff-btn primary" href="/#contact">
                        联系客服付款
                      </a>
                    </div>
                  ) : status === 'failed' ? (
                    <div className="order-failed">开通失败，请联系客服处理</div>
                  ) : null}
                </article>
              )
            })
          ) : (
            <div className="staff-empty">还没有订单。回到首页选购套餐后提交即可。</div>
          )}
        </div>
      </div>
    </div>
  )
}
