'use client'

import { useEffect, useState } from 'react'

import { cartTotal, clearCart, readCart, removeFromCart, type CartItem } from '@/lib/cart'

export default function CartBar() {
  const [items, setItems] = useState<CartItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sync = () => setItems(readCart())
    sync()
    window.addEventListener('jax-cart-update', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('jax-cart-update', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  if (!items.length) return null

  const total = cartTotal(items)

  async function checkout() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || '提交失败，请稍后重试')
      clearCart()
      window.location.href = '/orders'
    } catch (e: any) {
      setError(e?.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open ? (
        <div className="cart-mask" onClick={() => setOpen(false)}>
          <div className="cart-panel" onClick={(e) => e.stopPropagation()}>
            <div className="cart-panel-head">
              <b>购物车（{items.length}）</b>
              <button type="button" className="cart-close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <div className="cart-items">
              {items.map((item) => (
                <div className="cart-item" key={item.key}>
                  <div>
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-meta">
                      {item.days} 天 · {item.trafficGB}G · {item.ipLimit} 台
                    </div>
                  </div>
                  <div className="cart-item-right">
                    <b>¥{item.amount}</b>
                    <button
                      type="button"
                      className="cart-item-del"
                      onClick={() => removeFromCart(item.key)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-panel-foot">
              <div className="cart-total">
                合计 <b>¥{total}</b>
              </div>
              <div className="cart-tip">
                提交后生成订单，微信转账给客服并备注订单号，客服确认后自动开通。
              </div>
              {error ? <div className="cart-error">{error}</div> : null}
              <button className="btn btn-primary btn-block" onClick={checkout} disabled={loading}>
                {loading ? '提交中…' : '提交订单'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="cart-bar">
        <button className="cart-bar-main" type="button" onClick={() => setOpen(true)}>
          <span className="cart-bar-count">{items.length}</span>
          <span className="cart-bar-label">购物车</span>
          <b>¥{total}</b>
        </button>
        <button className="cart-bar-buy" type="button" onClick={checkout} disabled={loading}>
          {loading ? '…' : '去结算'}
        </button>
      </div>
    </>
  )
}
