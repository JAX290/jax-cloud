'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ResetClient({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/customers/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.message || '重置失败')
      }
      setDone(true)
    } catch (err: any) {
      setError(err.message || '重置失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>设置新密码</h1>
        {done ? (
          <>
            <div className="alert alert-ok">密码已重置，请用新密码登录。</div>
            <Link className="btn btn-primary btn-block" href="/login">
              去登录
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            {error ? <div className="alert alert-error">{error}</div> : null}
            <div className="field">
              <label htmlFor="password">新密码</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="confirm">确认新密码</label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading} type="submit">
              {loading ? '提交中…' : '重置密码'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
