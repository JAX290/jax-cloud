'use client'

import { useEffect, useRef, useState } from 'react'

import CaptchaInput from './CaptchaInput'

export type VerifyValue = {
  /** Turnstile token（配了 Turnstile 时用） */
  token: string
  /** 降级用：图形验证码 */
  captchaId: number | null
  captchaCode: string
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, any>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

const SCRIPT_ID = 'cf-turnstile-script'

/**
 * 人机验证组件
 * - 服务端配了 TURNSTILE_SITE_KEY：渲染 Cloudflare Turnstile（托管模式，大多数情况用户无感）
 * - 没配：自动降级成 4 位图形验证码，功能不中断
 */
export default function VerifyHuman({
  value,
  onChange,
  refreshKey = 0,
}: {
  value: VerifyValue
  onChange: (v: VerifyValue) => void
  refreshKey?: number
}) {
  const [siteKey, setSiteKey] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)

  // 1) 拿公开配置
  useEffect(() => {
    let alive = true
    fetch('/api/auth/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (alive) setSiteKey(data?.turnstileSiteKey || null)
      })
      .catch(() => alive && setSiteKey(null))
    return () => {
      alive = false
    }
  }, [])

  // 2) 加载 Turnstile 脚本
  useEffect(() => {
    if (!siteKey) return
    if (document.getElementById(SCRIPT_ID)) {
      setReady(Boolean(window.turnstile))
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => setReady(true)
    document.head.appendChild(script)
  }, [siteKey])

  // 3) 渲染 widget（refreshKey 变化时重渲染拿新 token）
  useEffect(() => {
    if (!siteKey || !ready || !window.turnstile || !boxRef.current) return
    if (widgetId.current) {
      try {
        window.turnstile.remove(widgetId.current)
      } catch {
        /* ignore */
      }
      widgetId.current = null
    }
    boxRef.current.innerHTML = ''
    widgetId.current = window.turnstile.render(boxRef.current, {
      sitekey: siteKey,
      theme: 'dark',
      language: 'zh-cn',
      callback: (token: string) => onChange({ token, captchaId: null, captchaCode: '' }),
      'expired-callback': () => onChange({ token: '', captchaId: null, captchaCode: '' }),
      'error-callback': () => onChange({ token: '', captchaId: null, captchaCode: '' }),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, ready, refreshKey])

  // 没配 Turnstile：降级成图形码
  if (siteKey === null) {
    return (
      <CaptchaInput
        value={{ id: value.captchaId, code: value.captchaCode }}
        onChange={(v) => onChange({ token: '', captchaId: v.id, captchaCode: v.code })}
        refreshKey={refreshKey}
      />
    )
  }

  return (
    <div className="field">
      <label>人机验证 *</label>
      <div ref={boxRef} style={{ minHeight: 66 }} />
      <p style={{ fontSize: 11.5, color: 'rgba(142,166,192,.7)', marginTop: 6, marginBottom: 0 }}>
        一般不用操作；如果出现勾选框，点一下即可
      </p>
    </div>
  )
}
