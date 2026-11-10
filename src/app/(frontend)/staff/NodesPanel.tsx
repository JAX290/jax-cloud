'use client'

import { useState } from 'react'

export default function NodesPanel({
  nodes,
  panelHost = '100.124.251.8',
}: {
  nodes: any[]
  /** 主控的 Tailscale 地址（换服务器只改 .env 的 PANEL_HOST，不用动代码） */
  panelHost?: string
}) {
  const [ip, setIp] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function discover() {
    setLoading(true)
    setError('')
    setMsg('')
    setResult(null)
    try {
      const res = await fetch('/api/staff/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || '探测失败')
      setResult(data.data)
      setName(`节点-${ip.split('.').pop()}`)
    } catch (e: any) {
      setError(e?.message || '探测失败')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!result) return
    const ok = window.confirm(
      `确认保存节点？\n\nIP：${result.ip}\n面板：${result.ip}:${result.panelPort}/${result.panelPath}`,
    )
    if (!ok) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/staff/nodes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...result, name }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || '保存失败')
      setMsg(data.mode === 'created' ? '已新增节点' : '已更新节点')
      window.setTimeout(() => window.location.reload(), 700)
    } catch (e: any) {
      setError(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="staff-section">
      <h2 className="staff-h2">节点管理</h2>

      <div className="node-discover">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="新 VPS 公网 IP，如 1.2.3.4"
          inputMode="decimal"
        />
        <button className="staff-btn primary" onClick={discover} disabled={loading || !ip}>
          {loading ? '探测中…' : '探测'}
        </button>
      </div>

      {error ? <div className="cart-error">{error}</div> : null}
      {msg ? <div className="staff-done">{msg}</div> : null}

      {result ? (
        <div className="node-result">
          <div className="node-row">
            <span>IP</span>
            <b>{result.ip}</b>
          </div>
          <div className="node-row">
            <span>面板</span>
            <b>
              {result.ip}:{result.panelPort}/{result.panelPath}
            </b>
          </div>
          <div className="node-row">
            <span>面板版本</span>
            <b>{result.panelVersion || '—'}</b>
          </div>
          <div className="node-row">
            <span>订阅服务</span>
            <b>{result.subEnabled ? `${result.subPort} · ${result.subPath}` : '未开启'}</b>
          </div>
          <div className="node-row">
            <span>现有客户端</span>
            <b>{result.clientCount} 个</b>
          </div>
          <div className="node-save">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="节点名称" />
            <button className="staff-btn primary" onClick={save} disabled={saving}>
              {saving ? '保存中…' : '保存为节点'}
            </button>
          </div>
        </div>
      ) : null}

      {nodes.length ? (
        <div className="staff-list" style={{ marginTop: 16 }}>
          {nodes.map((n: any) => {
            // 主控端口反代：31000 + 节点 id，仅 Tailscale 内网可访问
            const proxyPort = 31000 + Number(n.id || 0)
            const panelPath = String(n.panelPath || 'jaxpanel').replace(/^\/+|\/+$/g, '')
            const panelUrl = `http://${panelHost}:${proxyPort}/${panelPath}/`
            return (
              <div className="staff-order" key={n.id}>
                <div className="staff-order-top">
                  <div>
                    <div className="staff-order-no">{n.name}</div>
                    <div className="staff-order-who">
                      {n.ip}
                      {n.region ? ` · ${n.region}` : ''}
                    </div>
                  </div>
                  <span
                    className={`staff-badge ${n.status === 'online' ? 'active' : 'expired'}`}
                  >
                    {n.status === 'online' ? '在线' : n.status === 'offline' ? '离线' : '维护'}
                  </span>
                </div>

                <div className="staff-node-rows">
                  <div>
                    <span>面板</span>
                    <b className="staff-mono">
                      {n.ip}:{n.panelPort || 2053}/{n.panelPath || 'jaxpanel'}
                    </b>
                  </div>
                  <div>
                    <span>订阅端口</span>
                    <b>{n.subPort || '—'}</b>
                  </div>
                  <div>
                    <span>客户端</span>
                    <b>{n.clientCount ?? 0} 个</b>
                  </div>
                </div>

                {n.note ? <div className="staff-note">备注：{n.note}</div> : null}

                <div className="staff-actions">
                  <a
                    className="staff-btn ghost"
                    href={panelUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开面板
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="staff-empty">还没有节点。上面输入 IP 探测。</div>
      )}
    </section>
  )
}
