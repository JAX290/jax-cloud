'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/ticket-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, body }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || '回复失败')
      }
      setBody('')
      router.refresh()
    } catch (err: any) {
      setError(err.message || '回复失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 18 }}>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="field">
        <label htmlFor="reply">补充说明</label>
        <textarea
          id="reply"
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="补充问题细节或回复处理结果"
        />
      </div>
      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? '发送中…' : '发送'}
      </button>
    </form>
  )
}
