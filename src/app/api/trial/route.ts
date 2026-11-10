import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { claimTrial, TRIAL_GB, TRIAL_HOURS, trialSubUrl } from '@/lib/trial'

export const dynamic = 'force-dynamic'

function remainingSeconds(expiresAt?: string) {
  if (!expiresAt) return 0
  const ms = Date.parse(expiresAt) - Date.now()
  return ms > 0 ? Math.ceil(ms / 1000) : 0
}

/** GET：查当前客户的体验状态（账户页用） */
export async function GET() {
  const payload = await getPayload({ config })
  const headers = await nextHeaders()
  const { user } = await payload.auth({ headers })
  if (!user || user.collection !== 'customers') {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const c: any = user
  return Response.json({
    ok: true,
    used: Boolean(c.trialUsed),
    stopped: Boolean(c.trialStopped),
    expiresAt: c.trialExpiresAt || null,
    remainingSeconds: remainingSeconds(c.trialExpiresAt),
    subUrl: c.trialSubId ? trialSubUrl(c.trialSubId) : null,
    hours: TRIAL_HOURS,
    gb: TRIAL_GB,
  })
}

/** POST：领取体验（每个账号一次） */
export async function POST() {
  const payload = await getPayload({ config })
  const headers = await nextHeaders()
  const { user } = await payload.auth({ headers })
  if (!user || user.collection !== 'customers') {
    return Response.json({ ok: false, error: '请先登录' }, { status: 401 })
  }

  const customer: any = user
  const result = await claimTrial(payload, customer)
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400 })
  }
  return Response.json({
    ok: true,
    subUrl: result.subUrl,
    expiresAt: result.expiresAt,
    nodeName: result.nodeName,
    hours: TRIAL_HOURS,
    gb: TRIAL_GB,
  })
}
