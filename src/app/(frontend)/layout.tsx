import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import './styles.css'

export const metadata = {
  title: 'JAX CLOUD · 跨境电商服务器部署与运维',
  description:
    '面向跨境电商卖家的服务器部署与运维托管：环境配置、独立资源、按月付费。',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  const isCustomer = user?.collection === 'customers'

  return (
    <html lang="zh-CN">
      <body>
        <header className="nav">
          <div className="wrap nav-inner">
            <Link className="brand" href="/">
              JAX <span>//</span> CLOUD
            </Link>
            <nav className="nav-links">
              <Link href="/#services">服务</Link>
              <Link href="/#pricing">价格</Link>
              <Link href="/#cases">案例</Link>
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
            <span>© 2026 JAX CLOUD · 仅提供合法的服务器部署与运维技术服务</span>
            <span>
              <Link href="/#disclaimer">免责声明</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  )
}
