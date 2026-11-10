'use client'

import { useState } from 'react'

import { addToCart, type CartItem } from '@/lib/cart'

export default function AddToCart({
  item,
  label = '加入购物车',
  full = false,
}: {
  item: Omit<CartItem, 'key'>
  label?: string
  full?: boolean
}) {
  const [state, setState] = useState<'idle' | 'added' | 'exists'>('idle')

  function onClick() {
    const ok = addToCart(item)
    setState(ok ? 'added' : 'exists')
    window.setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button
      className={`btn btn-primary ${full ? 'btn-block' : ''} cart-add-btn`}
      onClick={onClick}
      type="button"
    >
      {state === 'added' ? '已加入 ✓' : state === 'exists' ? '已在购物车' : label}
    </button>
  )
}
