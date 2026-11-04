'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function NewTicketPage() {
  const [form, setForm] = useState({
    subject: '',
    category: 'ops',
    priority: 'normal',
    body: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/ticket-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || '提交失败')
      }
      window.location.href = `/account/tickets/${data.id}`
    } catch (err: any) {
      setError(err.message || '提交失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <div className="page-head">
          <div>
            <h1>提交工单</h1>
            <p>描述你遇到的问题，我们会在工作时间内回复。</p>
          </div>
          <Link className="btn btn-ghost" href="/account">
            返回
          </Link>
        </div>

        <form className="panel" onSubmit={submit}>
          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className="field">
            <label htmlFor="subject">标题 *</label>
            <input
              id="subject"
              required
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              placeholder="例如：服务器无法连接"
            />
          </div>

          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="category">分类</label>
              <select
                id="category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                <option value="deploy">部署问题</option>
                <option value="ops">运维问题</option>
                <option value="billing">账单 / 续费</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="priority">优先级</label>
              <select
                id="priority"
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              >
                <option value="low">低</option>
                <option value="normal">普通</option>
                <option value="high">高</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="body">问题描述 *</label>
            <textarea
              id="body"
              required
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              placeholder="请描述现象、报错信息、时间，以及你希望我们做什么。"
            />
          </div>

          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? '提交中…' : '提交工单'}
          </button>
        </form>
      </div>
    </div>
  )
}
