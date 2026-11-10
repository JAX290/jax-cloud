import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '知识库',
  description:
    '跨境网络环境的问题排查、选型对比和运维实践：IP 关联、直播卡顿、独立站稳定性，来自 JAX CLOUD 的一线经验。',
  alternates: { canonical: '/blog' },
}

const CATEGORY_LABEL: Record<string, string> = {
  troubleshoot: '问题排查',
  compare: '选型对比',
  case: '案例复盘',
}

function fmtDate(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

export default async function BlogIndexPage() {
  const payload = await getPayload({ config })

  let posts: any[] = []
  try {
    const result: any = await payload.find({
      collection: 'posts',
      where: { published: { equals: true } },
      sort: '-publishedAt',
      limit: 60,
      depth: 1,
      overrideAccess: true,
    })
    posts = (result.docs || []) as any[]
  } catch {
    posts = []
  }

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>知识库</h1>
            <p>把跨境环境里那些反复出现的问题，写成能照着做的答案。</p>
          </div>
          <Link className="btn btn-primary" href="/#contact">
            遇到具体问题
          </Link>
        </div>

        {posts.length ? (
          <div className="grid grid-2 blog-grid">
            {posts.map((post: any) => (
              <Link className="card blog-card" href={`/blog/${post.slug || post.id}`} key={post.id}>
                <div className="blog-card-top">
                  <span className="blog-cat">{CATEGORY_LABEL[post.category] || '知识库'}</span>
                  {post.publishedAt ? <span className="blog-date">{fmtDate(post.publishedAt)}</span> : null}
                </div>
                <h3>{post.title}</h3>
                {post.excerpt ? <p>{String(post.excerpt).slice(0, 110)}</p> : null}
                <span className="case-link">阅读全文 →</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel">
            <p style={{ margin: 0 }}>文章还在写，第一批会陆续发出来。</p>
            <p style={{ marginBottom: 0 }}>
              有具体问题可以先 <Link href="/#contact">直接问我们</Link>。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
