import type { NextRequest } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { sweepTrials } from '@/lib/trial'
import { sendWecom } from '@/lib/wecom'

export const dynamic = 'force-dynamic'

/**
 * 体验账号巡检（cron 每 5 分钟）
 *
 * - 到期（1 小时）或流量用完（1G）→ 把节点上的客户端 enable=false，标记 trialStopped
 * - 有停用动作时推企业微信，方便运营知道谁在领体验
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || 'jax-health-20261108'
  const provided = req.nextUrl.searchParams.get('secret') || ''
  if (provided !== secret) {
    return Response.json({ ok: false, message: 'forbidden' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const stopped = await sweepTrials(payload)

  if (stopped.length) {
    const lines = stopped
      .map((s) => `- 客户 #${s.customerNo}（${s.reason}）`)
      .join('\n')
    try {
      await sendWecom(`### 体验账号已停用\n1 小时体验到期/超流量，已自动停用：\n${lines}`)
    } catch {
      /* 推送失败不影响停用 */
    }
  }

  return Response.json({ ok: true, checked: new Date().toISOString(), stopped })
}
