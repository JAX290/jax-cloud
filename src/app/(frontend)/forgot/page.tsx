'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/customers/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } finally {
      setLoading(false)
      setDone(true)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>找回密码</h1>
        {done ? (
          <>
            <div className="alert alert-ok">
              如果该邮箱已注册，我们已发送重置链接，请查收邮件（本地开发看 `pnpm dev:smtp` 终端）。
            </div>
            <Link className="btn btn-ghost btn-block" href="/login">
              返回登录
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="sub">输入注册邮箱，我们会发送重置链接。</p>
            <div className="field">
              <label htmlFor="email">邮箱</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading} type="submit">
              {loading ? '发送中…' : '发送重置邮件'}
            </button>
            <div className="form-foot">
              <Link href="/login">返回登录</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
