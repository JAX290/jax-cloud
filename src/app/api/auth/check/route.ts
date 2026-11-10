import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

/** Caddy forward_auth 用：只有已登录客户才放行 /downloads/* */
export async function GET() {
  try {
    const headers = await getHeaders()
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers })
    if (user && user.collection === 'customers') {
      return new Response('ok', { status: 200 })
    }
  } catch {
    /* fallthrough */
  }
  return new Response('unauthorized', { status: 401 })
}
