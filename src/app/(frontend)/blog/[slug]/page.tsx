import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import LexicalContent from '@/components/LexicalContent'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

const CATEGORY_LABEL: Record<string, string> = {
  troubleshoot: '问题排查',
  compare: '选型对比',
  case: '案例复盘',
}

const SITE = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')

async function findPost(slug: string) {
  const payload = await getPayload({ config })
  try {
    const result: any = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })
    const doc = result.docs?.[0]
    if (doc && doc.published) return doc
    return null
  } catch {
    return null
  }
}

function fmtDate(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post: any = await findPost(slug)
  if (!post) {
    return { title: '文章不存在', robots: { index: false, follow: false } }
  }
  const title = post.title
  const description = String(post.excerpt || '').slice(0, 150)
  const images = post.cover?.url
    ? [{ url: post.cover.url, width: post.cover.width || 1200, height: post.cover.height || 630, alt: post.title }]
    : undefined
  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/blog/${slug}`,
      publishedTime: post.publishedAt || undefined,
      images,
    },
  }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post: any = await findPost(slug)
  if (!post) notFound()

  const payload = await getPayload({ config })
  let related: any[] = []
  try {
    const res: any = await payload.find({
      collection: 'posts',
      where: {
        and: [{ published: { equals: true } }, { slug: { not_equals: slug } }],
      },
      sort: '-publishedAt',
      limit: 3,
      depth: 0,
      overrideAccess: true,
    })
    related = (res.docs || []) as any[]
  } catch {
    related = []
  }

  const url = `${SITE}/blog/${slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: String(post.excerpt || ''),
    datePublished: post.publishedAt || undefined,
    dateModified: post.updatedAt || undefined,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'JAX CLOUD' },
    publisher: { '@type': 'Organization', name: 'JAX CLOUD', url: SITE },
  }

  return (
    <div className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="wrap blog-wrap">
        <div className="blog-head">
          <Link className="blog-back" href="/blog">
            ← 知识库
          </Link>
          <div className="blog-meta">
            <span className="blog-cat">{CATEGORY_LABEL[post.category] || '知识库'}</span>
            {post.publishedAt ? <span className="blog-date">{fmtDate(post.publishedAt)}</span> : null}
          </div>
          <h1>{post.title}</h1>
          {post.excerpt ? <p className="blog-excerpt">{post.excerpt}</p> : null}
        </div>

        <article className="blog-body">
          <LexicalContent content={post.content} />
        </article>

        <div className="blog-cta">
          <div>
            <b>看完还有疑问？</b>
            <p>可以先把你的场景说清楚，我们给一个能落地的方案，不用先付费。</p>
          </div>
          <div className="blog-cta-actions">
            <Link className="btn btn-primary" href="/#pricing">
              看价格
            </Link>
            <Link className="btn btn-ghost" href="/#contact">
              联系我们
            </Link>
          </div>
        </div>

        {related.length ? (
          <div className="blog-related">
            <h2>继续看</h2>
            <div className="grid grid-2">
              {related.map((item: any) => (
                <Link className="card blog-card" href={`/blog/${item.slug || item.id}`} key={item.id}>
                  <div className="blog-card-top">
                    <span className="blog-cat">{CATEGORY_LABEL[item.category] || '知识库'}</span>
                  </div>
                  <h3>{item.title}</h3>
                  {item.excerpt ? <p>{String(item.excerpt).slice(0, 90)}</p> : null}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
