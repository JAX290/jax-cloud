import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * 发邮件类接口的 IP 级限流（内存版，单容器够用；重启清零）
 *
 * 目的：注册验证码 / 找回密码 都属于「用户点一下就可能给别人发邮件」的入口，
 * 光靠图形验证码不够，还要限制同一 IP 的调用频率。
 */

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/** 直接封掉的入口：Payload 自带的找回密码路由（不带图形码，容易被拿来轰炸） */
const BLOCKED = ['/api/customers/forgot-password']

/** 每个路径每小时允许的次数 */
const LIMITS: Array<{ path: string; limit: number; windowMs: number }> = [
  { path: '/api/auth/send-code', limit: 20, windowMs: 60 * 60 * 1000 },
  { path: '/api/auth/forgot-password', limit: 20, windowMs: 60 * 60 * 1000 },
  { path: '/api/auth/captcha', limit: 120, windowMs: 60 * 60 * 1000 },
]

function ipOf(req: NextRequest) {
  const xff = req.headers.get('x-forwarded-for') || ''
  return (xff.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim()
}

export function middleware(req: NextRequest) {
  // 自带接口一律拒绝，唯一入口是 /api/auth/forgot-password（带图形码）
  if (BLOCKED.some((p) => req.nextUrl.pathname.startsWith(p))) {
    return NextResponse.json(
      { ok: false, error: '请从「找回密码」页面操作' },
      { status: 403 },
    )
  }

  if (req.method !== 'POST' && !req.nextUrl.pathname.endsWith('/captcha')) {
    return NextResponse.next()
  }

  const rule = LIMITS.find((r) => req.nextUrl.pathname.startsWith(r.path))
  if (!rule) return NextResponse.next()

  const key = `${ipOf(req)}:${rule.path}`
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs })
    return NextResponse.next()
  }

  if (bucket.count >= rule.limit) {
    return NextResponse.json(
      { ok: false, error: '操作太频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000)) } },
    )
  }

  bucket.count += 1
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/auth/send-code', '/api/auth/forgot-password', '/api/auth/captcha', '/api/customers/forgot-password'],
}
