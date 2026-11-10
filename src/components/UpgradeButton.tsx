'use client'

import { useState } from 'react'

export default function UpgradeButton({
  clientEmail,
  customerId,
  upgradeFee = 100,
}: {
  clientEmail: string
  customerId: number
  upgradeFee?: number
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: customerId,
          plan: 'advanced',
          billing: 'upgrade',
          amount: upgradeFee,
          days: 30,
          trafficGB: 200,
          ipLimit: 8,
          upgradeClientEmail: clientEmail,
          source: 'customer',
          note: `升级 ${clientEmail} 到进阶版（设备上限 8 台）`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.message || '提交失败')
      }
      setDone(true)
    } catch (e: any) {
      setError(e?.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)} type="button">
        去升级
      </button>

      {open ? (
        <div className="up-mask" onClick={() => !loading && setOpen(false)}>
          <div className="up-box" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <>
                <h3>升级订单已提交</h3>
                <p className="up-desc">
                  订单已提交给客服，微信支付 <b>¥{upgradeFee}</b> 差价并备注订单号，
                  客服确认后会把 <b>{clientEmail}</b> 升级到进阶版（设备上限 8 台）。
                </p>
                <div className="up-actions">
                  <button className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
                    知道了
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>升级到进阶版</h3>
                <div className="up-row">
                  <span>当前</span>
                  <b>入门版 · 最多 4 台设备</b>
                </div>
                <div className="up-row">
                  <span>升级后</span>
                  <b>进阶版 · 最多 8 台设备</b>
                </div>
                <div className="up-row">
                  <span>客户端</span>
                  <b className="up-mono">{clientEmail}</b>
                </div>
                <div className="up-total">
                  补差价 <b>¥{upgradeFee}</b>
                </div>
                <p className="up-tip">
                  提交后生成升级订单，客服确认收到差价后自动升级，无需重新配置。
                </p>
                {error ? <div className="cart-error">{error}</div> : null}
                <div className="up-actions">
                  <button
                    className="btn btn-primary"
                    onClick={submit}
                    disabled={loading}
                    type="button"
                  >
                    {loading ? '提交中…' : '提交升级订单'}
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
