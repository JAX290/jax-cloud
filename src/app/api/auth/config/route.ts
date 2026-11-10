export const dynamic = 'force-dynamic'

/** 给前端拿公开配置（Turnstile Site Key 是公开信息） */
export async function GET() {
  return Response.json({
    ok: true,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
  })
}
