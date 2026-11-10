'use server'

import { headers as getHeaders } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { clientIpFromHeaders, isTailscaleIp } from '@/lib/tailscale'

async function requireTailscale() {
  const headers = await getHeaders()
  const ip = clientIpFromHeaders(headers)
  if (!isTailscaleIp(ip)) {
    throw new Error('仅限内网访问')
  }
  return getPayload({ config })
}

/** 确认收款（可同时修改金额/套餐/天数/流量/设备数），状态改为 paid 后自动开通 */
export async function confirmOrder(formData: FormData) {
  const payload = await requireTailscale()
  const id = Number(formData.get('id'))
  if (!id) throw new Error('缺少订单 ID')

  const operator = String(formData.get('operator') || 'tailscale')
  const data: any = {
    status: 'paid',
    operator,
  }

  const amount = formData.get('amount')
  const plan = formData.get('plan')
  const days = formData.get('days')
  const trafficGB = formData.get('trafficGB')
  const ipLimit = formData.get('ipLimit')
  const note = formData.get('note')

  if (amount !== null && String(amount).trim() !== '') data.amount = Number(amount)
  if (plan) data.plan = String(plan)
  if (days !== null && String(days).trim() !== '') data.days = Number(days)
  if (trafficGB !== null && String(trafficGB).trim() !== '') data.trafficGB = Number(trafficGB)
  if (ipLimit !== null && String(ipLimit).trim() !== '') data.ipLimit = Number(ipLimit)
  if (note !== null) data.note = String(note)

  // 记录修改内容
  const order: any = await payload.findByID({
    collection: 'orders',
    id,
    depth: 0,
    overrideAccess: true,
  })
  const diffs: string[] = []
  if (order) {
    if (data.amount !== undefined && Number(order.amount) !== data.amount) {
      diffs.push(`金额 ${order.amount} → ${data.amount}`)
    }
    if (data.plan !== undefined && order.plan !== data.plan) {
      diffs.push(`套餐 ${order.plan} → ${data.plan}`)
    }
    if (data.days !== undefined && Number(order.days) !== data.days) {
      diffs.push(`天数 ${order.days} → ${data.days}`)
    }
    if (data.trafficGB !== undefined && Number(order.trafficGB) !== data.trafficGB) {
      diffs.push(`流量 ${order.trafficGB}G → ${data.trafficGB}G`)
    }
    if (data.ipLimit !== undefined && Number(order.ipLimit) !== data.ipLimit) {
      diffs.push(`设备 ${order.ipLimit} → ${data.ipLimit}`)
    }
  }
  if (diffs.length) {
    const log = Array.isArray(order?.changeLog) ? order.changeLog : []
    data.changeLog = [
      ...log,
      {
        at: new Date().toISOString(),
        by: operator,
        detail: diffs.join('；'),
        reason: '确认收款时调整',
      },
    ]
  }

  await payload.update({
    collection: 'orders',
    id,
    data,
    overrideAccess: true,
  })

  revalidatePath('/staff')
}

export async function cancelOrder(formData: FormData) {
  const payload = await requireTailscale()
  const id = Number(formData.get('id'))
  if (!id) throw new Error('缺少订单 ID')
  await payload.update({
    collection: 'orders',
    id,
    data: { status: 'expired' },
    overrideAccess: true,
  })
  revalidatePath('/staff')
}

/** 开通失败重试 */
export async function retryOrder(formData: FormData) {
  const payload = await requireTailscale()
  const id = Number(formData.get('id'))
  if (!id) throw new Error('缺少订单 ID')
  await payload.update({
    collection: 'orders',
    id,
    data: { status: 'paid', clientEmail: null },
    overrideAccess: true,
  })
  revalidatePath('/staff')
}
