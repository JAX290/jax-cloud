'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          data?.errors?.[0]?.message ||
            data?.message ||
            '登录失败，请检查邮箱和密码',
        )
      }
      window.location.href = '/account'
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>客户登录</h1>
        <p className="sub">登录后可查看自己的网络环境、流量与工单。</p>
        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            type="password"
            required
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            autoComplete="current-password"
          />
        </div>

        <button className="btn btn-primary btn-block" disabled={loading} type="submit">
          {loading ? '登录中…' : '登录'}
        </button>

        <div className="form-foot">
          <Link href="/forgot">忘记密码？</Link> · <Link href="/register">注册新账户</Link>
        </div>

        <div className="auth-hint">
          员工 / 客服入口：<Link href="/staff">工作台登录</Link>
        </div>
      </form>
    </div>
  )
}
