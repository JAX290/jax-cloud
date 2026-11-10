import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { listNodeClients } from '@/lib/node-client'
import { clientIpFromHeaders, isTailscaleIp } from '@/lib/tailscale'

import NodesPanel from './NodesPanel'
import OrderCard, { type ClientInfo } from './OrderCard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '工作台 · JAX CLOUD',
}

type Tab = 'orders' | 'users' | 'nodes'

function fmtDate(v?: string) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const headers = await getHeaders()
  const ip = clientIpFromHeaders(headers)

  if (!isTailscaleIp(ip)) {
    return (
      <div className="page">
        <div className="wrap staff-wrap">
          <div className="staff-deny">
            <h1>仅限内网访问</h1>
            <p>工作台只能通过 Tailscale 访问。请先连接 Tailscale 再打开这个地址。</p>
          </div>
        </div>
      </div>
    )
  }

  const { tab: rawTab } = await searchParams
  const tab: Tab = rawTab === 'users' || rawTab === 'nodes' ? rawTab : 'orders'

  const payload = await getPayload({ config })

  const [pending, done, nodes, customers] = await Promise.all([
    payload.find({
      collection: 'orders',
      where: { status: { equals: 'pending' } },
      sort: '-createdAt',
      limit: 50,
      depth: 2,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'orders',
      where: { status: { in: ['paid', 'active', 'failed', 'expired'] } },
      sort: '-updatedAt',
      limit: 20,
      depth: 2,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'nodes',
      sort: 'id',
      limit: 50,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'customers',
      sort: '-createdAt',
      limit: 200,
      overrideAccess: true,
    }),
  ])

  // 客户端 email → { 节点名, 到期, 流量... }，订单卡片要显示客户端的实时状态
  const clientInfoMap: Record<string, ClientInfo> = {}
  for (const n of (nodes.docs || []) as any[]) {
    try {
      const cls = await listNodeClients(n)
      for (const c of cls) {
        const key = String(c.email || '')
        if (!key) continue
        clientInfoMap[key] = {
          node: n.name || n.ip,
          expiryTime: Number(c.expiryTime || 0),
          totalGB: Number(c.totalGB || 0),
          used: Number(c.traffic?.up || 0) + Number(c.traffic?.down || 0),
          enable: c.enable !== false,
          limitIp: Number(c.limitIp || 0),
          lastOnline: Number(c.traffic?.lastOnline || 0),
        }
      }
    } catch {
      /* ignore */
    }
  }

  // ---- 经营概览数据 ----
  let statsOrders: any[] = []
  try {
    const res: any = await payload.find({
      collection: 'orders',
      where: { status: { equals: 'active' } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    statsOrders = (res.docs || []) as any[]
  } catch {
    statsOrders = []
  }
  const now = Date.now()
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  let todayOrders = 0
  let todayRevenue = 0
  let monthRevenue = 0
  for (const o of statsOrders) {
    const t = new Date(o.createdAt).getTime()
    if (!Number.isFinite(t)) continue
    const amount = Number(o.amount || 0)
    if (t >= monthStart) monthRevenue += amount
    if (t >= todayStart) {
      todayOrders += 1
      todayRevenue += amount
    }
  }
  const allEmails = Object.keys(clientInfoMap)
  // 只统计「真的有客户端挂着的客户」（按客户编号前缀匹配，忽略节点上非本系统的客户端）
  const customersWithClients = ((customers.docs || []) as any[]).filter((c) =>
    allEmails.some((e) => String(e).startsWith(`${c.customerNo}-`)),
  ).length
  let expiring7 = 0
  let expiredClients = 0
  for (const e of allEmails) {
    const info = clientInfoMap[e]
    if (!info?.expiryTime) continue
    const left = Math.ceil((info.expiryTime - now) / 86400000)
    if (left < 0) expiredClients += 1
    else if (left <= 7) expiring7 += 1
  }

  return (
    <div className="page staff-page">
      <div className="wrap staff-wrap">
        <div className="staff-head">
          <div>
            <h1>工作台</h1>
            <p className="staff-sub">
              待确认 <b>{pending.totalDocs}</b> · 客户 <b>{customers.totalDocs}</b> · 节点{' '}
              <b>{nodes.totalDocs}</b>
            </p>
          </div>
          <a className="staff-btn ghost" href="/admin">
            后台
          </a>
        </div>

        <div className="staff-stats">
          <div>
            <span>今日订单</span>
            <b>{todayOrders}</b>
            <em>¥{todayRevenue.toLocaleString('zh-CN')}</em>
          </div>
          <div>
            <span>本月收入</span>
            <b>¥{monthRevenue.toLocaleString('zh-CN')}</b>
            <em>已开通订单</em>
          </div>
          <div>
            <span>在线客户</span>
            <b>{customersWithClients}</b>
            <em>共 {customers.totalDocs} 个客户</em>
          </div>
          <div>
            <span>7 天内到期</span>
            <b className={expiring7 ? 'warn' : ''}>{expiring7}</b>
            <em>已过期 {expiredClients} 个</em>
          </div>
        </div>

        <div className="staff-tabs">
          <Link className={tab === 'orders' ? 'on' : ''} href="/staff?tab=orders">
            订单
          </Link>
          <Link className={tab === 'users' ? 'on' : ''} href="/staff?tab=users">
            客户
          </Link>
          <Link className={tab === 'nodes' ? 'on' : ''} href="/staff?tab=nodes">
            VPS
          </Link>
        </div>

        {tab === 'nodes' ? (
          <NodesPanel
            nodes={nodes.docs as any[]}
            panelHost={process.env.PANEL_HOST || '100.124.251.8'}
          />
        ) : tab === 'users' ? (
          <section className="staff-section">
            <h2 className="staff-h2">客户列表</h2>
            {customers.docs.length ? (
              <div className="staff-list">
                {(customers.docs as any[]).map((c) => {
                  const myClients = Object.keys(clientInfoMap).filter((email) =>
                    email.startsWith(`${c.customerNo}-`),
                  )
                  return (
                    <Link className="staff-user-row" href={`/staff/users/${c.id}`} key={c.id}>
                      <div>
                        <div className="staff-user-name">
                          {c.name || '未填写'} <span>#{c.customerNo}</span>
                        </div>
                        <div className="staff-user-meta">
                          {c.email} · 注册于 {fmtDate(c.createdAt)}
                        </div>
                      </div>
                      <div className="staff-user-right">
                        <span className="staff-user-count">{myClients.length} 个订阅</span>
                        <span className="staff-user-go">查看 →</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="staff-empty">还没有客户</div>
            )}
          </section>
        ) : (
          <>
            <section className="staff-section">
              <h2 className="staff-h2">待确认</h2>
              {pending.docs.length ? (
                <div className="staff-list">
                  {pending.docs.map((o: any) => (
                    <OrderCard key={o.id} order={o} clientInfoMap={clientInfoMap} />
                  ))}
                </div>
              ) : (
                <div className="staff-empty">没有待确认的订单</div>
              )}
            </section>

            <section className="staff-section">
              <h2 className="staff-h2">最近处理</h2>
              {done.docs.length ? (
                <div className="staff-list">
                  {done.docs.map((o: any) => (
                    <OrderCard key={o.id} order={o} clientInfoMap={clientInfoMap} />
                  ))}
                </div>
              ) : (
                <div className="staff-empty">还没有处理记录</div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
