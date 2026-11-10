/**
 * 客户端流量时序统计（按天聚合，折线图数据源）
 *
 * 数据来源：健康检查 cron 每 5 分钟读一次各节点客户端累计 up/down，
 * 这里算「本次 - 上次」的增量累加到当天，存成 JSON（data/traffic-history.json）。
 * 不用数据库是为了少一处 schema 迁移；客户端量小，JSON 也就几十 KB。
 *
 * 注意：3x-ui 的 up/down 是「自客户端创建（或最近一次流量重置）以来的累计字节」，
 * 遇到计数器回退（流量被重置）时跳过，不做负增量。
 */
import fs from 'node:fs'
import path from 'node:path'

export type DayTraffic = { day: string; used: number }

type ClientHistory = {
  state?: { up: number; down: number; ts: number }
  days?: Record<string, { up: number; down: number }>
}

type Store = { clients: Record<string, ClientHistory> }

const MAX_DAYS = 366

function storePath(): string {
  const url = process.env.DATABASE_URL || ''
  const m = /^file:(.+)$/.exec(url)
  const p = m ? m[1] : 'data'
  const dir = path.dirname(p.startsWith('/') ? p : path.resolve(process.cwd(), p))
  return path.join(dir, 'traffic-history.json')
}

function readStore(): Store {
  try {
    const raw = fs.readFileSync(storePath(), 'utf8')
    const j = JSON.parse(raw)
    return j && j.clients ? (j as Store) : { clients: {} }
  } catch {
    return { clients: {} }
  }
}

function writeStore(s: Store): void {
  try {
    const file = storePath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(s))
    fs.renameSync(tmp, file)
  } catch {
    /* 统计写失败不影响主流程 */
  }
}

/** 北京时间（UTC+8，无夏令时）的日期 key：YYYY-MM-DD */
function shanghaiDateKey(ts = Date.now()): string {
  return new Date(ts + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 健康检查时调用：把本周期增量记到当天 */
export function recordTraffic(email: string, up: number, down: number, ts = Date.now()): void {
  const e = String(email || '').trim()
  if (!e) return
  const u = Math.max(0, Number(up) || 0)
  const d = Math.max(0, Number(down) || 0)

  const store = readStore()
  const h = store.clients[e] || {}
  const st = h.state

  // 累计量正常增长才记增量；计数器回退（流量重置）跳过
  if (st && u + d >= (st.up || 0) + (st.down || 0)) {
    const du = u - (st.up || 0)
    const dd = d - (st.down || 0)
    if (du + dd > 0) {
      const day = shanghaiDateKey(ts)
      h.days = h.days || {}
      const bucket = h.days[day] || { up: 0, down: 0 }
      bucket.up += du
      bucket.down += dd
      h.days[day] = bucket

      // 只留最近 MAX_DAYS 天
      const cutoff = shanghaiDateKey(ts - MAX_DAYS * 86400000)
      for (const k of Object.keys(h.days)) {
        if (k < cutoff) delete h.days[k]
      }
    }
  }

  h.state = { up: u, down: d, ts }
  store.clients[e] = h
  writeStore(store)
}

/** 读最近 N 天的日用量（缺的日子补 0），返回按时间升序 */
export function readTrafficSeries(email: string, days = 30): DayTraffic[] {
  const e = String(email || '').trim()
  const store = readStore()
  const h = store.clients[e]
  const out: DayTraffic[] = []
  const now = Date.now()
  for (let i = days - 1; i >= 0; i--) {
    const key = shanghaiDateKey(now - i * 86400000)
    const b = h?.days?.[key]
    out.push({ day: key, used: b ? (b.up || 0) + (b.down || 0) : 0 })
  }
  return out
}
