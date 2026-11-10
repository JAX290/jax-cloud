'use client'

import Link from 'next/link'
import { useState } from 'react'

import CaptchaInput, { type CaptchaValue } from '@/components/CaptchaInput'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [captcha, setCaptcha] = useState<CaptchaValue>({ id: null, code: '' })
  const [captchaRefresh, setCaptchaRefresh] = useState(0)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!captcha.id || captcha.code.length !== 4) {
      setError('先填图形验证码（看不清点图片换一张）')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captchaId: captcha.id, captchaCode: captcha.code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || '发送失败，稍后再试')
      setDone(true)
    } catch (err: any) {
      setError(err.message || '发送失败')
      setCaptchaRefresh((n) => n + 1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>找回密码</h1>
        {done ? (
          <>
            <div className="alert alert-ok">
              如果该邮箱注册过，我们已发送重置链接，请查收邮件（找不到就看下垃圾箱）。
            </div>
            <Link className="btn btn-ghost btn-block" href="/login">
              返回登录
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="sub">输入注册邮箱，我们会发送重置链接。</p>

            {error ? <div className="alert alert-error">{error}</div> : null}

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

            <CaptchaInput value={captcha} onChange={setCaptcha} refreshKey={captchaRefresh} />

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
