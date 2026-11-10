'use client'

import { useMemo, useState } from 'react'

export type TrafficSeriesPoint = { day: string; used: number }

type PeriodKey = 'day' | 'week' | 'month'

type Bucket = { label: string; start: string; used: number; cum: number }

const PERIODS: Array<{ key: PeriodKey; label: string; limit: number }> = [
  { key: 'day', label: '日', limit: 30 },
  { key: 'week', label: '周', limit: 12 },
  { key: 'month', label: '月', limit: 12 },
]

function fmtBytes(v: number): string {
  const n = Number(v || 0)
  if (n <= 0) return '0'
  const gb = n / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)}G`
  const mb = n / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(0)}M`
  return `${Math.max(1, Math.round(n / 1024))}K`
}

function fmtShort(day: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day)
  return m ? `${m[1]}/${m[2]}` : day
}

function mondayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = date.getUTCDay()
  const monday = new Date(date.getTime() - ((dow + 6) % 7) * 86400000)
  return monday.toISOString().slice(0, 10)
}

function bucketize(series: TrafficSeriesPoint[], period: PeriodKey, limit: number): Bucket[] {
  const map = new Map<string, { start: string; used: number }>()
  for (const s of series) {
    const key = period === 'day' ? s.day : period === 'week' ? mondayOf(s.day) : s.day.slice(0, 7)
    const cur = map.get(key) || { start: key, used: 0 }
    cur.used += s.used
    map.set(key, cur)
  }
  const keys = Array.from(map.keys()).sort()
  let cum = 0
  const out: Bucket[] = keys.slice(-limit).map((k) => {
    const b = map.get(k)!
    cum += b.used
    const label =
      period === 'month' ? `${Number(k.slice(5, 7))}月` : fmtShort(k)
    return { label, start: k, used: b.used, cum }
  })
  return out
}

const W = 400
const H = 150
const PAD_X = 8
const PAD_Y = 10

export default function TrafficChart({
  series,
  totalUsed,
  totalGB,
}: {
  series: TrafficSeriesPoint[]
  totalUsed: number
  totalGB: number
}) {
  const [period, setPeriod] = useState<PeriodKey>('day')
  const [hover, setHover] = useState<number | null>(null)

  const buckets = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period)!
    return bucketize(series, period, p.limit)
  }, [series, period])

  const n = Math.max(1, buckets.length)
  const maxUsed = Math.max(1, ...buckets.map((b) => b.used))
  const maxCum = Math.max(1, ...buckets.map((b) => b.cum))

  const xAt = (i: number) => PAD_X + (i / (n - 1)) * (W - PAD_X * 2)
  const yUsed = (v: number) => H - PAD_Y - (v / maxUsed) * (H - PAD_Y * 2)
  const yCum = (v: number) => H - PAD_Y - (v / maxCum) * (H - PAD_Y * 2)

  const barW = Math.max(2, Math.min(22, ((W - PAD_X * 2) / n) * 0.62))

  const cumPts = buckets.map((b, i) => `${xAt(i).toFixed(1)},${yCum(b.cum).toFixed(1)}`).join(' ')

  const remain = totalGB > 0 ? Math.max(0, totalGB - totalUsed) : 0
  const pct = totalGB > 0 ? Math.min(100, Math.round((totalUsed / totalGB) * 100)) : 0

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHover(Math.round(ratio * (n - 1)))
  }

  const hb = hover !== null ? buckets[hover] : null

  return (
    <div className="traffic-chart">
      <div className="traffic-summary">
        <span>
          累计 <b>{fmtBytes(totalUsed)}</b>
          {totalGB > 0 ? ` / ${fmtBytes(totalGB)}` : ' / 不限'}
        </span>
        {totalGB > 0 ? (
          <span>
            剩余 <b>{fmtBytes(remain)}</b>（{pct}% 已用）
          </span>
        ) : null}
        <span className="traffic-legend">
          <i className="dot-bar" /> 用量
          <i className="dot-line" /> 累计
        </span>
      </div>

      <div className="traffic-toolbar">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={period === p.key ? 'on' : ''}
            onClick={() => {
              setPeriod(p.key)
              setHover(null)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="traffic-plot" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {hb ? (
          <div
            className="traffic-tooltip"
            style={{ left: `${Math.min(84, Math.max(16, (xAt(hover!) / W) * 100))}%` }}
          >
            <b>{hb.label}</b>
            <span>用量 {fmtBytes(hb.used)}</span>
            <span>累计 {fmtBytes(hb.cum)}</span>
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="traffic-svg"
          role="img"
          aria-label="流量统计图"
        >
          <line
            x1={PAD_X}
            y1={H - PAD_Y}
            x2={W - PAD_X}
            y2={H - PAD_Y}
            stroke="rgba(0,229,255,.16)"
            strokeWidth="1"
          />
          {/* 用量柱（K 线感） */}
          {buckets.map((b, i) => {
            const top = yUsed(b.used)
            return (
              <rect
                key={b.start}
                x={xAt(i) - barW / 2}
                y={top}
                width={barW}
                height={Math.max(1, H - PAD_Y - top)}
                rx={1.5}
                fill={hover === i ? 'rgba(0,229,255,.55)' : 'rgba(0,229,255,.22)'}
              />
            )
          })}
          {/* 累计折线 */}
          <polyline
            points={cumPts}
            fill="none"
            stroke="var(--green,#39ff88)"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* 十字光标 */}
          {hover !== null && hb ? (
            <g>
              <line
                x1={xAt(hover)}
                y1={0}
                x2={xAt(hover)}
                y2={H - PAD_Y}
                stroke="rgba(255,255,255,.45)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle cx={xAt(hover)} cy={yUsed(hb.used)} r="3.5" fill="var(--cyan,#00e5ff)" />
              <circle cx={xAt(hover)} cy={yCum(hb.cum)} r="3" fill="var(--green,#39ff88)" />
            </g>
          ) : null}
        </svg>
        <div className="traffic-axis">
          <span>{buckets.length ? buckets[0].label : ''}</span>
          <span>{buckets.length ? buckets[Math.floor((n - 1) / 2)].label : ''}</span>
          <span>{buckets.length ? buckets[n - 1].label : ''}</span>
        </div>
      </div>
    </div>
  )
}
