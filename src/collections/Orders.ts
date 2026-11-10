import type { CollectionConfig } from 'payload'

import { listNodeClients } from '../lib/node-client'
import { findClientNode } from '../lib/migrate'
import { createClientOnNode, pickOnlineNode, updateClientOnNode } from '../lib/provision'
import { renderMail, renderMailText } from '../lib/mail-templates'
import { sendMail } from '../lib/mailer'
import { GRACE_DAYS } from '../lib/renew'
import { sendWecom } from '../lib/wecom'

const isAdmin = (user: any) => user?.collection === 'users'
const isCustomer = (user: any) => user?.collection === 'customers'

export const PLAN_LABEL: Record<string, string> = {
  basic: '基础版',
  advanced: '进阶版',
}

export const BILLING_LABEL: Record<string, string> = {
  deploy: '部署费',
  traffic: '流量费',
  topup: '流量加油包',
  upgrade: '升级差价',
}

export const STATUS_LABEL: Record<string, string> = {
  pending: '待支付',
  paid: '已收款',
  active: '已开通',
  expired: '已过期',
  failed: '开通失败',
}

async function nextOrderNo(payload: any): Promise<string> {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const res = await payload.find({
    collection: 'orders',
    where: { orderNo: { like: ymd } },
    sort: '-orderNo',
    limit: 1,
  })
  const last = res?.docs?.[0]?.orderNo
  const seq = last ? Number(String(last).slice(-3)) + 1 : 1
  return `${ymd}${String(seq).padStart(3, '0')}`
}

/**
 * 收款确认后开通：
 * 从 nodes 表选一台可用节点 → 在该节点创建客户端（一次部署 = 一个 IP）
 * 幂等、失败可回滚，并推送企业微信
 */
async function provisionOrder(doc: any, req: any) {
  const payload = req.payload
  try {
    // 升级差价订单：不新建客户端，只改已有客户端的参数
    if (doc.billing === 'upgrade' && doc.upgradeClientEmail) {
      const nodesRes: any = await payload.find({
        collection: 'nodes',
        where: { status: { equals: 'online' } },
        limit: 50,
        overrideAccess: true,
      })
      const found = await findClientNode(nodesRes.docs || [], doc.upgradeClientEmail)
      if (!found) throw new Error(`所有节点上都找不到客户端 ${doc.upgradeClientEmail}`)

      const newLimit = doc.plan === 'advanced' ? 8 : 4
      const upRes = await updateClientOnNode(found.node, doc.upgradeClientEmail, {
        limitIp: newLimit,
      })
      if (!upRes.ok) throw new Error(`修改客户端失败：${upRes.error || '未知'}`)

      await payload.update({
        collection: 'orders',
        id: doc.id,
        data: {
          status: 'active',
          clientEmail: doc.upgradeClientEmail,
          provisionedAt: new Date().toISOString(),
          operator: `${doc.operator || 'system'} · ${found.node.name}`,
        },
        overrideAccess: true,
      })
      await sendWecom(
        `✅ **升级完成**\n订单：${doc.orderNo}\n客户端：${doc.upgradeClientEmail}\n升级为：${PLAN_LABEL[doc.plan] || doc.plan}（设备上限 ${newLimit} 台）\n节点：${found.node.name}`,
      )

      // 升级成功邮件
      try {
        const custId = typeof doc.customer === 'object' ? doc.customer?.id : doc.customer
        const cust: any = custId
          ? await payload.findByID({ collection: 'customers', id: custId, depth: 0, overrideAccess: true })
          : null
        if (cust?.email) {
          const site = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')
          await sendMail(payload, {
            to: cust.email,
            type: 'upgrade_success',
            customerId: cust.id,
            dedupeKey: `upgrade-${doc.id}`,
            subject: `已升级为${PLAN_LABEL[doc.plan] || doc.plan}（设备上限 ${newLimit} 台）`,
            html: renderMail({
              title: '套餐已升级',
              body: `
                <p>你好${cust.name ? `，${cust.name}` : ''}：</p>
                <p>你的客户端 <b>${doc.upgradeClientEmail}</b> 已升级为 <b>${PLAN_LABEL[doc.plan] || doc.plan}</b>，设备上限提升到 <b>${newLimit} 台</b>。</p>
                <p style="color:#6b7f92;font-size:13px">订阅链接和设备都不用动，直接用就行。</p>
              `,
              cta: { label: '查看我的账户', url: `${site}/account` },
            }),
            text: renderMailText({
              title: '套餐已升级',
              lines: [`客户端：${doc.upgradeClientEmail}`, `设备上限：${newLimit} 台`],
            }),
          })
        }
      } catch {
        /* 邮件失败不影响升级 */
      }
      return
    }

    // 续费订单：给已有客户端加时长 + 累加流量，不新建客户端
    if (doc.renewClientEmail) {
      const renewEmail = String(doc.renewClientEmail)
      const nodesRes: any = await payload.find({
        collection: 'nodes',
        where: { status: { equals: 'online' } },
        limit: 50,
        overrideAccess: true,
      })
      const found = await findClientNode(nodesRes.docs || [], renewEmail)
      if (!found) throw new Error(`所有在线节点上都找不到客户端 ${renewEmail}`)

      const days = Number(doc.days || 30)
      const addBytes = Number(doc.trafficGB || 0) * 1024 * 1024 * 1024
      const now = Date.now()
      const graceMs = GRACE_DAYS * 24 * 3600 * 1000
      const curExpiry = Number(found.client.expiryTime || 0)
      // 节点上的到期时间包含宽限期，先还原成付费到期再算，避免每次续费多蹭一天
      const curPaid = curExpiry > 0 ? curExpiry - graceMs : 0
      const base = curPaid > now ? curPaid : now
      const newPaidExpiry = base + days * 24 * 3600 * 1000
      const newExpiry = newPaidExpiry + graceMs
      const newTotalGB = Number(found.client.totalGB || 0) + addBytes

      const upRes = await updateClientOnNode(found.node, renewEmail, {
        totalGB: newTotalGB,
        expiryTime: newExpiry,
        enable: true,
      })
      if (!upRes.ok) throw new Error(`续费写入面板失败：${upRes.error || '未知'}`)

      await payload.update({
        collection: 'orders',
        id: doc.id,
        data: {
          status: 'active',
          clientEmail: renewEmail,
          provisionedAt: new Date().toISOString(),
          operator: `${doc.operator || 'system'} · ${found.node.name}`,
        },
        overrideAccess: true,
      })
      await sendWecom(
        `✅ **续费已自动生效**\n订单：${doc.orderNo}\n客户端：${renewEmail}\n节点：${found.node.name}\n增加：${days} 天 · ${doc.trafficGB || 0}G\n新到期：${new Date(newPaidExpiry).toLocaleDateString('zh-CN')}（含 ${GRACE_DAYS} 天宽限）\n总流量：${Math.round(newTotalGB / 1024 / 1024 / 1024)}G`,
      )

      // 给客户发续费成功邮件（失败不影响业务）
      try {
        const custId = typeof doc.customer === 'object' ? doc.customer?.id : doc.customer
        const cust: any = custId
          ? await payload.findByID({ collection: 'customers', id: custId, depth: 0, overrideAccess: true })
          : null
        if (cust?.email) {
          const site = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')
          const expireText = new Date(newPaidExpiry).toLocaleDateString('zh-CN')
          const isTopup = doc.billing === 'topup'
          await sendMail(payload, {
            to: cust.email,
            type: isTopup ? 'topup_success' : 'renew_success',
            customerId: cust.id,
            dedupeKey: isTopup ? `topup-${doc.id}` : `renew-${doc.id}`,
            subject: isTopup
              ? `加油包已到账：+${doc.trafficGB || 0}G`
              : `续费已生效：+${days} 天（新的到期日 ${expireText}）`,
            html: renderMail({
              title: isTopup ? '加油包已到账' : '续费已生效',
              body: isTopup
                ? `
                <p>你好${cust.name ? `，${cust.name}` : ''}：</p>
                <p>你买的加油包已经加上，<b>${doc.trafficGB || 0}G</b> 已累加到原有额度。</p>
                <p style="color:#6b7f92;font-size:13px">不用改任何配置，客户端里刷新一下流量就会更新。</p>
              `
                : `
                <p>你好${cust.name ? `，${cust.name}` : ''}：</p>
                <p>你的续费已经自动生效，<b>订阅链接和设备都不用动</b>。</p>
                <ul style="padding-left:20px;margin:12px 0">
                  <li>增加时长：${days} 天</li>
                  <li>增加流量：${doc.trafficGB || 0}G（已累加到原额度）</li>
                  <li>新的到期日：<b>${expireText}</b>（含 ${GRACE_DAYS} 天宽限）</li>
                </ul>
              `,
              cta: { label: '查看我的账户', url: `${site}/account` },
            }),
            text: renderMailText({
              title: isTopup ? '加油包已到账' : '续费已生效',
              lines: isTopup
                ? [`增加流量：${doc.trafficGB || 0}G`]
                : [`增加时长：${days} 天`, `增加流量：${doc.trafficGB || 0}G`, `新的到期日：${expireText}`],
            }),
          })
        }
      } catch {
        /* 邮件失败不影响续费 */
      }
      return
    }

    const customerId = typeof doc.customer === 'object' ? doc.customer?.id : doc.customer
    const customer: any = await payload.findByID({
      collection: 'customers',
      id: customerId,
      depth: 0,
      overrideAccess: true,
    })
    const customerNo = customer?.customerNo
    if (!customerNo) throw new Error('客户缺少编号 customerNo')

    // 1. 选一台可用节点（在线 + 客户端数最少）
    const node: any = await pickOnlineNode(payload)
    if (!node) throw new Error('没有可用节点，请先在工作台添加节点')

    // 2. 该节点上本客户已有的客户端（用于幂等判断）
    const nodeClients = await listNodeClients(node)

    // 3. 全局序号：统计所有在线节点上本客户的客户端，避免跨节点重名
    let globalCount = 0
    try {
      const allNodes = await payload.find({
        collection: 'nodes',
        where: { status: { equals: 'online' } },
        limit: 50,
        overrideAccess: true,
      })
      for (const n of (allNodes.docs || []) as any[]) {
        const cls = await listNodeClients(n)
        globalCount += cls.filter((c) => String(c.email || '').startsWith(`${customerNo}-`)).length
      }
    } catch {
      globalCount = nodeClients.filter((c) => String(c.email || '').startsWith(`${customerNo}-`))
        .length
    }
    const seq = globalCount + 1
    const email = `${customerNo}-${seq}`

    // 幂等：同 email 已存在，直接标记为已开通
    if (nodeClients.some((c) => c.email === email)) {
      await payload.update({
        collection: 'orders',
        id: doc.id,
        data: {
          clientEmail: email,
          status: 'active',
          provisionedAt: new Date().toISOString(),
          operator: `${doc.operator || 'system'} · ${node.name}`,
        },
        overrideAccess: true,
      })
      return
    }

    const limitIp = Number(doc.ipLimit || (doc.plan === 'advanced' ? 8 : 4))
    const totalGB = Number(doc.trafficGB || 0) * 1024 * 1024 * 1024
    const days = Number(doc.days || 30)
    const expiryTime = Date.now() + (days + GRACE_DAYS) * 24 * 3600 * 1000

    const res = await createClientOnNode(node, {
      email,
      limitIp,
      totalGB,
      expiryTime,
      comment: `${customer?.name || ''} · ${PLAN_LABEL[doc.plan] || ''}`.trim(),
    })

    if (!res.ok) {
      await payload.update({
        collection: 'orders',
        id: doc.id,
        data: { status: 'failed' },
        overrideAccess: true,
      })
      await sendWecom(
        `⚠️ **订单开通失败**\n订单：${doc.orderNo}\n节点：${node.name} (${node.ip})\n客户端：${email}\n原因：${res.error || '未知'}`,
      )
      return
    }

    await payload.update({
      collection: 'orders',
      id: doc.id,
      data: {
        clientEmail: email,
        status: 'active',
        provisionedAt: new Date().toISOString(),
        operator: `${doc.operator || 'system'} · ${node.name}`,
      },
      overrideAccess: true,
    })
    await sendWecom(
      `✅ **订单已开通**\n订单：${doc.orderNo}\n节点：${node.name} (${node.ip})\n客户端：${email}\n设备：${limitIp} 台 · 流量：${doc.trafficGB || 0}G · 时长：${days} 天`,
    )

    // 开通通知邮件（客户最关心：哪台节点、怎么用、什么时候到期）
    try {
      if (customer?.email) {
        const site = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')
        const expireText = new Date(expiryTime - GRACE_DAYS * 24 * 3600 * 1000).toLocaleDateString('zh-CN')
        await sendMail(payload, {
          to: customer.email,
          type: 'order_active',
          customerId: customer.id,
          dedupeKey: `active-${doc.id}`,
          subject: '你的网络环境已开通',
          html: renderMail({
            title: '环境已开通',
            body: `
              <p>你好${customer.name ? `，${customer.name}` : ''}：</p>
              <p>你的环境已经开通好了，登录账户页就能看到订阅链接。</p>
              <ul style="padding-left:20px;margin:12px 0">
                <li>所在节点：${node.name}</li>
                <li>设备上限：${limitIp} 台</li>
                <li>流量额度：${doc.trafficGB || 0}G</li>
                <li>到期日：<b>${expireText}</b></li>
              </ul>
              <p style="color:#6b7f92;font-size:13px">第一次用的话，在账户页复制订阅链接，导入客户端即可；不会弄可以找客服。</p>
            `,
            cta: { label: '查看订阅链接', url: `${site}/account` },
          }),
          text: renderMailText({
            title: '环境已开通',
            lines: [`节点：${node.name}`, `设备：${limitIp} 台`, `流量：${doc.trafficGB || 0}G`, `到期日：${expireText}`],
          }),
        })
      }
    } catch {
      /* 邮件失败不影响开通 */
    }
  } catch (e: any) {
    console.error('[provision] failed:', e?.message || e)
    await payload
      .update({ collection: 'orders', id: doc.id, data: { status: 'failed' }, overrideAccess: true })
      .catch(() => {})
    await sendWecom(`⚠️ **订单开通异常**\n订单：${doc.orderNo}\n${e?.message || e}`)
  }
}

export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: {
    singular: '订单',
    plural: '订单',
  },
  admin: {
    useAsTitle: 'orderNo',
    group: '交易',
    defaultColumns: ['orderNo', 'customer', 'plan', 'billing', 'amount', 'status', 'source', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }: any) => {
      if (isAdmin(user)) return true
      if (isCustomer(user)) return { customer: { equals: user.id } }
      return false
    },
    create: ({ req: { user } }: any) => Boolean(user),
    update: ({ req: { user } }: any) => {
      // 只有后台管理员能改订单（状态/金额/参数都归客服控制）
      // 客户不能修改订单，避免自行把 pending 改成 paid 触发开通
      if (isAdmin(user)) return true
      return false
    },
    delete: ({ req: { user } }: any) => isAdmin(user),
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }: any) => {
        if (operation === 'create' && !data.orderNo) {
          data.orderNo = await nextOrderNo(req.payload)
        }
        if (data.status === 'paid' && !data.paidAt) {
          data.paidAt = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }: any) => {
        // 新订单推送
        if (operation === 'create' && doc.status === 'pending') {
          try {
            const customerId = typeof doc.customer === 'object' ? doc.customer?.id : doc.customer
            const customer: any = await req.payload.findByID({
              collection: 'customers',
              id: customerId,
              depth: 0,
              overrideAccess: true,
            })
            await sendWecom(
              `🛒 **新订单**\n订单：${doc.orderNo}\n客户：${customer?.name || '—'} (#${customer?.customerNo || '—'})\n${
                PLAN_LABEL[doc.plan] || doc.plan
              } · ${BILLING_LABEL[doc.billing] || doc.billing}\n金额：¥${doc.amount}\n备注：${doc.note || '—'}`,
            )

            // 给客户发待支付提醒（下单后没付钱的，这是最多的漏单场景）
            if (customer?.email) {
              const site = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')
              await sendMail(req.payload, {
                to: customer.email,
                type: 'order_pending',
                customerId: customer.id,
                dedupeKey: `pending-${doc.id}`,
                subject: `订单已创建：${BILLING_LABEL[doc.billing] || '订单'} ¥${doc.amount}`,
                html: renderMail({
                  title: '订单已创建，等待付款',
                  body: `
                    <p>你好${customer.name ? `，${customer.name}` : ''}：</p>
                    <p>你的订单已经生成，付完款我们马上给你开通。</p>
                    <ul style="padding-left:20px;margin:12px 0">
                      <li>订单号：<b>${doc.orderNo}</b></li>
                      <li>内容：${PLAN_LABEL[doc.plan] || doc.plan} · ${BILLING_LABEL[doc.billing] || doc.billing}</li>
                      <li>金额：<b>¥${doc.amount}</b></li>
                    </ul>
                    <p style="color:#6b7f92;font-size:13px">付款时备注订单号，客服确认后自动开通。</p>
                  `,
                  cta: { label: '查看订单', url: `${site}/orders` },
                }),
                text: renderMailText({
                  title: '订单已创建，等待付款',
                  lines: [`订单号：${doc.orderNo}`, `金额：¥${doc.amount}`, '付款备注订单号，客服确认后自动开通'],
                }),
              })
            }
          } catch {
            /* 推送失败不影响订单 */
          }
        }

        // 收款确认后自动开通
        if (
          operation === 'update' &&
          doc.status === 'paid' &&
          previousDoc?.status !== 'paid' &&
          !doc.clientEmail
        ) {
          await provisionOrder(doc, req)
        }
      },
    ],
  },
  fields: [
    {
      name: 'orderNo',
      type: 'text',
      label: '订单号',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      label: '客户',
      required: true,
      index: true,
    },
    {
      name: 'plan',
      type: 'select',
      label: '套餐',
      options: [
        { label: '基础版', value: 'basic' },
        { label: '进阶版', value: 'advanced' },
      ],
      defaultValue: 'basic',
      required: true,
    },
    {
      name: 'billing',
      type: 'select',
      label: '计费类型',
      options: [
        { label: '部署费', value: 'deploy' },
        { label: '流量费', value: 'traffic' },
        { label: '流量加油包', value: 'topup' },
        { label: '升级差价', value: 'upgrade' },
      ],
      defaultValue: 'deploy',
      required: true,
    },
    {
      name: 'amount',
      type: 'number',
      label: '金额（元）',
      required: true,
    },
    {
      name: 'days',
      type: 'number',
      label: '时长（天）',
      defaultValue: 30,
    },
    {
      name: 'trafficGB',
      type: 'number',
      label: '流量（GB）',
      defaultValue: 200,
    },
    {
      name: 'ipLimit',
      type: 'number',
      label: '设备上限（IP 数）',
      defaultValue: 4,
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      options: [
        { label: '待支付', value: 'pending' },
        { label: '已收款', value: 'paid' },
        { label: '已开通', value: 'active' },
        { label: '已过期', value: 'expired' },
        { label: '开通失败', value: 'failed' },
      ],
      defaultValue: 'pending',
      required: true,
      index: true,
    },
    {
      name: 'note',
      type: 'textarea',
      label: '客户备注',
      admin: { description: '客户填写的付款备注，如「微信已转，昵称小明」' },
    },
    {
      name: 'source',
      type: 'select',
      label: '下单来源',
      options: [
        { label: '客户自助下单', value: 'customer' },
        { label: '客服后台下单', value: 'staff' },
      ],
      defaultValue: 'customer',
      index: true,
      admin: {
        description: '客户自己下单自动记「客户自助」；客服在后台代客下单请改成「客服后台」',
        position: 'sidebar',
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      label: '收款时间',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'provisionedAt',
      type: 'date',
      label: '开通时间',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'clientEmail',
      type: 'text',
      label: '面板客户端',
      admin: { readOnly: true, description: '开通后自动写入，如 10086-1' },
    },
    {
      name: 'upgradeClientEmail',
      type: 'text',
      label: '升级目标客户端',
      admin: {
        description: '升级差价订单用：要升级的那个客户端 email（如 10044-3）',
      },
    },
    {
      name: 'renewClientEmail',
      type: 'text',
      label: '续费目标客户端',
      admin: {
        description: '续费订单用：要续费的那个客户端 email（如 10044-1）。收款后自动加时长 + 累加流量',
      },
    },
    {
      name: 'operator',
      type: 'text',
      label: '操作人',
      admin: { description: '确认收款/开通的客服' },
    },
    {
      name: 'changeLog',
      type: 'array',
      label: '修改记录',
      fields: [
        { name: 'at', type: 'text', label: '时间' },
        { name: 'by', type: 'text', label: '操作人' },
        { name: 'detail', type: 'text', label: '改动内容' },
        { name: 'reason', type: 'text', label: '原因' },
      ],
    },
  ],
}
