import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { renderMail, renderMailText } from '@/lib/mail-templates'
import { sendMail } from '@/lib/mailer'
import { listNodeClients } from '@/lib/node-client'
import { nodeCachePath, readNodeCache, writeNodeCache } from '@/lib/node-cache'
import { GRACE_DAYS, customerNoFromEmail, daysToExpiry, paidExpiry, trafficRatio } from '@/lib/renew'
import { recordTraffic } from '@/lib/traffic'
import { sendWecom } from '@/lib/wecom'

export const dynamic = 'force-dynamic'

/** 到期前几天开始提醒（默认 7 天） */
const REMIND_DAYS = Number(process.env.RENEW_REMIND_DAYS || 7)
/** 流量用到这个比例也提醒 */
const TRAFFIC_ALERT_RATIO = 0.9

/** 提醒窗口所在时区的小时偏移（默认 +8，北京时间；换时区改 .env 的 CRON_TZ_OFFSET） */
const TZ_OFFSET_HOURS = Number(process.env.CRON_TZ_OFFSET || 8)

/** 指定时区的日期与小时（无夏令时假设，跨境业务够用） */
function shanghaiNow() {
  const now = new Date()
  const shifted = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600 * 1000)
  return { dateKey: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() }
}

/** 把 email（10044-1）按客户号归并，取客户姓名/邮箱 */
async function resolveCustomers(payload: any, emails: string[]) {
  const nos = Array.from(
    new Set(emails.map((e) => customerNoFromEmail(e)).filter((n): n is number => Boolean(n))),
  )
  const byNo = new Map<number, { name?: string; email?: string }>()
  if (nos.length) {
    try {
      const res: any = await payload.find({
        collection: 'customers',
        where: { customerNo: { in: nos } },
        limit: 200,
        overrideAccess: true,
      })
      for (const c of (res.docs || []) as any[]) {
        byNo.set(Number(c.customerNo), { name: c.name, email: c.email })
      }
    } catch {
      /* 查不到就只显示客户端 email */
    }
  }
  return byNo
}

/**
 * 定时任务（服务器 crontab 每 5 分钟调用）
 * GET /api/cron/health?secret=xxx[&notify=0]
 *
 * 1. pending 订单超时作废
 * 2. 探测节点、更新状态/客户端数，并缓存客户端快照（离线时用来找受影响客户）
 * 3. 节点离线/恢复推送企业微信；离线时列出受影响的客户
 * 4. 续费提醒：每天北京时间 9-11 点推一次运营汇总（到期 ≤7 天 + 流量 ≥90%）
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret') || ''
  const expected = process.env.CRON_SECRET || ''
  /** notify=0 时只跑逻辑不发企业微信（自测用） */
  const notify = url.searchParams.get('notify') !== '0'
  /** force=1 时忽略「北京时间 9-11 点」窗口，手动补发一次提醒 */
  const force = url.searchParams.get('force') === '1'

  if (!expected || secret !== expected) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  // ---- 1. pending 订单超时作废（默认 24 小时）----
  const PENDING_TTL_HOURS = Number(process.env.ORDER_PENDING_TTL_HOURS || 24)
  const expireBeforeMs = Date.now() - PENDING_TTL_HOURS * 3600 * 1000
  let expiredOrders = 0
  try {
    const pendingRes = await payload.find({
      collection: 'orders',
      where: { status: { equals: 'pending' } },
      limit: 200,
      overrideAccess: true,
    })
    for (const o of (pendingRes.docs || []) as any[]) {
      const created = new Date(o.createdAt).getTime()
      if (!Number.isFinite(created)) continue
      if (created >= expireBeforeMs) continue
      await payload.update({
        collection: 'orders',
        id: o.id,
        data: { status: 'expired' },
        overrideAccess: true,
      })
      expiredOrders += 1

      // 通知客户订单已关闭（避免"我付了钱怎么没单"）
      try {
        const custId = typeof o.customer === 'object' ? o.customer?.id : o.customer
        const cust: any = custId
          ? await payload.findByID({ collection: 'customers', id: custId, depth: 0, overrideAccess: true })
          : null
        if (cust?.email) {
          const site = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')
          await sendMail(payload, {
            to: cust.email,
            type: 'order_cancelled',
            customerId: cust.id,
            dedupeKey: `expired-${o.id}`,
            subject: '订单因超时已关闭',
            html: renderMail({
              title: '订单已关闭',
              body: `
                <p>你好${cust.name ? `，${cust.name}` : ''}：</p>
                <p>你的订单 <b>${o.orderNo || ''}</b>（¥${o.amount || 0}）超过 ${PENDING_TTL_HOURS} 小时没有完成付款，已经自动关闭。</p>
                <p>如果还想开通，重新下单就行；已经付过款的话直接找客服，我们给你补上。</p>
              `,
              cta: { label: '重新下单', url: `${site}/#pricing` },
            }),
            text: renderMailText({
              title: '订单已关闭',
              lines: [`订单号：${o.orderNo || ''}`, `金额：¥${o.amount || 0}`, '超时未付款，已自动关闭'],
            }),
          })
        }
      } catch {
        /* 邮件失败不影响订单状态 */
      }
    }
  } catch (e: any) {
    console.error('[cron] order expire failed:', e?.message || e)
  }

  // ---- 2. 节点健康检查 ----
  const nodesRes = await payload.find({
    collection: 'nodes',
    limit: 100,
    overrideAccess: true,
  })
  const nodes = (nodesRes.docs || []) as any[]

  /** 本次检查拿到的客户端列表，续费提醒用 */
  const clientsByNode = new Map<number, any[]>()

  const results = await Promise.all(
    nodes.map(async (node) => {
      const prevStatus = String(node.status || '')
      let ok = false
      let clientCount = -1
      let error = ''
      let clients: any[] = []

      try {
        clients = await listNodeClients(node)
        ok = true
        clientCount = clients.length
      } catch (e: any) {
        error = e?.message || 'unreachable'
      }

      if (ok) {
        clientsByNode.set(Number(node.id), clients)
        // 客户端快照：节点之后挂了，用这份数据找受影响的客户
        writeNodeCache(node, clients)
        // 流量时序：把本周期增量记到当天（折线图数据源）
        try {
          for (const c of clients) {
            recordTraffic(
              String(c?.email || ''),
              Number(c?.traffic?.up || 0),
              Number(c?.traffic?.down || 0),
            )
          }
        } catch {
          /* 统计失败不影响健康检查 */
        }
      }

      const newStatus = ok ? 'online' : 'offline'

      try {
        await payload.update({
          collection: 'nodes',
          id: node.id,
          data: {
            status: newStatus,
            lastCheckAt: new Date().toISOString(),
            ...(clientCount >= 0 ? { clientCount } : {}),
          },
          overrideAccess: true,
        })
      } catch {
        /* 更新失败不阻塞其他节点 */
      }

      // 状态变化才告警
      if (prevStatus && prevStatus !== newStatus) {
        if (newStatus === 'offline') {
          const cached = readNodeCache()[String(node.id)]
          const affected = (cached?.clients || []).filter((c) => c.enable !== false)
          const byNo = await resolveCustomers(
            payload,
            affected.map((c) => c.email),
          )
          const lines = affected.slice(0, 20).map((c) => {
            const no = customerNoFromEmail(c.email)
            const cu = no ? byNo.get(no) : null
            return `- ${c.email}${cu ? ` · #${no} ${cu.name || ''} ${cu.email || ''}`.trimEnd() : ''}`
          })
          if (notify) {
            await sendWecom(
              `🔴 **节点离线**\n节点：${node.name || node.ip}\nIP：${node.ip}\n原因：${error || '连接失败'}\n受影响客户（${affected.length} 个环境）：\n${lines.join('\n') || '- 无可识别客户'}\n\n客户账户页已自动显示「节点维护中」提示。`,
            )
          }
        } else if (newStatus === 'online') {
          const cached = readNodeCache()[String(node.id)]
          const recovered = (cached?.clients || []).length
          if (notify) {
            await sendWecom(
              `🟢 **节点恢复**\n节点：${node.name || node.ip}\nIP：${node.ip}\n客户端数：${clientCount}${recovered ? `\n受影响客户已恢复（${recovered} 个环境）` : ''}`,
            )
          }
        }
      }

      return {
        name: node.name || node.ip,
        ip: node.ip,
        status: newStatus,
        clientCount,
        error: error || undefined,
      }
    }),
  )

  // ---- 3. 续费提醒（每天北京时间 9-11 点推一次运营汇总；force=1 可手动补发）----
  let renewRemind = { sent: false, count: 0, items: [] as any[] }
  try {
    const { dateKey, hour } = shanghaiNow()
    const marker = path.join(path.dirname(nodeCachePath()), `.renew-remind-${dateKey}`)
    const alreadySent = fs.existsSync(marker)
    const inWindow = force || (hour >= 9 && hour <= 11)
    if (inWindow) {
      const items: Array<{
        email: string
        nodeId: number
        kind: 'expiry' | 'traffic'
        days: number | null
        expiry: number
        ratio: number
      }> = []

      for (const [nodeId, clients] of clientsByNode) {
        for (const c of clients) {
          const email = String(c?.email || '')
          if (!email) continue
          const expiry = Number(c?.expiryTime || 0)
          const used = Number(c?.traffic?.up || 0) + Number(c?.traffic?.down || 0)
          const ratio = trafficRatio(used, Number(c?.totalGB || 0))
          if (expiry > 0) {
            const left = daysToExpiry(expiry)
            if (left !== null && left <= REMIND_DAYS) {
              items.push({ email, nodeId, kind: 'expiry', days: left, expiry, ratio })
              continue
            }
          }
          if (ratio >= TRAFFIC_ALERT_RATIO) {
            items.push({ email, nodeId, kind: 'traffic', days: null, expiry, ratio })
          }
        }
      }

      renewRemind.count = items.length
      renewRemind.items = items.map((i) => ({ email: i.email, kind: i.kind, days: i.days }))

      if (notify && !alreadySent && items.length) {
        const byNo = await resolveCustomers(
          payload,
          items.map((i) => i.email),
        )
        const lines = items.slice(0, 30).map((i) => {
          const no = customerNoFromEmail(i.email)
          const cu = no ? byNo.get(no) : null
          const who = cu
            ? `#${no} ${cu.name || ''} ${cu.email || ''}`.replace(/\s+/g, ' ').trim()
            : i.email
          const detail =
            i.kind === 'expiry'
              ? i.days !== null && i.days < 0
                ? `已过期（${new Date(i.expiry).toLocaleDateString('zh-CN')}）`
                : `还剩 ${i.days} 天（${new Date(i.expiry).toLocaleDateString('zh-CN')}）`
              : `流量已用 ${Math.round(i.ratio * 100)}%`
          return `- ${i.email} · ${who} · ${detail}`
        })
        await sendWecom(
          `🔔 **续费提醒 · ${items.length} 个环境要留意**\n${lines.join('\n')}${items.length > 30 ? `\n…还有 ${items.length - 30} 个` : ''}\n\n客户账户页可以直接自助续费；工作台确认收款后自动加时长 + 累加流量。`,
        )
        fs.mkdirSync(path.dirname(marker), { recursive: true })
        fs.writeFileSync(marker, new Date().toISOString())
        renewRemind.sent = true

        // 逐客户发提醒邮件（统一走发送中心：每天上限 + 3 天去重 + 全站熔断）
        if (process.env.SMTP_HOST) {
          const site = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')
          for (const i of items) {
            const no = customerNoFromEmail(i.email)
            const cu = no ? byNo.get(no) : null
            if (!cu?.email) continue
            const who = `你好${cu.name ? `，${cu.name}` : ''}：`

            try {
              if (i.kind === 'expiry' && i.days !== null) {
                const expireText = new Date(paidExpiry(i.expiry)).toLocaleDateString('zh-CN')
                if (i.days <= 0) {
                  await sendMail(payload, {
                    to: cu.email,
                    type: 'expiry_day',
                    customerId: no || undefined,
                    dedupeKey: `${no}-${dateKey}-expired`,
                    subject: '环境已到期，为你保留了 1 天宽限期',
                    html: renderMail({
                      title: '环境已到期',
                      body: `<p>${who}</p><p>你的网络环境已到期（付费到期日 ${expireText}）。</p><p>我们为你保留了 <b>${GRACE_DAYS} 天</b>宽限期，这期间仍可正常使用；建议尽快续费，避免影响店铺运营。</p>`,
                      cta: { label: '去续费', url: `${site}/#pricing` },
                    }),
                    text: renderMailText({
                      title: '环境已到期',
                      lines: [`付费到期日：${expireText}`, `宽限期：${GRACE_DAYS} 天`],
                    }),
                  })
                } else if (i.days === 1) {
                  await sendMail(payload, {
                    to: cu.email,
                    type: 'expiry_1d',
                    customerId: no || undefined,
                    dedupeKey: `${no}-${dateKey}-1d`,
                    subject: '明天到期，记得续一下',
                    html: renderMail({
                      title: '明天到期',
                      body: `<p>${who}</p><p>你的环境明天到期（${expireText}），到期后还有 ${GRACE_DAYS} 天宽限期，但建议提前续上，避免影响使用。</p>`,
                      cta: { label: '去续费', url: `${site}/#pricing` },
                    }),
                    text: renderMailText({ title: '明天到期', lines: [`到期日：${expireText}`] }),
                  })
                } else if (i.days === 7) {
                  await sendMail(payload, {
                    to: cu.email,
                    type: 'expiry_7d',
                    customerId: no || undefined,
                    dedupeKey: `${no}-${dateKey}-7d`,
                    subject: '环境还有 7 天到期',
                    html: renderMail({
                      title: '环境还有 7 天到期',
                      body: `<p>${who}</p><p>你的环境将在 ${expireText} 到期。可以现在续，也可以等快到期再续（时长会累加）。</p>`,
                      cta: { label: '查看套餐', url: `${site}/#pricing` },
                    }),
                    text: renderMailText({ title: '环境还有 7 天到期', lines: [`到期日：${expireText}`] }),
                  })
                }
              } else if (i.kind === 'traffic') {
                if (i.ratio >= 0.9) {
                  await sendMail(payload, {
                    to: cu.email,
                    type: 'traffic_90',
                    customerId: no || undefined,
                    dedupeKey: `${no}-${dateKey}-traffic90`,
                    subject: '流量快用完了（已用 90%）',
                    html: renderMail({
                      title: '流量快用完了',
                      body: `<p>${who}</p><p>你的流量已经用了约 <b>${Math.round(i.ratio * 100)}%</b>，用完会断网。可以加个加油包，或者等下个周期刷新。</p>`,
                      cta: { label: '去加流量', url: `${site}/#pricing` },
                    }),
                    text: renderMailText({ title: '流量快用完了', lines: [`已用 ${Math.round(i.ratio * 100)}%`] }),
                  })
                } else if (i.ratio >= 0.8) {
                  await sendMail(payload, {
                    to: cu.email,
                    type: 'traffic_80',
                    customerId: no || undefined,
                    dedupeKey: `${no}-${dateKey}-traffic80`,
                    subject: '流量用了 80% 了',
                    html: renderMail({
                      title: '流量用了 80%',
                      body: `<p>${who}</p><p>提醒一下：你的流量已经用了约 <b>${Math.round(i.ratio * 100)}%</b>，如果这个月还要大量用，可以提前加流量。</p>`,
                      cta: { label: '查看加油包', url: `${site}/#pricing` },
                    }),
                    text: renderMailText({ title: '流量用了 80%', lines: [`已用 ${Math.round(i.ratio * 100)}%`] }),
                  })
                }
              }
            } catch (mailErr: any) {
              console.error('[cron] customer email failed:', mailErr?.message || mailErr)
            }
          }
        }
      }
    }
  } catch (e: any) {
    console.error('[cron] renew remind failed:', e?.message || e)
  }

  const online = results.filter((r) => r.status === 'online').length
  const offline = results.length - online

  return Response.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    total: results.length,
    online,
    offline,
    expiredOrders,
    renewRemind,
    results,
  })
}
