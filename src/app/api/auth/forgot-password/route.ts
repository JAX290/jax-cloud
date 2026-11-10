import { getPayload } from 'payload'

import { verifyCaptcha } from '@/lib/captcha'
import { turnstileEnabled, verifyTurnstile } from '@/lib/turnstile'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

function clientIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for') || ''
  return (xff.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim()
}

/**
 * 找回密码（发重置链接）
 * POST /api/auth/forgot-password { email, turnstileToken? | captchaId+captchaCode }
 *
 * 无论邮箱是否存在都返回同样的结果，避免探测账号。
 */
export async function POST(req: Request) {
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: '请求格式不对' }, { status: 400 })
  }

  const email = String(body?.email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: '邮箱格式不对' }, { status: 400 })
  }

  const ip = clientIp(req)
  const payload = await getPayload({ config })

  if (turnstileEnabled()) {
    const result = await verifyTurnstile(body?.turnstileToken, ip)
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 400 })
    }
  } else {
    const captcha = await verifyCaptcha(payload, body?.captchaId, body?.captchaCode)
    if (!captcha.ok) {
      return Response.json({ ok: false, error: captcha.error }, { status: 400 })
    }
  }

  try {
    await payload.forgotPassword({
      collection: 'customers',
      data: { email },
      overrideAccess: true,
    })
  } catch {
    /* 邮箱不存在等情况也返回成功，避免泄露账号是否存在 */
  }

  return Response.json({ ok: true, message: '如果这个邮箱注册过，重置邮件已经发出，请查收' })
}
