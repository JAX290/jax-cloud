import { listNodeClients } from './node-client'
import {
  createClientOnNode,
  generateSubId,
  pickOnlineNode,
  updateClientOnNode,
} from './provision'

/** 体验时长 / 流量（默认 1 小时 / 1G） */
export const TRIAL_HOURS = Number(process.env.TRIAL_HOURS || 1)
export const TRIAL_GB = Number(process.env.TRIAL_GB || 1)

const SUB_HOST = (process.env.SUB_SITE || 'https://sub.jax.markets').replace(/\/$/, '')

export function trialEmail(customerNo: number | string) {
  return `${customerNo}-trial`
}

export function trialSubUrl(subId: string) {
  return `${SUB_HOST}/sub/${subId}`
}

export function trialDurationMs() {
  return TRIAL_HOURS * 3600 * 1000
}

export function trialTotalBytes() {
  return TRIAL_GB * 1024 * 1024 * 1024
}

export type ClaimResult = {
  ok: boolean
  error?: string
  subUrl?: string
  subId?: string
  expiresAt?: string
  nodeName?: string
}

/**
 * 领取体验：一个客户只能领一次。
 * 在在线节点上开一个 1 小时 / 1G 的客户端，到期由 /api/cron/trial 自动停用。
 */
export async function claimTrial(payload: any, customer: any): Promise<ClaimResult> {
  if (customer?.trialUsed) {
    return { ok: false, error: '每个账号只能体验一次' }
  }

  const node: any = await pickOnlineNode(payload)
  if (!node) return { ok: false, error: '现在没有可用节点，稍后再试' }

  const subId = generateSubId()
  const expiresAt = Date.now() + trialDurationMs()
  const email = trialEmail(customer.customerNo)

  const created = await createClientOnNode(node, {
    email,
    limitIp: 1,
    totalGB: trialTotalBytes(),
    expiryTime: expiresAt,
    comment: `JAX 体验 ${TRIAL_HOURS}小时/${TRIAL_GB}G`,
    subId,
  })
  if (!created.ok) return { ok: false, error: created.error || '开通失败' }

  try {
    await payload.update({
      collection: 'customers',
      id: customer.id,
      data: {
        trialUsed: true,
        trialStopped: false,
        trialClientEmail: email,
        trialNodeId: node.id,
        trialSubId: subId,
        trialExpiresAt: new Date(expiresAt).toISOString(),
      },
      overrideAccess: true,
    })
  } catch (e: any) {
    return { ok: false, error: `开通成功但记录失败：${e?.message || '未知错误'}，请联系客服` }
  }

  return {
    ok: true,
    subId,
    subUrl: trialSubUrl(subId),
    expiresAt: new Date(expiresAt).toISOString(),
    nodeName: node.name,
  }
}

/** 停用某个客户的体验：把节点上的客户端 enable 设为 false，并记 trialStopped */
export async function stopTrial(payload: any, customer: any, reason: string) {
  try {
    if (customer?.trialClientEmail && customer?.trialNodeId) {
      const node: any = await payload
        .findByID({ collection: 'nodes', id: customer.trialNodeId, overrideAccess: true })
        .catch(() => null)
      if (node) {
        await updateClientOnNode(node, customer.trialClientEmail, { enable: false })
      }
    }
  } catch {
    /* 节点连不上也要标记，避免每轮重复尝试 */
  }

  await payload.update({
    collection: 'customers',
    id: customer.id,
    data: { trialStopped: true },
    overrideAccess: true,
  })
  return { ok: true, reason }
}

/**
 * 巡检：到期或流量用完的体验一律停用。
 * 返回被停用的客户号列表（给企业微信/接口返回用）。
 */
export async function sweepTrials(payload: any) {
  const stopped: { customerNo: any; reason: string }[] = []
  let docs: any[] = []
  try {
    const res: any = await payload.find({
      collection: 'customers',
      where: {
        and: [{ trialUsed: { equals: true } }, { trialStopped: { equals: false } }],
      },
      limit: 100,
      overrideAccess: true,
    })
    docs = (res.docs || []) as any[]
  } catch {
    return stopped
  }

  for (const c of docs) {
    const expires = c.trialExpiresAt ? Date.parse(c.trialExpiresAt) : 0
    let reason = ''

    if (expires && expires <= Date.now()) {
      reason = '到期'
    } else if (c.trialNodeId && c.trialClientEmail) {
      try {
        const node: any = await payload.findByID({
          collection: 'nodes',
          id: c.trialNodeId,
          overrideAccess: true,
        })
        const clients = await listNodeClients(node)
        const cl = clients.find((x: any) => x.email === c.trialClientEmail)
        const used = Number(cl?.traffic?.up || 0) + Number(cl?.traffic?.down || 0)
        if (used >= trialTotalBytes()) reason = '流量用完'
      } catch {
        /* 节点临时连不上就等下一轮 */
      }
    }

    if (reason) {
      await stopTrial(payload, c, reason)
      stopped.push({ customerNo: c.customerNo, reason })
    }
  }

  return stopped
}
