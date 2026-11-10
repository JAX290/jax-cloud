'use client'

import { useState } from 'react'

/** 迁移单个客户端到另一台节点（保留订阅链接不变） */
export default function MigrateButton({
  clientEmail,
  currentNodeName,
  nodes = [],
}: {
  clientEmail: string
  currentNodeName?: string
  nodes?: Array<{ id: number; name?: string; ip?: string; region?: string }>
}) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const others = nodes.filter((n) => (n.name || n.ip) !== currentNodeName)

  async function doMigrate() {
    if (!target) return
    const t = others.find((n) => String(n.id) === target)
    const ok = window.confirm(
      `确认把 ${clientEmail} 迁到「${t?.name || target}」？\n\n迁移后订阅链接不变，客户无需重新配置。`,
    )
    if (!ok) return
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/staff/nodes/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clientEmail, toNodeId: Number(target) }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || '迁移失败')
      setMsg(`已迁移：${data.from} → ${data.to}`)
      setOpen(false)
      window.setTimeout(() => window.location.reload(), 1200)
    } catch (e: any) {
      setMsg(e?.message || '迁移失败')
    } finally {
      setBusy(false)
    }
  }

  if (others.length === 0) return null

  return (
    <>
      <button className="staff-btn ghost" onClick={() => setOpen(true)} type="button">
        迁移节点
      </button>

      {open ? (
        <div className="up-mask" onClick={() => !busy && setOpen(false)}>
          <div className="up-box" onClick={(e) => e.stopPropagation()}>
            <h3>迁移客户端</h3>
            <div className="up-row">
              <span>客户端</span>
              <b className="up-mono">{clientEmail}</b>
            </div>
            <div className="up-row">
              <span>当前节点</span>
              <b>{currentNodeName || '未知'}</b>
            </div>
            <div className="up-row">
              <span>目标节点</span>
              <b>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  style={{ minWidth: 180 }}
                >
                  <option value="">请选择</option>
                  {others.map((n) => (
                    <option key={n.id} value={String(n.id)}>
                      {n.name || n.ip}（{n.ip}）
                    </option>
                  ))}
                </select>
              </b>
            </div>

            {msg ? <div className="up-tip">{msg}</div> : null}

            <p className="up-tip">
              迁移会在目标节点创建同名客户端（保留订阅链接、设备数、流量、到期时间），然后删除旧节点上的客户端。
            </p>

            <div className="up-actions">
              <button
                className="btn btn-primary"
                onClick={doMigrate}
                disabled={busy || !target}
                type="button"
              >
                {busy ? '迁移中…' : '确认迁移'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
                type="button"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
