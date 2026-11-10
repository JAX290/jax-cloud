export type CartItem = {
  key: string
  type: 'deploy' | 'traffic' | 'topup'
  plan?: 'basic' | 'advanced'
  name: string
  amount: number
  days: number
  trafficGB: number
  ipLimit: number
}

const CART_KEY = 'jax_cart_v1'

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event('jax-cart-update'))
}

export function addToCart(item: Omit<CartItem, 'key'>) {
  const cart = readCart()
  const key = `${item.type}-${item.plan || ''}-${item.trafficGB}`
  if (cart.some((c) => c.key === key)) return false
  cart.push({ ...item, key })
  writeCart(cart)
  return true
}

export function removeFromCart(key: string) {
  writeCart(readCart().filter((c) => c.key !== key))
}

export function clearCart() {
  writeCart([])
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + Number(i.amount || 0), 0)
}
