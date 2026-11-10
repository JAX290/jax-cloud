const WEBHOOK = process.env.WECOM_WEBHOOK || ''

export type WecomResult = { ok: boolean; error?: string }

/**
 * 企业微信群机器人推送（markdown 格式）
 * 未配置 WECOM_WEBHOOK 时静默跳过，不影响主流程。
 */
export async function sendWecom(markdown: string): Promise<WecomResult> {
  if (!WEBHOOK) return { ok: false, error: 'WECOM_WEBHOOK not configured' }
  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { content: markdown },
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { errcode?: number; errmsg?: string }
    if (json?.errcode && json.errcode !== 0) {
      return { ok: false, error: json.errmsg || `errcode ${json.errcode}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' }
  }
}
