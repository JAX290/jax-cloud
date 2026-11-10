import { getPayload } from 'payload'

import config from '@/payload.config'
import { sendCode, type CodePurpose } from '@/lib/verify-code'

export const dynamic = 'force-dynamic'

function clientIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for') || ''
  return (xff.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim()
}

/**
 * 发送邮箱验证码（需先通过图形验证码）
 * POST /api/auth/send-code { email, purpose?, captchaId, captchaCode }
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

  const payload = await getPayload({ config })
  const result = await sendCode(payload, email, purpose, {
    captchaId: body?.captchaId,
    captchaCode: body?.captchaCode,
    ip: clientIp(req),
  })
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400 })
  }
  return Response.json({ ok: true, message: '验证码已发送，请查收邮箱（含垃圾箱）' })
}
