'use client'

import { useState } from 'react'

import CopyButton from './CopyButton'

export default function ResetSubButton({ clientEmail }: { clientEmail: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  async function run(mode: 'subId' | 'full') {
    if (mode === 'full') {
      const ok = window.confirm(
        '确定重新生成密钥？\n\n这会让这个客户端的所有设备都断线，需要重新导入订阅或节点链接。',
      )
      if (!ok) return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reset-sub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail, mode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.message || '重置失败')
      setResult(data)
    } catch (e: any) {
      setError(e?.message || '重置失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        重置
      </button>

      {open ? (
        <div className="up-mask" onClick={() => !loading && setOpen(false)}>
          <div className="up-box" onClick={(e) => e.stopPropagation()}>
            {result ? (
              <>
                <h3>{result.needReimport ? '密钥已重置' : '订阅链接已重置'}</h3>
                <p className="up-desc">
                  {result.needReimport
                    ? '旧的订阅链接和已经泄露的节点链接现在都失效了，请用下面的新链接重新导入：'
                    : '旧订阅链接已经失效，新订阅链接在这里：'}
                </p>
                <div className="env-sub-url">{result.subLink}</div>
                <CopyButton value={result.subLink} label="复制订阅" />
                <p className="up-tip">
                  {result.needReimport
                    ? '这个客户端的所有设备都要重新导入订阅或节点链接。'
                    : '已经导入过的设备不用动，以后自动更新会走新链接。'}
                </p>
                <div className="up-actions">
                  <button className="btn btn-primary" onClick={() => window.location.reload()}>
                    刷新页面看新链接
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>重置订阅</h3>
                <p className="up-tip">订阅链接被别人看到了，可以在这里换掉。</p>
                <div className="reset-opt">
                  <button
                    type="button"
                    className="reset-opt-btn"
                    disabled={loading}
                    onClick={() => run('subId')}
                  >
                    <b>只换订阅链接</b>
                    <span>旧链接立刻失效，已导入的设备不用动；但已经泄露出去的节点链接挡不住。</span>
                  </button>
                  <button
                    type="button"
                    className="reset-opt-btn danger"
                    disabled={loading}
                    onClick={() => run('full')}
                  >
                    <b>重新生成密钥</b>
                    <span>旧链接和已泄露的节点链接全部失效，所有设备都要重新导入。</span>
                  </button>
                </div>
                {error ? <div className="cart-error">{error}</div> : null}
                <div className="up-actions">
                  <button
                    className="btn btn-ghost"
                    disabled={loading}
                    onClick={() => setOpen(false)}
                    type="button"
                  >
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
