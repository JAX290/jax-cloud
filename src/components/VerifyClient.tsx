'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function VerifyClient({ token }: { token: string }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('链接缺少验证令牌')
      return
    }
    fetch(`/api/customers/verify/${token}`, { method: 'POST' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.errors?.[0]?.message || data?.message || '验证失败')
        }
        setStatus('ok')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.message || '验证失败')
      })
  }, [token])

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>邮箱验证</h1>
        {status === 'loading' ? <p className="sub">正在验证…</p> : null}
        {status === 'ok' ? (
          <>
            <div className="alert alert-ok">验证成功，现在可以登录了。</div>
            <Link className="btn btn-primary btn-block" href="/login">
              去登录
            </Link>
          </>
        ) : null}
        {status === 'error' ? (
          <>
            <div className="alert alert-error">{message}</div>
            <Link className="btn btn-ghost btn-block" href="/register">
              重新注册
            </Link>
          </>
        ) : null}
      </div>
    </div>
  )
}
