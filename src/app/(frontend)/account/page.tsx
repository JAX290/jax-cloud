import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import LogoutButton from '@/components/LogoutButton'
import TrialButton from '@/components/TrialButton'
import config from '@/payload.config'
import CopyButton from '@/components/CopyButton'
import RenewButton from '@/components/RenewButton'
import ResetSubButton from '@/components/ResetSubButton'
import SubQr from '@/components/SubQr'
import TrafficChart from '@/components/TrafficChart'
import UpgradeButton from '@/components/UpgradeButton'
import { listNodeClients } from '@/lib/node-client'
import { cachedClientGroupsForCustomer, readNodeCache } from '@/lib/node-cache'
import { daysToExpiry, trafficRatio } from '@/lib/renew'
import { TRIAL_GB, TRIAL_HOURS, trialSubUrl } from '@/lib/trial'
import { readTrafficSeries } from '@/lib/traffic'
import { resolveSubscription } from '@/lib/sub'
import {
  pickCustomerClients,
  clientUsedBytes,
  getSubConfig,
  buildSubLink,
  panelHost,
} from '@/lib/panel'

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

const ORDER_PLAN_LABEL: Record<string, string> = {
  basic: '基础版',
  advanced: '进阶版',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '待支付',
  paid: '已收款',
  active: '已开通',
  expired: '已取消',
  failed: '开通失败',
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

function formatBytes(value?: number) {
  const v = Number(value || 0)
  if (v <= 0) return '0'
  const gb = v / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)}G`
  const mb = v / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(0)}M`
  return `${Math.max(1, Math.round(v / 1024))}K`
}

function formatExpiry(ts?: number) {
  const v = Number(ts || 0)
  if (!v) return '长期'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '长期'
  return d.toLocaleDateString('zh-CN')
}

export default async function AccountPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user || user.collection !== 'customers') {
    redirect('/login')
  }

  const customer = user as any

  // 联系方式（WhatsApp 入口用）
  let siteSettings: any = null
  try {
    siteSettings = await payload.findGlobal({ slug: 'site-settings' })
  } catch {
    siteSettings = null
  }
  const waLink = String(siteSettings?.whatsapp || '')

  // 体验倒计时（服务端算一次，够页面展示用）
  const trialLeftMinutes = customer.trialExpiresAt
    ? Math.max(0, Math.ceil((Date.parse(customer.trialExpiresAt) - Date.now()) / 60000))
    : 0
  const trialLeftText =
    trialLeftMinutes >= 60
      ? `${Math.floor(trialLeftMinutes / 60)} 小时 ${trialLeftMinutes % 60} 分钟`
      : `${trialLeftMinutes} 分钟`

  // 聚合所有节点：在线节点实时取客户端，离线节点用上次健康检查的缓存兜底
  const nodesRes: any = await payload
    .find({
      collection: 'nodes',
      limit: 100,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [] }))

  const allNodes = (nodesRes.docs || []) as any[]
  const onlineNodes = allNodes.filter((n) => n.status === 'online')
  const offlineNodes = allNodes.filter((n) => n.status !== 'online')

  const allPanelClients: any[] = []
  for (const n of onlineNodes) {
    try {
      const cls = await listNodeClients(n)
      allPanelClients.push(...cls)
    } catch {
      /* 单节点失败不影响其他 */
    }
  }

  // 节点挂掉的客户：用缓存告诉客户「你这几个环境所在的节点在维护」
  const nodeCache = readNodeCache()
  const offlineGroups = cachedClientGroupsForCustomer(
    nodeCache,
    offlineNodes.map((n) => n.id),
    Number(customer.customerNo || 0),
  )

  const ordersRes: any = await payload
    .find({
      collection: 'orders',
      where: { customer: { equals: customer.id }, billing: { equals: 'deploy' } },
      sort: '-createdAt',
      limit: 20,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [] }))
  const deployOrders = (ordersRes.docs || []) as any[]

  const [services, tickets, subConfig] = await Promise.all([
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
    getSubConfig(),
  ])

  const rawClients = pickCustomerClients(allPanelClients, Number(customer.customerNo || 0))
  // 迁移过程中新旧节点可能同时存在同名客户端，按 email 去重
  const seenEmails = new Set<string>()
  const panelClients = rawClients.filter((c) => {
    const key = String(c.email || '')
    if (!key || seenEmails.has(key)) return false
    seenEmails.add(key)
    return true
  })
  const host = panelHost()

  // 近一年流量时序（折线图前端可按日/周/月聚合）
  const trafficSeriesMap = new Map<number, Array<{ day: string; used: number }>>()
  for (const c of panelClients) {
    trafficSeriesMap.set(c.id, readTrafficSeries(String(c.email || ''), 366))
  }

  // 预取每个客户端的 vless 单条链接（供「从剪贴板导入」用）
  const vlessMap = new Map<number, string>()
  await Promise.all(
    panelClients.map(async (c) => {
      if (!c.subId) return
      try {
        const resolved = await resolveSubscription(String(c.subId))
        const link = resolved?.links?.[0]
        if (link) vlessMap.set(c.id, link)
      } catch {
        /* 忽略单个失败 */
      }
    }),
  )

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
            <Link className="btn btn-primary" href="/download">
              下载客户端
            </Link>
            <Link className="btn btn-ghost" href="/account/tickets/new">
              提交工单
            </Link>
            {waLink ? (
              <a className="btn btn-ghost" href={waLink} target="_blank" rel="noreferrer">
                WhatsApp 联系
              </a>
            ) : null}
            <LogoutButton />
          </div>
        </div>

        <div className="account-stack">
          <section className="panel">
            <div className="panel-head">
              <h2>1 小时体验</h2>
              <span className="muted">
                每账号限一次 · {TRIAL_HOURS} 小时 · {TRIAL_GB}G
              </span>
            </div>

            {!customer.trialUsed ? (
              <>
                <p className="muted" style={{ marginTop: 0 }}>
                  先试再买：开一个 {TRIAL_HOURS} 小时、{TRIAL_GB}G 流量的测试环境，到期自动停用，不用付款。
                </p>
                <TrialButton />
              </>
            ) : customer.trialStopped ? (
              <p className="muted" style={{ margin: 0 }}>
                体验已结束。想继续用，可以在下面的「我的订阅」里选套餐，或者直接找客服。
              </p>
            ) : (
              <>
                <p className="muted" style={{ marginTop: 0 }}>
                  体验中，还剩 <b style={{ color: 'var(--cyan)' }}>{trialLeftText}</b>，到期会自动停用。
                </p>
                {customer.trialSubId ? (
                  <p style={{ margin: 0, fontSize: 13 }}>
                    订阅链接：
                    <a href={trialSubUrl(customer.trialSubId)}>{trialSubUrl(customer.trialSubId)}</a>
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>我的订阅</h2>
              <span className="muted">实时数据 · 来自节点面板</span>
            </div>

            {offlineGroups.length ? (
              <div className="account-alert">
                <b>节点维护中</b>
                <span>
                  {offlineGroups
                    .map(
                      (g) =>
                        `${g.nodeName} 上的 ${g.clients.map((c) => c.email).join('、')}`,
                    )
                    .join('；')}
                  {' '}
                  暂时连不上，我们已经在处理，恢复后会第一时间通知你。着急的话可以先提个工单。
                </span>
              </div>
            ) : null}

            {panelClients.length ? (
              <div className="env-grid">
                {panelClients.map((c) => {
                  const used = clientUsedBytes(c)
                  const limit = Number(c.totalGB || 0)
                  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
                  const left = daysToExpiry(c.expiryTime)

                  const isAdvanced = Number(c.limitIp || 0) >= 8
                  const planLabel = isAdvanced ? '进阶版' : '入门版'
                  // 中央订阅服务：链接固定，换节点客户无感
                  const subLink = c.subId ? `https://sub.jax.markets/sub/${c.subId}` : ''

                  return (
                    <article className="env-card" key={c.id}>
                      <div className="env-top">
                        <div>
                          <div className="env-id">{c.email}</div>
                          <div className="env-sub">
                            {planLabel} · {isAdvanced ? '专线' : '共享线路'} · 1 个 IP · 最多{' '}
                            {c.limitIp ? `${c.limitIp} 台设备` : '不限设备'}
                          </div>
                        </div>
                      </div>

                      <div className="env-bar">
                        <div className="env-bar-head">
                          <span>流量已用</span>
                          <b>
                            {formatBytes(used)}
                            {limit > 0 ? ` / ${formatBytes(limit)}` : ' / 不限'}
                          </b>
                        </div>
                        <div className="bar">
                          <i style={{ width: `${limit > 0 ? pct : 0}%` }} />
                        </div>
                      </div>

                      <div className="env-meta">
                        <div>
                          <span>到期</span>
                          <b>{formatExpiry(c.expiryTime)}</b>
                        </div>
                        <div>
                          <span>剩余</span>
                          <b>{left === null ? '长期' : left < 0 ? '已过期' : `${left} 天`}</b>
                        </div>
                        <div>
                          <span>状态</span>
                          <b>{c.enable ? '正常' : '停用'}</b>
                        </div>
                      </div>

                      {(() => {
                        const leftDays = daysToExpiry(c.expiryTime)
                        const ratio = trafficRatio(used, Number(c.totalGB || 0))
                        const hint =
                          leftDays !== null && leftDays < 0
                            ? '已到期，续费后到期日从现在开始算，马上就能用'
                            : leftDays !== null && leftDays <= 7
                              ? `还有 ${leftDays} 天到期，先续上，到期日直接往后顺延`
                              : ratio >= 0.9
                                ? '流量快用完了，续一份新额度接着用'
                                : '提前续费更稳：到期日顺延，配置和链接都不动'
                        return (
                          <div className="env-renew">
                            <span className="env-renew-hint">{hint}</span>
                            <RenewButton
                              clientEmail={String(c.email || '')}
                              customerId={Number(customer.id)}
                              currentExpiry={Number(c.expiryTime || 0)}
                              currentTotalGB={Number(c.totalGB || 0)}
                              usedBytes={used}
                            />
                          </div>
                        )
                      })()}

                      <div className="env-sub-link">
                        <div className="env-sub-label">订阅链接（自动更新）</div>
                        {subLink ? (
                          <>
                            <div className="env-sub-url">{subLink}</div>
                            <div className="env-sub-btns">
                              <CopyButton value={subLink} label="复制订阅" />
                              <ResetSubButton clientEmail={String(c.email || '')} />
                            </div>
                            <div className="env-hint">
                              用法：客户端 →「订阅分组」→ 添加订阅 → 粘贴链接 → 更新。以后换节点自动同步。
                            </div>
                          </>
                        ) : (
                          <div className="env-sub-url muted">订阅服务未开启，请联系客服</div>
                        )}
                      </div>

                      {vlessMap.get(c.id) ? (
                        <div className="env-vless">
                          <div className="env-sub-label">节点链接（快速导入）</div>
                          <div className="env-vless-url">{vlessMap.get(c.id)}</div>
                          <CopyButton value={vlessMap.get(c.id)!} label="复制节点" />
                          <details className="env-qr">
                            <summary>扫码导入节点</summary>
                            <SubQr value={vlessMap.get(c.id)!} label="手机扫码直接导入" />
                          </details>
                          <div className="env-hint">
                            用法：复制后，在客户端节点列表右键（手机点右上角＋）→「从剪贴板导入」，一步到位。不自动更新。
                          </div>
                        </div>
                      ) : null}

                      <details className="env-traffic">
                        <summary>流量统计（日 / 周 / 月）</summary>
                        <TrafficChart
                          series={trafficSeriesMap.get(c.id) || []}
                          totalUsed={used}
                          totalGB={limit}
                        />
                      </details>

                      {!isAdvanced ? (
                        <div className="env-upgrade">
                          <span>升级进阶版 · 补 ¥100 · 增至 8 台设备</span>
                          <UpgradeButton
                            clientEmail={String(c.email || '')}
                            customerId={Number(customer.id)}
                          />
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="empty">
                还没有开通网络环境。联系客服开通后，这里会显示 IP、流量和在线状态。
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>我的部署</h2>
              <span className="muted">
                部署购买记录 · <Link href="/orders">全部订单 →</Link>
              </span>
            </div>

            {deployOrders.length ? (
              <div className="deploy-list">
                {deployOrders.map((o: any) => (
                  <div className="deploy-item" key={o.id}>
                    <div>
                      <div className="deploy-item-no">{o.orderNo}</div>
                      <div className="deploy-item-meta">
                        {ORDER_PLAN_LABEL[o.plan] || '—'} · {formatDate(o.createdAt)}
                        {o.clientEmail ? ` · 客户端 ${o.clientEmail}` : ' · 未开通'}
                      </div>
                    </div>
                    <div className="deploy-item-right">
                      <b>{money(o.amount)}</b>
                      <span className={`deploy-badge ${o.status}`}>
                        {ORDER_STATUS_LABEL[o.status] || o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">还没有部署记录。购买部署后会显示在这里。</div>
            )}
          </section>

          {false ? (
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
                      </div>
                      <div className="deploy-note">一次部署、长期有效。</div>
                      <div className="deploy-note">
                        订阅服务到期之后，将为您备份数据 30 天；有效期内重新订阅，无需部署费。
                      </div>
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
