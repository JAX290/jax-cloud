import { getPayload } from 'payload'

import config from '@/payload.config'
import { turnstileEnabled, verifyTurnstile } from '@/lib/turnstile'
import { sendCode, type CodePurpose } from '@/lib/verify-code'

export const dynamic = 'force-dynamic'

function clientIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for') || ''
  return (xff.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim()
}

/**
 * 发送邮箱验证码（需通过人机验证）
 * POST /api/auth/send-code { email, purpose?, turnstileToken?, captchaId?, captchaCode? }
 *
 * 配了 Turnstile 就校验 token；没配则降级校验图形码。
 */
export async function POST(req: Request) {
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: '请求格式不对' }, { status: 400 })
  }

  const email = String(body?.email || '').trim()
  const purpose: CodePurpose = body?.purpose === 'reset' ? 'reset' : 'register'
  if (!email) {
    return Response.json({ ok: false, error: '请填写邮箱' }, { status: 400 })
  }

  const ip = clientIp(req)
  let humanVerified = false
  if (turnstileEnabled()) {
    const result = await verifyTurnstile(body?.turnstileToken, ip)
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 400 })
    }
    humanVerified = true
  }

  const payload = await getPayload({ config })
  const result = await sendCode(payload, email, purpose, {
    captchaId: body?.captchaId,
    captchaCode: body?.captchaCode,
    ip,
    humanVerified,
  })
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400 })
  }
  return Response.json({ ok: true, message: '验证码已发送，请查收邮箱（含垃圾箱）' })
}
