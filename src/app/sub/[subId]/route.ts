import { buildUserinfo } from '@/lib/node-client'
import { resolveSubscription } from '@/lib/sub'

export const dynamic = 'force-dynamic'

/**
 * 中央订阅服务
 * GET /sub/{subId}
 * 链接永远不变：客户端更新订阅时，自动拿到当前所在节点的最新配置
 */
export async function GET(_req: Request, ctx: { params: Promise<{ subId: string }> }) {
  const { subId } = await ctx.params
  const key = String(subId || '').trim()
  if (!key) {
    return new Response('not found', { status: 404 })
  }

  const resolved = await resolveSubscription(key)
  if (!resolved) {
    return new Response('not found', { status: 404 })
  }

  const text = resolved.links.join('\n')
  const body = Buffer.from(text, 'utf-8').toString('base64')

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      // 订阅内容是客户的真实配置，禁止搜索引擎抓取/收录
      'X-Robots-Tag': 'noindex, nofollow',
      'Subscription-Userinfo': buildUserinfo(resolved.client),
    },
  })
}
