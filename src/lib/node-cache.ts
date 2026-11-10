/**
 * 节点客户端快照缓存
 *
 * 目的：节点离线时拿不到面板数据，但还要能告诉运营「哪些客户受影响」，
 * 所以每次健康检查成功时把该节点的客户端列表（脱敏后）写到 data/node-clients-cache.json。
 * 文件很小（每节点几十行），读写直接同步 fs 即可。
 */
import fs from 'node:fs'
import path from 'node:path'

export type CachedClient = {
  email: string
  totalGB?: number
  expiryTime?: number
  enable?: boolean
  limitIp?: number
  usedBytes?: number
}

export type NodeCacheEntry = {
  at: string
  name?: string
  ip?: string
  clients: CachedClient[]
}

export type NodeCache = Record<string, NodeCacheEntry>

function dataDir(): string {
  // 容器里 DATABASE_URL=file:/app/data/jax.db → /app/data；本地开发是 file:./jax.db
  const url = process.env.DATABASE_URL || ''
  const m = /^file:(.+)$/.exec(url)
  if (m) {
    const p = m[1]
    return path.dirname(p.startsWith('/') ? p : path.resolve(process.cwd(), p))
  }
  return path.resolve(process.cwd(), 'data')
}

export function nodeCachePath(): string {
  return path.join(dataDir(), 'node-clients-cache.json')
}

export function readNodeCache(): NodeCache {
  try {
    const raw = fs.readFileSync(nodeCachePath(), 'utf8')
    const json = JSON.parse(raw)
    return json && typeof json === 'object' ? (json as NodeCache) : {}
  } catch {
    return {}
  }
}

/** 健康检查成功时调用：记录该节点当前客户端快照 */
export function writeNodeCache(
  node: { id: number | string; name?: string; ip: string },
  clients: any[],
): void {
  try {
    const cache = readNodeCache()
    cache[String(node.id)] = {
      at: new Date().toISOString(),
      name: node.name,
      ip: node.ip,
      clients: (clients || []).map((c) => ({
        email: String(c?.email || ''),
        totalGB: Number(c?.totalGB || 0),
        expiryTime: Number(c?.expiryTime || 0),
        enable: c?.enable !== false,
        limitIp: Number(c?.limitIp || 0),
        usedBytes: Number(c?.traffic?.up || 0) + Number(c?.traffic?.down || 0),
      })),
    }
    const file = nodeCachePath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(cache))
    fs.renameSync(tmp, file)
  } catch {
    /* 缓存写失败不影响主流程 */
  }
}

/** 从缓存里找某个客户在指定节点上的客户端 */
export function cachedClientGroupsForCustomer(
  cache: NodeCache,
  nodeIds: Array<string | number>,
  customerNo: number,
): Array<{ nodeId: string; nodeName: string; clients: CachedClient[] }> {
  const prefix = `${customerNo}-`
  const out: Array<{ nodeId: string; nodeName: string; clients: CachedClient[] }> = []
  for (const id of nodeIds) {
    const entry = cache[String(id)]
    if (!entry?.clients?.length) continue
    const clients = entry.clients.filter((c) => String(c.email || '').startsWith(prefix))
    if (clients.length) {
      out.push({ nodeId: String(id), nodeName: entry.name || String(id), clients })
    }
  }
  return out
}
