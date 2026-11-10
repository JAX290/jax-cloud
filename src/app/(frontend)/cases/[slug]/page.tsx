import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const doc: any = await findCase(slug)
  if (!doc || !doc.published) {
    return { title: '案例未找到', robots: { index: false, follow: false } }
  }
  const title = doc.title || '案例'
  const description = String(doc.description || '').slice(0, 140)
  return {
    title,
    description,
    // 这些是我们自己的交付记录，暂不对外收录
    robots: { index: false, follow: false },
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  deploy: '部署',
  ops: '运维',
}

function imageSrc(url?: string) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.pathname + parsed.search
    }
    return url
  } catch {
    return url
  }
}

async function findCase(slug: string) {
  const payload = await getPayload({ config })

  try {
    const result = await payload.find({
      collection: 'cases',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    if (result.docs[0]) return result.docs[0]
  } catch {
    // 忽略，继续按 ID 查找
  }

  if (/^\d+$/.test(slug)) {
    try {
      return await payload.findByID({ collection: 'cases', id: slug })
    } catch {
      return null
    }
  }

  return null
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc: any = await findCase(slug)

  if (!doc || !doc.published) {
    notFound()
  }

  return (
    <div className="page">
      <div className="wrap">
        <article className="case-detail">
          <Link className="back" href="/cases">
            ← 返回案例
          </Link>

          <div className="case-meta">{doc.tag || CATEGORY_LABEL[doc.category] || 'CASE'}</div>
          <h1>{doc.title}</h1>
          <div className="meta-line">
            {doc.customer || '客户信息已脱敏'}
            {doc.category ? ` · ${CATEGORY_LABEL[doc.category] || doc.category}` : ''}
          </div>

          {doc.image?.url ? (
            <div className="hero-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc(doc.image.url)} alt={doc.image.alt || doc.title} />
            </div>
          ) : null}

          {doc.description ? <p className="lead" style={{ maxWidth: 'none' }}>{doc.description}</p> : null}

          {doc.challenge ? (
            <div className="case-block">
              <h2>遇到的问题</h2>
              <p>{doc.challenge}</p>
            </div>
          ) : null}

          {doc.solution ? (
            <div className="case-block">
              <h2>我们做了什么</h2>
              <p>{doc.solution}</p>
            </div>
          ) : null}

          {doc.result ? (
            <div className="case-block">
              <h2>结果</h2>
              <p>{doc.result}</p>
            </div>
          ) : null}

          <div className="case-cta">
            <p>想要类似的部署或运维方案？把你的场景发给我们。</p>
            <Link className="btn btn-primary" href="/#contact">
              咨询报价 →
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}
