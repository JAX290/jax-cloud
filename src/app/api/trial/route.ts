import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { renderMail, renderMailText } from '@/lib/mail-templates'
import { sendMail } from '@/lib/mailer'
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

  // 体验开通邮件（客户可能已经离开页面，邮件里带订阅链接）
  try {
    if (customer.email && result.subUrl) {
      await sendMail(payload, {
        to: customer.email,
        type: 'trial_welcome',
        customerId: customer.id,
        dedupeKey: `trial-${customer.id}`,
        subject: `体验已开通：${TRIAL_HOURS} 小时 / ${TRIAL_GB}G`,
        html: renderMail({
          title: '体验环境已开通',
          body: `
            <p>你好${customer.name ? `，${customer.name}` : ''}：</p>
            <p>你的体验环境已经开好了，<b>${TRIAL_HOURS} 小时</b>内、总流量 <b>${TRIAL_GB}G</b>，到期自动停用，不用付款。</p>
            <p>订阅链接（复制到客户端导入）：</p>
            <p style="word-break:break-all;background:#f2f7fa;padding:10px 12px;border-radius:8px;font-size:13px">${result.subUrl}</p>
          `,
          footerNote: '如果 1 小时内没空测，到期后随时可以重新领正式套餐。',
        }),
        text: renderMailText({
          title: '体验环境已开通',
          lines: [`时长：${TRIAL_HOURS} 小时 · 流量：${TRIAL_GB}G`, `订阅链接：${result.subUrl}`],
        }),
      })
    }
  } catch {
    /* 邮件失败不影响开通 */
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
