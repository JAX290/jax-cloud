import { createHash, randomInt } from 'node:crypto'

import sharp from 'sharp'

/** 验证码有效期（分钟） */
const TTL_MINUTES = 5
/** 字符集：去掉容易看混的 0/O/1/I */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function hashCode(code: string) {
  const salt = process.env.CRON_SECRET || 'jax-captcha-salt'
  return createHash('sha256').update(`${salt}:captcha:${code.toUpperCase()}`).digest('hex')
}

function rand(min: number, max: number) {
  return randomInt(min, max + 1)
}

function buildSvg(code: string): string {
  const width = 132
  const height = 44
  const chars = code.split('')
  const parts: string[] = []
  // 背景
  parts.push(`<rect width="${width}" height="${height}" fill="#0b1626"/>`)
  // 干扰线
  for (let i = 0; i < 4; i++) {
    parts.push(
      `<line x1="${rand(0, width)}" y1="${rand(0, height)}" x2="${rand(0, width)}" y2="${rand(0, height)}" stroke="#1f3b55" stroke-width="1"/>`,
    )
  }
  // 干扰点
  for (let i = 0; i < 24; i++) {
    parts.push(
      `<circle cx="${rand(0, width)}" cy="${rand(0, height)}" r="${rand(1, 2)}" fill="#20415c"/>`,
    )
  }
  // 字符：随机大小/旋转/位置/颜色
  const colors = ['#22d3ee', '#67e8f9', '#a5f3fc', '#38bdf8']
  chars.forEach((ch, i) => {
    const x = 14 + i * 28 + rand(-3, 3)
    const y = rand(26, 36)
    const rotate = rand(-18, 18)
    const size = rand(22, 27)
    const color = colors[rand(0, colors.length - 1)]
    parts.push(
      `<text x="${x}" y="${y}" font-family="Verdana,Arial,sans-serif" font-size="${size}" font-weight="700" fill="${color}" transform="rotate(${rotate} ${x} ${y})">${ch}</text>`,
    )
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
}

export type CaptchaResult = { ok: boolean; id?: number; image?: string; code?: string; error?: string }

/** 生成图形验证码：落库哈希 + 返回 PNG（base64 dataURL） */
export async function createCaptcha(payload: any, ip: string): Promise<CaptchaResult> {
  const code = Array.from({ length: 4 }, () => ALPHABET[rand(0, ALPHABET.length - 1)]).join('')
  try {
    const png = await sharp(Buffer.from(buildSvg(code))).png().toBuffer()
    const doc: any = await payload.create({
      collection: 'captchas',
      data: {
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString(),
        ip: String(ip || ''),
      },
      overrideAccess: true,
    })
    return { ok: true, id: doc.id, image: `data:image/png;base64,${png.toString('base64')}`, code }
  } catch (e: any) {
    return { ok: false, error: e?.message || '生成验证码失败' }
  }
}

/** 校验并消费图形验证码 */
export async function verifyCaptcha(
  payload: any,
  idRaw: any,
  codeRaw: any,
): Promise<{ ok: boolean; error?: string }> {
  const id = Number(idRaw || 0)
  const code = String(codeRaw || '').trim().toUpperCase()
  if (!id || code.length !== 4) return { ok: false, error: '先填对图形验证码' }

  try {
    const doc: any = await payload.findByID({ collection: 'captchas', id, overrideAccess: true })
    if (!doc || doc.usedAt) return { ok: false, error: '图形验证码已失效，换一张' }
    if (!doc.expiresAt || Date.parse(doc.expiresAt) < Date.now()) {
      return { ok: false, error: '图形验证码过期了，换一张' }
    }
    if (doc.codeHash !== hashCode(code)) return { ok: false, error: '图形验证码不对' }
    await payload.update({
      collection: 'captchas',
      id,
      data: { usedAt: new Date().toISOString() },
      overrideAccess: true,
    })
    return { ok: true }
  } catch {
    return { ok: false, error: '图形验证码校验失败，换一张' }
  }
}
