'use client'

import { useState } from 'react'

import { cancelOrder, confirmOrder, retryOrder } from './actions'

const PLAN_LABEL: Record<string, string> = {
  basic: '基础版',
  advanced: '进阶版',
}
const BILLING_LABEL: Record<string, string> = {
  deploy: '部署费',
  traffic: '流量费',
  topup: '加油包',
  upgrade: '升级差价',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '待确认',
  paid: '已收款',
  active: '已开通',
  expired: '已取消',
  failed: '开通失败',
}
const SOURCE_LABEL: Record<string, string> = {
  customer: '客户自助下单',
  staff: '客服后台下单',
}

export type ClientInfo = {
  node: string
  expiryTime: number
  totalGB: number
  used: number
  enable: boolean
  limitIp: number
  lastOnline: number
}

function money(v: any) {
  return `¥${Number(v || 0).toLocaleString('zh-CN')}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** 2026/11/8 10:58 */
function fmtDateTime(v?: string | number) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtBytes(v: number) {
  const n = Number(v || 0)
  if (n <= 0) return '0'
  const gb = n / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)}G`
  const mb = n / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(0)}M`
  return `${Math.max(1, Math.round(n / 1024))}K`
}

function daysLeft(expiryTime: number) {
  const v = Number(expiryTime || 0)
  if (!v) return null
  return Math.ceil((v - Date.now()) / (24 * 60 * 60 * 1000))
}

/**
 * 订单卡片：待确认 → 确认收款 / 取消；失败 → 重试。
 * 卡片里把时间线（下单/收款/开通/到期）、来源、客户端状态都摊开，客服一眼能对账。
 */
export default function OrderCard({
  order,
  clientInfoMap = {},
}: {
  order: any
  clientInfoMap?: Record<string, ClientInfo>
}) {
  const [editing, setEditing] = useState(false)

  const customer = order.customer || {}
  const name = customer.name || customer.email || '—'
  const cno = customer.customerNo || '—'
  const status = String(order.status || 'pending')

  const info: ClientInfo | undefined = order.clientEmail
    ? clientInfoMap[String(order.clientEmail)]
    : undefined
  const left = info ? daysLeft(info.expiryTime) : null
  const targetEmail = order.clientEmail || order.renewClientEmail || order.upgradeClientEmail || ''
  const isRenew = Boolean(order.renewClientEmail)
  const isUpgrade = Boolean(order.upgradeClientEmail)

  return (
    <article className={`staff-order ${status}`}>
      <div className="staff-order-top">
        <div>
          <div className="staff-order-no">{order.orderNo}</div>
          <div className="staff-order-who">
            {name} · #{cno}
            <span className={`order-who-tag ${order.source === 'staff' ? 'staff' : ''}`}>
              {SOURCE_LABEL[String(order.source || '')] || '来源未记录'}
            </span>
          </div>
          {customer.wechat || customer.phone || customer.email ? (
            <div className="order-contact">
              {customer.wechat ? `微信 ${customer.wechat}` : ''}
              {customer.wechat && (customer.phone || customer.email) ? ' · ' : ''}
              {customer.phone ? `手机 ${customer.phone}` : ''}
              {(customer.wechat || customer.phone) && customer.email ? ' · ' : ''}
              {customer.email || ''}
            </div>
          ) : null}
        </div>
        <span className={`staff-badge ${status}`}>{STATUS_LABEL[status] || status}</span>
      </div>

      <div className="staff-order-info">
        <span>{PLAN_LABEL[order.plan] || order.plan}</span>
        <span>{BILLING_LABEL[order.billing] || order.billing}</span>
        <span>
          {order.days} 天 · {order.trafficGB}G · {order.ipLimit} 台
        </span>
        <span className="staff-amount">{money(order.amount)}</span>
      </div>

      <div className="order-meta">
        <div>
          <span>下单时间</span>
          <b>{fmtDateTime(order.createdAt)}</b>
        </div>
        <div>
          <span>收款时间</span>
          <b className={order.paidAt ? '' : 'muted'}>{fmtDateTime(order.paidAt)}</b>
        </div>
        <div>
          <span>开通时间</span>
          <b className={order.provisionedAt ? '' : 'muted'}>{fmtDateTime(order.provisionedAt)}</b>
        </div>
        <div>
          <span>流量到期</span>
          {info && info.expiryTime ? (
            <b className={left !== null && left < 0 ? 'warn' : ''}>
              {fmtDateTime(info.expiryTime)}
              {left !== null ? `（${left < 0 ? '已过期' : `剩 ${left} 天`}）` : ''}
            </b>
          ) : status === 'pending' ? (
            <b className="muted">开通后 {order.days} 天</b>
          ) : (
            <b className="muted">—</b>
          )}
        </div>
        <div>
          <span>流量已用</span>
          {info ? (
            <b>
              {fmtBytes(info.used)} / {info.totalGB ? fmtBytes(info.totalGB) : '不限'}
              {info.totalGB
                ? `（${Math.min(100, Math.round((info.used / info.totalGB) * 100))}%）`
                : ''}
            </b>
          ) : (
            <b className="muted">{order.trafficGB}G 额度</b>
          )}
        </div>
        <div>
          <span>设备上限</span>
          <b>{order.ipLimit} 台</b>
        </div>
        <div>
          <span>最近在线</span>
          <b className={info?.lastOnline ? '' : 'muted'}>
            {info?.lastOnline ? fmtDateTime(info.lastOnline) : '—'}
          </b>
        </div>
        <div>
          <span>确认/操作人</span>
          <b>{order.operator || '—'}</b>
        </div>
        <div>
          <span>当前节点</span>
          <b>{info?.node || (status === 'active' ? '查不到客户端' : '—')}</b>
        </div>
      </div>

      {targetEmail ? (
        <div className="order-target">
          目标客户端 <b>{targetEmail}</b>
          {isRenew ? ' · 续费（到期顺延 + 流量累加）' : isUpgrade ? ' · 升级设备上限' : ''}
        </div>
      ) : null}

      {order.note ? <div className="staff-note">备注：{order.note}</div> : null}

      {Array.isArray(order.changeLog) && order.changeLog.length ? (
        <div className="order-log">
          {order.changeLog.slice(-3).map((l: any, i: number) => (
            <div key={i}>
              {fmtDateTime(l.at)} {l.by ? `${l.by} ` : ''}
              {l.detail || ''}
              {l.reason ? `（${l.reason}）` : ''}
            </div>
          ))}
        </div>
      ) : null}

      {status === 'active' ? (
        <div className="staff-done">
          已开通 · 客户端 {order.clientEmail || '—'}
          {info && !info.enable ? ' · 已停用' : ''}
        </div>
      ) : status === 'failed' ? (
        <form action={retryOrder}>
          <input type="hidden" name="id" value={order.id} />
          <div className="staff-actions">
            <button className="staff-btn primary" type="submit">
              重试开通
            </button>
          </div>
        </form>
      ) : status === 'expired' ? (
        <div className="staff-done muted">已取消</div>
      ) : !editing ? (
        <div className="staff-actions">
          <button className="staff-btn primary" onClick={() => setEditing(true)} type="button">
            确认收款
          </button>
          <form action={cancelOrder}>
            <input type="hidden" name="id" value={order.id} />
            <button className="staff-btn ghost" type="submit">
              取消
            </button>
          </form>
        </div>
      ) : (
        <form
          action={confirmOrder}
          onSubmit={(e) => {
            const ok = window.confirm(
              '确认修改并开通？\n\n修改后的金额、套餐、天数、流量会立即生效，并自动在面板创建/更新客户端。',
            )
            if (!ok) e.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={order.id} />
          <div className="staff-form">
            <label>
              <span>金额</span>
              <input name="amount" type="number" defaultValue={order.amount} inputMode="decimal" />
            </label>
            <label>
              <span>套餐</span>
              <select name="plan" defaultValue={order.plan}>
                <option value="basic">基础版</option>
                <option value="advanced">进阶版</option>
              </select>
            </label>
            <label>
              <span>天数</span>
              <input name="days" type="number" defaultValue={order.days} inputMode="numeric" />
            </label>
            <label>
              <span>流量 G</span>
              <input
                name="trafficGB"
                type="number"
                defaultValue={order.trafficGB}
                inputMode="numeric"
              />
            </label>
            <label>
              <span>设备数</span>
              <input name="ipLimit" type="number" defaultValue={order.ipLimit} inputMode="numeric" />
            </label>
          </div>
          <div className="staff-actions">
            <button className="staff-btn primary" type="submit">
              确认并开通
            </button>
            <button className="staff-btn ghost" type="button" onClick={() => setEditing(false)}>
              返回
            </button>
          </div>
        </form>
      )}
    </article>
  )
}
