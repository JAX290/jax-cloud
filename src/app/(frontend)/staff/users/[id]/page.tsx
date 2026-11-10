import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { listNodeClients } from '@/lib/node-client'
import { clientIpFromHeaders, isTailscaleIp } from '@/lib/tailscale'

import MigrateButton from '@/components/MigrateButton'

export const dynamic = 'force-dynamic'

const PLAN_LABEL: Record<string, string> = { basic: '基础版', advanced: '进阶版' }
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

export default async function StaffUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const headers = await getHeaders()
  if (!isTailscaleIp(clientIpFromHeaders(headers))) {
    return (
      <div className="page">
        <div className="wrap staff-wrap">
          <div className="staff-deny">
            <h1>仅限内网访问</h1>
          </div>
        </div>
      </div>
    )
  }

  const { id } = await params
  const payload = await getPayload({ config })

  let customer: any = null
  try {
    customer = await payload.findByID({
      collection: 'customers',
      id: Number(id),
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    customer = null
  }
  if (!customer) notFound()

  const [nodes, orders] = await Promise.all([
    payload.find({ collection: 'nodes', limit: 50, overrideAccess: true }),
    payload.find({
      collection: 'orders',
      where: { customer: { equals: customer.id } },
      sort: '-createdAt',
      limit: 50,
      overrideAccess: true,
    }),
  ])

  // 找该客户在各节点上的客户端
  const clientRows: Array<{ email: string; node: string; limitIp: number; used: number; total: number }> = []
  for (const n of (nodes.docs || []) as any[]) {
    try {
      const cls = await listNodeClients(n)
      for (const c of cls) {
        if (String(c.email || '').startsWith(`${customer.customerNo}-`)) {
          const used = Number(c.traffic?.up || 0) + Number(c.traffic?.down || 0)
          clientRows.push({
            email: String(c.email),
            node: n.name || n.ip,
            limitIp: Number(c.limitIp || 0),
            used,
            total: Number(c.totalGB || 0),
          })
        }
      }
    } catch {
      /* ignore */
    }
  }

  function gb(v: number) {
    if (!v) return '0'
    const g = v / 1024 / 1024 / 1024
    return g >= 1 ? `${g.toFixed(1)}G` : `${(v / 1024 / 1024).toFixed(0)}M`
  }

  return (
    <div className="page staff-page">
      <div className="wrap staff-wrap">
        <div className="staff-head">
          <div>
            <h1>{customer.name || '未填写'}</h1>
            <p className="staff-sub">
              客户编号 <b>#{customer.customerNo}</b> · {customer.email}
            </p>
          </div>
          <Link className="staff-btn ghost" href="/staff?tab=users">
            返回
          </Link>
        </div>

        <section className="staff-section">
          <h2 className="staff-h2">基本信息</h2>
          <div className="su-info">
            <div>
              <span>称呼</span>
              <b>{customer.name || '—'}</b>
            </div>
            <div>
              <span>编号</span>
              <b>#{customer.customerNo}</b>
            </div>
            <div>
              <span>邮箱</span>
              <b>{customer.email}</b>
            </div>
            <div>
              <span>手机</span>
              <b>{customer.phone || '—'}</b>
            </div>
            <div>
              <span>微信</span>
              <b>{customer.wechat || '—'}</b>
            </div>
            <div>
              <span>注册于</span>
              <b>{fmtDate(customer.createdAt)}</b>
            </div>
          </div>
          <div className="staff-actions">
            <a
              className="staff-btn ghost"
              href={`/admin/collections/customers/${customer.id}`}
              target="_blank"
              rel="noreferrer"
            >
              在后台编辑
            </a>
          </div>
        </section>

        <section className="staff-section">
          <h2 className="staff-h2">订阅（{clientRows.length}）</h2>
          {clientRows.length ? (
            <div className="staff-list">
              {clientRows.map((c) => (
                <div className="staff-order" key={c.email}>
                  <div className="staff-order-top">
                    <div>
                      <div className="staff-order-no">{c.email}</div>
                      <div className="staff-order-who">
                        节点：{c.node} · 最多 {c.limitIp} 台设备
                      </div>
                    </div>
                    <span className="staff-badge active">正常</span>
                  </div>
                  <div className="staff-node-rows">
                    <div>
                      <span>流量已用</span>
                      <b>
                        {gb(c.used)} / {c.total ? gb(c.total) : '不限'}
                      </b>
                    </div>
                  </div>
                  <div className="staff-actions">
                    <MigrateButton
                      clientEmail={c.email}
                      currentNodeName={c.node}
                      nodes={(nodes.docs as any[]).map((n: any) => ({
                        id: n.id,
                        name: n.name,
                        ip: n.ip,
                        region: n.region,
                      }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="staff-empty">还没有订阅</div>
          )}
        </section>

        <section className="staff-section">
          <h2 className="staff-h2">订单（{orders.totalDocs}）</h2>
          {orders.docs.length ? (
            <div className="staff-list">
              {(orders.docs as any[]).map((o) => (
                <div className="staff-order" key={o.id}>
                  <div className="staff-order-top">
                    <div>
                      <div className="staff-order-no">{o.orderNo}</div>
                      <div className="staff-order-who">
                        {fmtDate(o.createdAt)} · {PLAN_LABEL[o.plan] || o.plan}
                      </div>
                    </div>
                    <span className={`staff-badge ${o.status}`}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                  <div className="staff-order-info">
                    <span>{o.billing === 'deploy' ? '部署' : o.billing === 'traffic' ? '流量' : o.billing === 'upgrade' ? '升级' : o.billing}</span>
                    <span>¥{o.amount}</span>
                    {o.clientEmail ? <span>{o.clientEmail}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="staff-empty">还没有订单</div>
          )}
        </section>
      </div>
    </div>
  )
}
