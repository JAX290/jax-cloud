import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '案例库',
  description: '内部交付记录，暂不对外展示。',
  robots: { index: false, follow: false },
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

export default async function CasesPage() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'cases',
    where: { published: { equals: true } },
    sort: 'order',
    limit: 50,
  })

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>案例</h1>
            <p>只做部署与运维，客户信息已脱敏。</p>
          </div>
          <Link className="btn btn-primary" href="/#contact">
            咨询同类方案
          </Link>
        </div>

        <div className="grid grid-2 cases-grid">
          {result.docs.map((item: any) => (
            <Link className="card case-card" href={`/cases/${item.slug || item.id}`} key={item.id}>
              {item.image?.url ? (
                <div className="case-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageSrc(item.image.url)} alt={item.image.alt || item.title} loading="lazy" />
                </div>
              ) : null}
              <div className="case-meta">
                {CATEGORY_LABEL[item.category] || item.tag || 'CASE'}
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className="case-link">查看详情 →</span>
            </Link>
          ))}
        </div>

        {!result.docs.length ? <div className="empty">案例整理中，稍后再来看看。</div> : null}
      </div>
    </div>
  )
}
