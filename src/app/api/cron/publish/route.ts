import type { NextRequest } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { sendWecom } from '@/lib/wecom'

export const dynamic = 'force-dynamic'

/** 北京时间格式化：UTC ISO → 11-14 10:23 */
function fmtBeijing(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const bj = new Date(d.getTime() + 8 * 3600 * 1000)
  const mm = String(bj.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(bj.getUTCDate()).padStart(2, '0')
  const hh = String(bj.getUTCHours()).padStart(2, '0')
  const mi = String(bj.getUTCMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

/**
 * 定时发布知识库文章
 *
 * - cron 每 10 分钟调一次：/api/cron/publish?secret=xxx
 * - 找 published=false 且 publishAt <= 现在 的文章 → 勾已发布
 * - 勾发布会触发 Posts 的 afterChange 钩子，自动推 IndexNow（Bing）
 * - 推企业微信：发了哪篇 + 还剩几篇 + 下一篇预计什么时候（北京时间）
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || ''
  const provided = req.nextUrl.searchParams.get('secret') || ''
  if (provided !== secret) {
    return Response.json({ ok: false, message: 'forbidden' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const now = new Date()
  const nowIso = now.toISOString()

  let due: any[] = []
  try {
    const res: any = await payload.find({
      collection: 'posts',
      where: {
        and: [{ published: { equals: false } }, { publishAt: { less_than_equal: nowIso } }],
      },
      sort: 'publishAt',
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    due = (res.docs || []) as any[]
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }

  const published: any[] = []
  for (const doc of due) {
    try {
      await payload.update({
        collection: 'posts',
        id: doc.id,
        data: { published: true, publishedAt: doc.publishAt || nowIso },
        overrideAccess: true,
      })
      published.push(doc)
    } catch {
      /* 单篇失败不影响其他篇 */
    }
  }

  // 队列情况：还剩几篇、最近三篇预计什么时候
  let remaining = 0
  let nextList: any[] = []
  try {
    const rest: any = await payload.find({
      collection: 'posts',
      where: { published: { equals: false }, publishAt: { greater_than: nowIso } },
      sort: 'publishAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    remaining = rest.totalDocs || 0
    nextList = (rest.docs || []).slice(0, 3)
  } catch {
    /* 查询失败就不带队列信息 */
  }

  const nextText = nextList.length
    ? nextList
        .map((d: any) => `- ${fmtBeijing(d.publishAt)}《${d.title}》`)
        .join('\n')
    : ''

  if (published.length) {
    const lines = published
      .map((s: any) => `- [${s.title}](https://cloud.jax.markets/blog/${s.slug || s.id})`)
      .join('\n')
    const tail = remaining
      ? `\n> 还剩 **${remaining}** 篇在排队，下一篇预计 **${fmtBeijing(nextList[0]?.publishAt)}**（北京时间）\n${nextText}`
      : `\n> 排期已经空了，记得补稿。`
    try {
      await sendWecom(`### 知识库定时发布\n已自动发布 **${published.length}** 篇：\n${lines}${tail}`)
    } catch {
      /* 推送失败不影响发布 */
    }
  }

  return Response.json({
    ok: true,
    checked: nowIso,
    published: published.map((d: any) => d.slug || String(d.id)),
    remaining,
    next: nextList.map((d: any) => ({
      slug: d.slug,
      title: d.title,
      publishAt: d.publishAt,
      publishAtBeijing: fmtBeijing(d.publishAt),
    })),
  })
}
