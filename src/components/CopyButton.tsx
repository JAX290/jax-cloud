'use client'

import { useState } from 'react'

export default function CopyButton({ value, label = '复制' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function onClick() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // 兜底：老浏览器
      const el = document.createElement('textarea')
      el.value = value
      document.body.appendChild(el)
      el.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      } catch {
        /* ignore */
      }
      document.body.removeChild(el)
    }
  }

  return (
    <button className="copy-btn" onClick={onClick} type="button">
      {copied ? '已复制 ✓' : label}
    </button>
  )
}
