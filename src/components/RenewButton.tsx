'use client'

import Link from 'next/link'
import { useState } from 'react'

import { MONTH_OPTIONS, TRAFFIC_PACKS, quoteRenewal } from '@/lib/renew'

function fmtDate(ts?: number) {
  const v = Number(ts || 0)
  if (!v) return '长期'
  return new Date(v).toLocaleDateString('zh-CN')
}

export default function RenewButton({
  clientEmail,
  customerId,
  currentExpiry,
  currentTotalGB,
  usedBytes,
}: {
  clientEmail: string
  customerId: number
  currentExpiry?: number
  currentTotalGB?: number
  usedBytes?: number
}) {
  const [open, setOpen] = useState(false)
  const [packKey, setPackKey] = useState(TRAFFIC_PACKS[0].key)
  const [months, setMonths] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  const quote = quoteRenewal(packKey, months)

  // 预计续费后的到期日 / 流量额度
  function previewExpiry() {
    if (!quote) return '—'
    const now = Date.now()
    const cur = Number(currentExpiry || 0)
    const base = cur > now ? cur : now
    return fmtDate(base + quote.days * 24 * 3600 * 1000)
  }
  function previewTotalGB() {
    if (!quote) return '—'
    const cur = Number(currentTotalGB || 0) / (1024 * 1024 * 1024)
    const total = cur + quote.trafficGB
    return total > 0 ? `${total.toFixed(0)}G` : '不限'
  }

  async function submit() {
    if (!quote) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, clientEmail, pack: packKey, months }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.message || '提交失败')
      setResult(data)
    } catch (e: any) {
      setError(e?.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  // 注意：面板返回的 totalGB 字段单位其实是字节
  const usedPct =
    Number(currentTotalGB || 0) > 0
      ? Math.min(100, Math.round((Number(usedBytes || 0) / Number(currentTotalGB)) * 100))
      : 0

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)} type="button">
        续费
      </button>

      {open ? (
        <div className="up-mask" onClick={() => !loading && setOpen(false)}>
          <div className="up-box" onClick={(e) => e.stopPropagation()}>
            {result ? (
              <>
                <h3>续费订单已提交</h3>
                <p className="up-desc">
                  订单号 <b>{result.orderNo}</b>，合计 <b>¥{result.amount}</b>。
                  微信付款时备注订单号，客服确认收款后自动续上，<b>不用重新配置任何客户端</b>。
                </p>
                <div className="up-row">
                  <span>客户端</span>
                  <b className="up-mono">{clientEmail}</b>
                </div>
                <div className="up-row">
                  <span>预计到期</span>
                  <b>{previewExpiry()}</b>
                </div>
                <div className="up-actions">
                  <Link className="btn btn-ghost" href="/orders">
                    去我的订单看进度
                  </Link>
                  <button className="btn btn-primary" onClick={() => setOpen(false)}>
                    知道了
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>给 {clientEmail} 续费</h3>

                <div className="renew-packs">
                  {TRAFFIC_PACKS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={`renew-pack ${packKey === p.key ? 'active' : ''}`}
                      onClick={() => setPackKey(p.key)}
                      disabled={loading}
                    >
                      <b>{p.label}</b>
                      <span>¥{p.pricePerMonth} / 月</span>
                    </button>
                  ))}
                </div>

                <div className="renew-months-block">
                  <div className="renew-months-label">续费时长</div>
                  <div className="month-grid">
                    {MONTH_OPTIONS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`month-chip ${months === m ? 'active' : ''}`}
                        onClick={() => setMonths(m)}
                        disabled={loading}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div className="month-hint">
                    {months === 12
                      ? '一次买满 12 个月，按月付的价格算下来刚好省一成。'
                      : `共 ${months} 个月，到期日往后顺延 ${quote?.days} 天。`}
                    {months < 12 ? ' 买满 12 个月更划算。' : ''}
                  </div>
                </div>

                <div className="up-row">
                  <span>当前到期</span>
                  <b>{fmtDate(currentExpiry)}</b>
                </div>
                <div className="up-row">
                  <span>续费后到期</span>
                  <b>{previewExpiry()}</b>
                </div>
                <div className="up-row">
                  <span>流量额度</span>
                  <b>
                    {Number(currentTotalGB || 0) > 0 ? `${usedPct}% 已用 · ` : ''}
                    续上后 {previewTotalGB()}（流量累加，不清零）
                  </b>
                </div>

                <div className="up-total">
                  合计
                  <span className="up-price">
                    <b>¥{quote?.amount}</b>
                    {quote && quote.discountLabel ? (
                      <>
                        <em className="price-strike">¥{quote.originalAmount}</em>
                        <em className="save-badge">{quote.discountLabel}</em>
                      </>
                    ) : null}
                  </span>
                </div>
                <p className="up-tip">
                  到期日往后顺延 {quote?.days} 天，流量额度往上加 {quote?.trafficGB}G。
                  {quote && quote.savedAmount > 0
                    ? ` 这一单比按月买省下 ¥${quote.savedAmount}。`
                    : ''}
                  提交后客服确认收款就自动生效，订阅链接和设备都不用动。
                </p>
                {error ? <div className="cart-error">{error}</div> : null}
                <div className="up-actions">
                  <button className="btn btn-primary" onClick={submit} disabled={loading} type="button">
                    {loading ? '提交中…' : '提交续费订单'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    type="button"
                  >
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
