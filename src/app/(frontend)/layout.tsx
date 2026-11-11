import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import WhatsAppFloat from '@/components/WhatsAppFloat'
import './styles.css'

const SITE = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')

const TITLE = 'JAX CLOUD · 跨境网络环境部署'
const DESCRIPTION =
  '固定 IP、独享环境、全天候在线。为跨境卖家提供稳定、干净的海外网络环境，亚马逊、TikTok 多店铺可做 IP 隔离。'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: '%s · JAX CLOUD',
  },
  description: DESCRIPTION,
  keywords: [
    '跨境网络环境',
    '固定 IP',
    '独立 IP',
    '亚马逊多店铺',
    'TikTok 直播网络',
    '海外专线',
    'IP 隔离',
  ],
  alternates: { canonical: undefined },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    url: SITE + '/',
    siteName: 'JAX CLOUD',
    locale: 'zh_CN',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: '/api/media/file/og-cover.png',
        width: 1200,
        height: 630,
        alt: 'JAX CLOUD · 跨境网络环境部署',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/api/media/file/og-cover.png'],
  },
  // 第二种站点所有权验证方式（环境变量注入，不写死）：设置后重启即生效
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE}/#org`,
      name: 'JAX CLOUD',
      url: SITE,
      slogan: '把跨境业务，放在独立、稳定的网络环境里',
      areaServed: 'CN',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: SITE,
      name: 'JAX CLOUD',
      publisher: { '@id': `${SITE}/#org` },
      inLanguage: 'zh-CN',
    },
    {
      '@type': 'Service',
      name: '跨境网络环境部署',
      serviceType: '跨境网络环境部署 / 固定 IP 独立环境',
      provider: { '@id': `${SITE}/#org` },
      areaServed: 'CN',
      url: `${SITE}/#pricing`,
      description: DESCRIPTION,
    },
  ],
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  const isCustomer = user?.collection === 'customers'

  let siteSettings: any = {}
  try {
    siteSettings = await payload.findGlobal({ slug: 'site-settings' })
  } catch {
    siteSettings = {}
  }
  const waLink = String(siteSettings?.whatsapp || '')
  const wechatId = String(siteSettings?.wechat || '')
  const contactEmail = String(siteSettings?.email || '')

  return (
    <html lang="zh-CN">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <header className="nav">
          <div className="wrap nav-inner">
            <Link className="brand" href="/">
              JAX <span>//</span> CLOUD
            </Link>
            <nav className="nav-links">
              <Link href="/#services">服务</Link>
              <Link href="/#pricing">价格</Link>
              <Link href="/#cases">案例</Link>
              <Link href="/#blog">知识库</Link>
              <Link href="/#contact">联系</Link>
              {isCustomer ? (
                <Link className="btn btn-primary" href="/account">
                  我的账户
                </Link>
              ) : (
                <Link className="btn btn-primary" href="/login">
                  登录
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main>{props.children}</main>

        <footer className="footer">
          <div className="wrap footer-inner">
            <span>© 2026 JAX CLOUD · 仅提供合法的网络环境部署技术服务</span>
            <span className="footer-links">
              {wechatId ? <span>微信 {wechatId}</span> : null}
              {waLink ? (
                <a href={waLink} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              ) : null}
              {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : null}
              <Link href="/#disclaimer">免责声明</Link>
            </span>
          </div>
        </footer>

        {/* 手机端右下角浮动 WhatsApp（桌面隐藏，联系方式区已有入口） */}
        <WhatsAppFloat href={waLink} />
      </body>
    </html>
  )
}
