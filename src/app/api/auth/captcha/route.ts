import { getPayload } from 'payload'

import { createCaptcha } from '@/lib/captcha'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

/** 取真实客户端 IP（Caddy 会带 X-Forwarded-For） */
function clientIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for') || ''
  return (xff.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim()
}

/**
 * 获取图形验证码
 * GET /api/auth/captcha            → { id, image }（PNG base64）
 * GET /api/auth/captcha?debug=xxx  → 额外返回 code（仅 CRON_SECRET 可用，给测试/排查）
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const payload = await getPayload({ config })
  const result = await createCaptcha(payload, clientIp(req))
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 500 })
  }

  const debug = url.searchParams.get('debug') || ''
  const secret = process.env.CRON_SECRET || ''
  const showCode = Boolean(secret) && debug === secret

  return Response.json({
    ok: true,
    id: result.id,
    image: result.image,
    ...(showCode ? { code: result.code } : {}),
  })
}
