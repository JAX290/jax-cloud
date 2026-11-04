'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (!form.email || !form.password) {
      setError('请填写邮箱和密码')
      return
    }

    setConfirming(true)
  }

  async function doRegister() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.message || '注册失败，请稍后重试')
      }
      setConfirming(false)
      setDone(true)
    } catch (err: any) {
      setError(err.message || '注册失败')
      setConfirming(false)
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
            请确认邮箱正确！否则无法通过邮箱找回账号。
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
        <p className="sub">用邮箱注册，注册后即可登录查看服务、提交工单。</p>

        <div className="alert alert-warn">
          请确认邮箱正确！否则无法通过邮箱找回账号。
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

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

      {confirming ? (
        <div className="confirm-mask" role="dialog" aria-modal="true">
          <div className="confirm-box">
            <h3>请确认邮箱正确</h3>
            <p>
              你的登录邮箱是：<b className="confirm-email">{form.email}</b>
            </p>
            <p>
              邮箱填错将无法通过邮箱找回账号，请务必确认无误后再注册。
            </p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)} type="button">
                返回修改
              </button>
              <button className="btn btn-primary" onClick={doRegister} disabled={loading} type="button">
                {loading ? '注册中…' : '确认注册'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
