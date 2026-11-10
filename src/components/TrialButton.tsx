'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** 领取 1 小时体验的按钮（客户端组件：调接口 + 刷新页面） */
export default function TrialButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function claim() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/trial', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || '领取失败，稍后再试')
      router.refresh()
    } catch (e: any) {
      setError(e?.message || '领取失败，稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button className="btn btn-primary" onClick={claim} disabled={loading}>
        {loading ? '开通中…' : '领取 1 小时体验'}
      </button>
      {error ? (
        <p style={{ color: 'var(--amber)', fontSize: 12.5, marginTop: 8 }}>{error}</p>
      ) : null}
    </div>
  )
}
