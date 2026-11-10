'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', code: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // 发送验证码后的倒计时
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function sendCode() {
    setError('')
    setNotice('')
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('先填一个正确的邮箱')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, purpose: 'register' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || '发送失败，稍后再试')
      setNotice('验证码已发到你的邮箱，10 分钟内有效（找不到就看下垃圾箱）')
      setCooldown(60)
    } catch (err: any) {
      setError(err.message || '发送失败')
    } finally {
      setSending(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!form.email || !form.password) {
      setError('请填写邮箱和密码')
      return
    }
    if (!/^\d{6}$/.test(form.code)) {
      setError('请填写邮箱里收到的 6 位验证码')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          emailCode: form.code,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.message || '注册失败，请稍后重试')
      }
      setDone(true)
    } catch (err: any) {
      setError(err.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>注册成功</h1>
          <p className="sub">
            账号已创建，请使用 <b>{form.email}</b> 和密码登录。
          </p>
          <div className="alert alert-warn">
            欢迎邮件已发出，里面写了下一步怎么领 1 小时免费体验。
          </div>
          <Link className="btn btn-primary btn-block" href="/login">
            去登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>注册账户</h1>
        <p className="sub">用邮箱注册，注册后即可领取体验、查看服务、提交工单。</p>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {notice ? <div className="alert alert-success">{notice}</div> : null}

        <div className="field">
          <label htmlFor="name">称呼</label>
          <input
            id="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="怎么称呼你"
            autoComplete="name"
          />
        </div>

        <div className="field">
          <label htmlFor="email">邮箱 *</label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="code">邮箱验证码 *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="code"
              inputMode="numeric"
              maxLength={6}
              required
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.replace(/\D/g, '') })}
              placeholder="6 位数字"
              autoComplete="one-time-code"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-ghost"
              type="button"
              onClick={sendCode}
              disabled={sending || cooldown > 0}
              style={{ whiteSpace: 'nowrap' }}
            >
              {sending ? '发送中…' : cooldown > 0 ? `${cooldown}s 后重发` : '发送验证码'}
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="password">密码 *</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="至少 8 位"
            autoComplete="new-password"
          />
        </div>

        <button className="btn btn-primary btn-block" disabled={loading} type="submit">
          {loading ? '提交中…' : '注册'}
        </button>

        <div className="form-foot">
          已有账户？<Link href="/login">直接登录</Link>
        </div>
      </form>
    </div>
  )
}
