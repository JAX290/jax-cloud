/**
 * IndexNow 主动推送（Bing / Yandex / Seznam 等共用协议）
 *
 * 用途：后台发布或更新内容后，立刻告诉搜索引擎「这些 URL 变了，来抓」，
 * 不用等它自己按 sitemap 慢慢发现。Bing 的索引同时喂 DuckDuckGo 和部分 AI 搜索。
 *
 * key 文件放在 public/<key>.txt（https://cloud.jax.markets/<key>.txt），
 * key 本身是公开信息，不算密钥。
 */
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '7579c897d70d4db7a226987e43911a43'

const SITE = (process.env.SERVER_URL || 'https://cloud.jax.markets').replace(/\/$/, '')

export type IndexNowResult = { ok: boolean; status?: number; error?: string }

/** 把一批 URL（可以是相对路径）推给 IndexNow 网关 */
export async function notifyIndexNow(urls: string[]): Promise<IndexNowResult> {
  const list = Array.from(
    new Set(
      (urls || [])
        .filter(Boolean)
        .map((u) => (u.startsWith('http') ? u : `${SITE}${u.startsWith('/') ? u : `/${u}`}`)),
    ),
  )
  if (!list.length) return { ok: false, error: 'empty url list' }

  let host = 'cloud.jax.markets'
  try {
    host = new URL(SITE).host
  } catch {
    /* 用默认 host */
  }

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
        urlList: list,
      }),
      signal: AbortSignal.timeout(8000),
    })
    // 200 / 202 都算受理
    return { ok: res.ok, status: res.status }
  } catch (e: any) {
    // 推送失败不影响发布流程
    console.error('[indexnow] push failed:', e?.message || e)
    return { ok: false, error: e?.message || 'network error' }
  }
}
