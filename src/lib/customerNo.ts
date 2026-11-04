import type { Payload } from 'payload'

/**
 * 生成递增的 5 位客户编号：从 10000 起，每次随机增加 1–50，
 * 保证新编号永远大于已有编号。
 */
export async function nextCustomerNo(payload: Payload): Promise<number> {
  const result = await payload.find({
    collection: 'customers',
    sort: '-customerNo',
    limit: 1,
    depth: 0,
  })

  const last = Number((result.docs[0] as any)?.customerNo || 9999)

  if (last >= 99999) {
    throw new Error('客户编号已用尽')
  }

  const step = Math.floor(Math.random() * 50) + 1
  return Math.min(99999, last + step)
}
