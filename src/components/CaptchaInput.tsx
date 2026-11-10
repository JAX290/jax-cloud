'use client'

import { useCallback, useEffect, useState } from 'react'

export type CaptchaValue = { id: number | null; code: string }

/**
 * 图形验证码（点图片换一张）
 * - 自己负责取图，父组件只拿 { id, code }
 * - refreshKey 变化时自动换新图（发完邮件后旧码已作废）
 */
export default function CaptchaInput({
  value,
  onChange,
  refreshKey = 0,
}: {
  value: CaptchaValue
  onChange: (v: CaptchaValue) => void
  refreshKey?: number
}) {
  const [image, setImage] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/captcha', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        setImage(data.image)
        onChange({ id: data.id, code: '' })
      }
    } catch {
      /* 失败就保持旧图 */
    } finally {
      setLoading(false)
    }
  }, [onChange])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  return (
    <div className="field">
      <label htmlFor="captcha">图形验证码 *</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          id="captcha"
          value={value.code}
          onChange={(event) =>
            onChange({ ...value, code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) })
          }
          placeholder="4 位字符"
          autoComplete="off"
          style={{ flex: 1 }}
        />
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt="图形验证码"
            title="看不清？点一下换一张"
            onClick={load}
            style={{
              height: 44,
              borderRadius: 8,
              cursor: 'pointer',
              border: '1px solid rgba(0,229,255,.22)',
              background: '#0b1626',
            }}
          />
        ) : (
          <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
            {loading ? '加载中…' : '获取验证码'}
          </button>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: 'rgba(142,166,192,.7)', marginTop: 6, marginBottom: 0 }}>
        看不清点图片换一张，验证码 5 分钟内有效
      </p>
    </div>
  )
}
