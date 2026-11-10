import { getPayload } from 'payload'

import { verifyCaptcha } from '@/lib/captcha'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

/**
 * 找回密码（发重置链接）
 * POST /api/auth/forgot-password { email, captchaId, captchaCode }
 *
 * 必须过图形验证码，防止被人拿邮箱轰炸；无论邮箱是否存在都返回同样的结果，避免探测。
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

  const payload = await getPayload({ config })

  const captcha = await verifyCaptcha(payload, body?.captchaId, body?.captchaCode)
  if (!captcha.ok) {
    return Response.json({ ok: false, error: captcha.error }, { status: 400 })
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
