/**
 * 续费套餐与报价（续费 = 加时长 + 流量累加）
 *
 * 定价（2026-11-08 与官网一致）：
 *   200G/月  ¥80   · 年付（12 个月）9 折 → ¥864
 *   1000G/月 ¥150  · 年付（12 个月）9 折 → ¥1620
 *
 * 生效规则：到期日在「现在」或「原到期日」两者较晚者上顺延；流量额度累加到原有额度。
 */

export type TrafficPack = {
  key: string
  label: string
  gbPerMonth: number
  pricePerMonth: number
}

export const TRAFFIC_PACKS: TrafficPack[] = [
  { key: '200', label: '200G / 月', gbPerMonth: 200, pricePerMonth: 80 },
  { key: '1000', label: '1000G / 月', gbPerMonth: 1000, pricePerMonth: 150 },
]

/** 年付折扣（12 个月按 9 折算） */
export const YEARLY_DISCOUNT = 0.9

export function findTrafficPack(key: string): TrafficPack | undefined {
  return TRAFFIC_PACKS.find((p) => p.key === String(key))
}

/** 可选续费月数（1–12） */
export const MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export type RenewQuote = {
  packKey: string
  packLabel: string
  months: number
  days: number
  trafficGB: number
  amount: number
  originalAmount: number
  savedAmount: number
  discountLabel: string
}

/** 报价：months 取 1–12；一次买满 12 个月按年付 9 折算（对外只说「立省 10%」） */
export function quoteRenewal(packKey: string, monthsRaw: number): RenewQuote | null {
  const pack = findTrafficPack(packKey)
  if (!pack) return null
  const months = Math.min(12, Math.max(1, Math.floor(Number(monthsRaw) || 1)))
  // 年付按 12 × 30 = 360 天（不是自然年）
  const days = months * 30
  const trafficGB = pack.gbPerMonth * months
  const originalAmount = pack.pricePerMonth * months
  const amount = months === 12 ? Math.round(originalAmount * YEARLY_DISCOUNT) : originalAmount
  return {
    packKey: pack.key,
    packLabel: pack.label,
    months,
    days,
    trafficGB,
    amount,
    originalAmount,
    savedAmount: originalAmount - amount,
    discountLabel: months === 12 ? '立省 10%' : '',
  }
}

/** 从客户端 email（10044-3）里解析客户号 */
export function customerNoFromEmail(email: string): number | null {
  const m = /^(\d+)-/.exec(String(email || ''))
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 到期后的宽限天数：这段时间节点上仍可用，只提醒不中断（默认 1 天） */
export const GRACE_DAYS = Number(process.env.GRACE_DAYS || 1)

/** 节点上的到期时间包含宽限期；对客户展示/提醒用「实际付费到期」= 节点到期 − 宽限 */
export function paidExpiry(expiryTime?: number): number {
  const v = Number(expiryTime || 0)
  if (!v) return 0
  return v - GRACE_DAYS * 24 * 3600 * 1000
}

/** 到期剩余天数（按付费到期算；无到期时间返回 null） */
export function daysToExpiry(expiryTime?: number, now = Date.now()): number | null {
  const v = paidExpiry(expiryTime)
  if (!v) return null
  return Math.ceil((v - now) / (24 * 60 * 60 * 1000))
}

/**
 * 流量使用比例（0~1）；不限流量返回 0。
 * 注意：3x-ui 返回的 totalGB 字段单位其实是「字节」，这里直接按字节比。
 */
export function trafficRatio(usedBytes: number, totalBytes: number): number {
  const total = Number(totalBytes || 0)
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, Number(usedBytes || 0) / total))
}
