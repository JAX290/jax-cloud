import { sendWecom } from './wecom'

/**
 * 邮件发送中心
 *
 * 所有发给客户的邮件都从这里走，统一做：
 * 1. 每客户每天上限（默认 3 封，验证码除外）
 * 2. 同类邮件去重（默认 3 天内不重复）
 * 3. 全站每天上限（默认 300 封，超了只发关键邮件 + 企业微信告警）
 * 4. 落库 mail-logs（成功/失败/跳过都能查）
 */

export type MailType =
  | 'verify_code'
  | 'welcome'
  | 'order_pending'
  | 'order_active'
  | 'renew_success'
  | 'expiry_7d'
  | 'expiry_1d'
  | 'expiry_day'
  | 'traffic_80'
  | 'traffic_90'
  | 'trial_welcome'
  | 'sub_reset'
  | 'ticket_reply'
  | 'order_cancelled'
  | 'password_changed'

/** 关键邮件：不受每日上限限制（但受全站上限的部分保护策略影响最小） */
const CRITICAL: MailType[] = ['verify_code', 'order_active', 'renew_success', 'expiry_day', 'sub_reset']

const DAILY_PER_USER = Number(process.env.MAIL_DAILY_PER_USER || 3)
const DAILY_TOTAL = Number(process.env.MAIL_DAILY_TOTAL || 300)
const DEDUPE_DAYS = Number(process.env.MAIL_DEDUPE_DAYS || 3)

const TYPE_LABEL: Record<string, string> = {
  verify_code: '验证码',
  welcome: '欢迎',
  order_pending: '待支付提醒',
  order_active: '开通通知',
  renew_success: '续费成功',
  expiry_7d: '到期前 7 天',
  expiry_1d: '到期前 1 天',
  expiry_day: '到期当天',
  traffic_80: '流量 80%',
  traffic_90: '流量 90%',
  trial_welcome: '体验开通',
  sub_reset: '订阅重置',
  ticket_reply: '工单回复',
  order_cancelled: '订单取消',
  password_changed: '密码修改',
}

function startOfToday() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
}

async function countLogs(payload: any, where: any): Promise<number> {
  try {
    const res: any = await payload.find({
      collection: 'mail-logs',
      where,
      limit: 0,
      overrideAccess: true,
    })
    return Number(res.totalDocs || 0)
  } catch {
    return 0
  }
}

export type SendMailOptions = {
  to: string
  type: MailType
  subject: string
  html: string
  text?: string
  customerId?: number
  /** 同一类邮件里的细分 key（例如 "10044-renew-7d"），用于去重 */
  dedupeKey?: string
  /** 邮件头部自定义字段 */
  headers?: Record<string, string>
}

export type SendMailResult = { ok: boolean; skipped?: string; error?: string }

export async function sendMail(payload: any, opts: SendMailOptions): Promise<SendMailResult> {
  const to = String(opts.to || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, skipped: 'invalid-email' }
  }
  const critical = CRITICAL.includes(opts.type)
  const dedupeKey = opts.dedupeKey || ''

  // 1) 去重：同一收件人 + 同类型 + 同 key，N 天内不重复
  if (dedupeKey && DEDUPE_DAYS > 0) {
    const since = new Date(Date.now() - DEDUPE_DAYS * 24 * 3600 * 1000).toISOString()
    const dup = await countLogs(payload, {
      and: [
        { to: { equals: to } },
        { type: { equals: opts.type } },
        { dedupeKey: { equals: dedupeKey } },
        { createdAt: { greater_than: since } },
        { status: { not_equals: 'skipped' } },
      ],
    })
    if (dup > 0) {
      await logMail(payload, opts, 'skipped', 'duplicate')
      return { ok: false, skipped: 'duplicate' }
    }
  }

  // 2) 每客户每天上限（验证码和关键邮件除外）
  if (!critical && DAILY_PER_USER > 0) {
    const today = startOfToday()
    const where: any = {
      and: [{ to: { equals: to } }, { createdAt: { greater_than: today } }, { type: { not_equals: 'verify_code' } }],
    }
    if ((await countLogs(payload, where)) >= DAILY_PER_USER) {
      await logMail(payload, opts, 'skipped', 'daily-cap')
      return { ok: false, skipped: 'daily-cap' }
    }
  }

  // 3) 全站每天上限：超了只发关键邮件，并告警一次
  if (DAILY_TOTAL > 0) {
    const total = await countLogs(payload, { and: [{ createdAt: { greater_than: startOfToday() } }, { status: { equals: 'sent' } }] })
    if (total >= DAILY_TOTAL && !critical) {
      await logMail(payload, opts, 'skipped', 'global-cap')
      try {
        await sendWecom(`⚠️ **邮件发送量已达今日上限 ${DAILY_TOTAL} 封**\n已暂停非关键邮件，请检查是否异常（注册/找回密码被刷？）`)
      } catch {
        /* ignore */
      }
      return { ok: false, skipped: 'global-cap' }
    }
  }

  // 4) 真正发送
  try {
    await payload.sendEmail({
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      ...(opts.headers ? { headers: opts.headers } : {}),
    })
    await logMail(payload, opts, 'sent')
    return { ok: true }
  } catch (e: any) {
    const error = String(e?.message || e).slice(0, 300)
    await logMail(payload, opts, 'failed', error)
    return { ok: false, error }
  }
}

async function logMail(
  payload: any,
  opts: SendMailOptions,
  status: 'sent' | 'failed' | 'skipped',
  error?: string,
): Promise<void> {
  try {
    await payload.create({
      collection: 'mail-logs',
      data: {
        to: opts.to,
        type: opts.type,
        subject: opts.subject,
        status,
        error: error || undefined,
        customerId: opts.customerId,
        dedupeKey: opts.dedupeKey,
      },
      overrideAccess: true,
    })
  } catch {
    /* 日志失败不影响发信 */
  }
}

export function mailTypeLabel(type: string) {
  return TYPE_LABEL[type] || type
}
