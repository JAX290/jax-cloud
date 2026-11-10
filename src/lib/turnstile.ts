/**
 * Cloudflare Turnstile 服务端校验
 * 文档：https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function turnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY)
}

/** 校验前端拿到的 turnstile token（一次性，5 分钟有效） */
export async function verifyTurnstile(
  token: any,
  ip?: string,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: false, error: '服务端没配 Turnstile' }

  const value = String(token || '').trim()
  if (!value) return { ok: false, error: '请先完成人机验证' }

  try {
    const body = new URLSearchParams()
    body.set('secret', secret)
    body.set('response', value)
    if (ip && ip !== 'unknown') body.set('remoteip', ip)

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    })
    const json: any = await res.json().catch(() => ({}))
    if (json?.success) return { ok: true }
    const codes = Array.isArray(json?.['error-codes']) ? json['error-codes'].join(',') : 'unknown'
    return { ok: false, error: `人机验证没通过（${codes}），刷新页面再试一次` }
  } catch (e: any) {
    return { ok: false, error: `人机验证校验失败：${e?.message || '网络错误'}` }
  }
}
