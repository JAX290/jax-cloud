import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

const SITE = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')

/**
 * sitemap.xml
 * 首页 + 知识库列表 + 已发布文章。
 * 案例库（/cases）目前是内部交付记录，已 noindex，不放进来；
 * 等有真实客户案例、重新开放时再加。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date().toISOString().slice(0, 10)
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${SITE}/`,
      lastModified: today,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE}/blog`,
      lastModified: today,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]

  try {
    const payload = await getPayload({ config })
    const result: any = await payload.find({
      collection: 'posts',
      where: { published: { equals: true } },
      sort: '-publishedAt',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    for (const post of (result.docs || []) as any[]) {
      const slug = String(post.slug || post.id || '').trim()
      if (!slug) continue
      entries.push({
        url: `${SITE}/blog/${slug}`,
        lastModified: String(post.updatedAt || today).slice(0, 10),
        changeFrequency: 'monthly',
        priority: 0.7,
      })
    }
  } catch {
    /* 构建期或数据库不可用时只返回静态页 */
  }

  return entries
}
