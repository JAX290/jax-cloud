import { createHash, randomInt } from 'node:crypto'

import { verifyCaptcha } from './captcha'
import { renderMail, renderMailText } from './mail-templates'

/** 验证码有效期（分钟） */
export const CODE_TTL_MINUTES = 10
/** 同一个邮箱两次发送的最小间隔（秒） */
export const CODE_RESEND_SECONDS = 60
/** 最多尝试次数 */
export const CODE_MAX_ATTEMPTS = 5

export type CodePurpose = 'register' | 'reset'

function hashCode(email: string, purpose: CodePurpose, code: string) {
  const salt = process.env.CRON_SECRET || 'jax-code-salt'
  return createHash('sha256').update(`${salt}:${purpose}:${String(email).toLowerCase()}:${code}`).digest('hex')
}

function normalize(email: string) {
  return String(email || '').trim().toLowerCase()
}

export function genCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

/** 发送验证码（内部会做图形码校验 + 频率限制 + 落库 + 发邮件） */
export async function sendCode(
  payload: any,
  emailRaw: string,
  purpose: CodePurpose,
  opts: { captchaId?: any; captchaCode?: any; ip?: string; humanVerified?: boolean } = {},
): Promise<{ ok: boolean; error?: string }> {
  const email = normalize(emailRaw)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: '邮箱格式不对' }
  }

  // 1) 人机验证：路由层已验过 Turnstile 就跳过；否则校验图形码（降级模式）
  if (!opts.humanVerified) {
    const captcha = await verifyCaptcha(payload, opts.captchaId, opts.captchaCode)
    if (!captcha.ok) return { ok: false, error: captcha.error }
  }

  const ip = String(opts.ip || '').slice(0, 64)

  // 2) 频率限制
  const now = Date.now()
  const since = (ms: number) => new Date(now - ms).toISOString()
  const count = async (where: any) => {
    try {
      const res: any = await payload.find({
        collection: 'email-codes',
        where,
        limit: 0,
        overrideAccess: true,
      })
      return Number(res.totalDocs || 0)
    } catch {
      return 0
    }
  }

  // 同一邮箱 60 秒一次
  if ((await count({ and: [{ email: { equals: email } }, { createdAt: { greater_than: since(60 * 1000) } }] })) > 0) {
    return { ok: false, error: '刚发过一次，请 60 秒后再试' }
  }
  // 同一邮箱 1 小时最多 3 次
  if ((await count({ and: [{ email: { equals: email } }, { createdAt: { greater_than: since(3600 * 1000) } }] })) >= 3) {
    return { ok: false, error: '这个邮箱一小时只能发 3 次验证码，稍后再试' }
  }
  // 同一邮箱 1 天最多 8 次
  if ((await count({ and: [{ email: { equals: email } }, { createdAt: { greater_than: since(24 * 3600 * 1000) } }] })) >= 8) {
    return { ok: false, error: '这个邮箱今天发得太多了，明天再试或直接找客服' }
  }
  // 同一 IP 1 小时最多 10 次（防止换邮箱刷）
  if (ip && ip !== 'unknown') {
    if ((await count({ and: [{ ip: { equals: ip } }, { createdAt: { greater_than: since(3600 * 1000) } }] })) >= 10) {
      return { ok: false, error: '当前网络请求太频繁，1 小时后再试' }
    }
  }

  // 注册场景：邮箱已注册就直接拒绝
  if (purpose === 'register') {
    try {
      const exists: any = await payload.find({
        collection: 'customers',
        where: { email: { equals: email } },
        limit: 1,
        overrideAccess: true,
      })
      if ((exists.docs || []).length) {
        return { ok: false, error: '这个邮箱已经注册过了，直接登录就行' }
      }
    } catch {
      /* ignore */
    }
  }

  const code = genCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString()

  try {
    await payload.create({
      collection: 'email-codes',
      data: {
        email,
        purpose,
        codeHash: hashCode(email, purpose, code),
        expiresAt,
        ip,
      },
      overrideAccess: true,
    })
  } catch (e: any) {
    return { ok: false, error: `验证码保存失败：${e?.message || '未知错误'}` }
  }

  const title = purpose === 'register' ? '注册验证码' : '重置密码验证码'
  try {
    await payload.sendEmail({
      to: email,
      subject: `${title} · JAX CLOUD（${code}）`,
      html: renderMail({
        title,
        body: `
          <p>你好：</p>
          <p>你正在${purpose === 'register' ? '注册 JAX CLOUD 账号' : '重置 JAX CLOUD 密码'}，验证码是：</p>
          <p style="font-size:30px;letter-spacing:8px;font-weight:700;color:#0aa7c2;margin:18px 0">${code}</p>
          <p style="color:#6b7f92;font-size:13px">${CODE_TTL_MINUTES} 分钟内有效。如果不是你本人操作，忽略这封邮件即可。</p>
        `,
        footerNote: '为了账号安全，验证码不要转发给别人。',
      }),
      text: renderMailText({
        title,
        lines: [
          `你正在${purpose === 'register' ? '注册 JAX CLOUD 账号' : '重置 JAX CLOUD 密码'}。`,
          `验证码：${code}`,
          `${CODE_TTL_MINUTES} 分钟内有效。如果不是你本人操作，忽略这封邮件即可。`,
        ],
      }),
    })
  } catch (e: any) {
    return { ok: false, error: `邮件发送失败：${e?.message || '未知错误'}` }
  }

  return { ok: true }
}

/** 校验并消费验证码（成功即作废） */
export async function consumeCode(
  payload: any,
  emailRaw: string,
  purpose: CodePurpose,
  codeRaw: string,
): Promise<{ ok: boolean; error?: string }> {
  const email = normalize(emailRaw)
  const code = String(codeRaw || '').trim()
  if (!/^\d{6}$/.test(code)) return { ok: false, error: '请输入 6 位数字验证码' }

  let docs: any[] = []
  try {
    const res: any = await payload.find({
      collection: 'email-codes',
      where: {
        and: [
          { email: { equals: email } },
          { purpose: { equals: purpose } },
          { usedAt: { exists: false } },
        ],
      },
      sort: '-createdAt',
      limit: 3,
      overrideAccess: true,
    })
    docs = (res.docs || []) as any[]
  } catch {
    return { ok: false, error: '验证码校验失败，请重新获取' }
  }

  const now = Date.now()
  for (const doc of docs) {
    const expired = !doc.expiresAt || Date.parse(doc.expiresAt) < now
    const attempts = Number(doc.attempts || 0)
    if (expired || attempts >= CODE_MAX_ATTEMPTS) continue
    const ok = doc.codeHash === hashCode(email, purpose, code)
    if (ok) {
      await payload.update({
        collection: 'email-codes',
        id: doc.id,
        data: { usedAt: new Date().toISOString() },
        overrideAccess: true,
      })
      return { ok: true }
    }
    await payload.update({
      collection: 'email-codes',
      id: doc.id,
      data: { attempts: attempts + 1 },
      overrideAccess: true,
    })
  }

  return { ok: false, error: '验证码不对或已过期，重新获取一次' }
}
