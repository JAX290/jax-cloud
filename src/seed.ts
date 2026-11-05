import 'dotenv/config'

import path from 'path'
import { getPayload } from 'payload'

import config from './payload.config'
import { nextCustomerNo } from './lib/customerNo'

const payload = await getPayload({ config })

async function ensureAdmin() {
  const email = 'admin@jax.local'
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  if (found.docs.length) return
  await payload.create({
    collection: 'users',
    data: {
      email,
      password: 'JaxAdmin123!',
      name: '管理员',
    },
  })
  payload.logger.info(`admin created: ${email} / JaxAdmin123!`)
}

async function ensureCustomer() {
  const email = 'demo@jax.local'
  const found = await payload.find({
    collection: 'customers',
    where: { email: { equals: email } },
    limit: 1,
  })
  if (found.docs.length) return found.docs[0]

  const customer = await payload.create({
    collection: 'customers',
    data: {
      email,
      password: 'Demo123456!',
      name: '演示客户',
    } as any,
  })

  await payload.update({
    collection: 'customers',
    id: customer.id,
    data: { _verified: true } as any,
  })

  payload.logger.info(`customer created: ${email} / Demo123456!`)
  return customer
}

async function main() {
  await ensureAdmin()
  const customer: any = await ensureCustomer()

  if (!customer.customerNo) {
    const customerNo = await nextCustomerNo(payload)
    await payload.update({
      collection: 'customers',
      id: customer.id,
      data: { customerNo } as any,
    })
    customer.customerNo = customerNo
  }

  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      heroTitle: '把跨境业务，部署在|独立、稳定的环境里',
      heroSub:
        '服务器部署 + 运维托管：独立资源、按月付费，从开箱到上线由我们完成。',
      wechat: 'jax31415',
      contactName: '贾克斯',
      email: 'contact@jax.markets',
      disclaimer:
        '禁止一切违法违规业务接入，仅做交流学习使用。对于个人违规使用产生的一切后果由客户自行承担。',
      deployDedicated: 388,
      deployShared: 288,
      opsTiers: [
        { name: '1核1G', traffic: '1000G 流量', price: 80 },
        { name: '2核2G', traffic: '2000G 流量', price: 120 },
        { name: '4核4G', traffic: '4000G 流量', price: 240 },
        { name: '8核8G', traffic: '8000G 流量', price: 480 },
      ],
    },
  })

  const services = await payload.find({
    collection: 'services',
    where: { customer: { equals: customer.id } },
    limit: 20,
  })

  if (!services.docs.length) {
    await payload.create({
      collection: 'services',
      data: {
        title: '独立部署 · 基础环境',
        customer: customer.id,
        plan: 'deploy-independent',
        spec: '2核2G / 2000G 流量',
        price: 388,
        cycle: 'one-time',
        status: 'active',
        serverIp: '203.0.113.10',
      },
    })
    await payload.create({
      collection: 'services',
      data: {
        title: '运维托管 · 2核2G',
        customer: customer.id,
        plan: 'ops-2c2g',
        spec: '2核2G / 2000G 流量',
        price: 120,
        cycle: 'monthly',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        serverIp: '203.0.113.10',
      },
    })
  }

  const OPS_CONTENT = [
    '2核2G 独立资源，2000G 月流量',
    '系统与运行环境维护',
    '7×24 监控与告警',
    '故障响应与工单支持',
    '每月系统更新与巡检',
  ].join('\n')

  const DEPLOY_CONTENT = [
    '系统初始化与安全加固',
    '运行环境配置',
    '域名解析与上线验收',
    '交付账号与操作说明',
  ].join('\n')

  const allServices = await payload.find({
    collection: 'services',
    where: { customer: { equals: customer.id } },
    limit: 20,
  })

  for (const service of allServices.docs as any[]) {
    const patch: Record<string, any> = {}
    if (!service.startedAt) {
      patch.startedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    if (!service.subscriptionContent) {
      patch.subscriptionContent = String(service.plan).startsWith('ops') ? OPS_CONTENT : DEPLOY_CONTENT
    }
    if (!service.renewalMonthlyPrice && service.cycle === 'monthly') {
      patch.renewalMonthlyPrice = service.price || 120
    }
    if (!service.expiresAt && service.cycle === 'monthly') {
      patch.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    if (Object.keys(patch).length) {
      await payload.update({ collection: 'services', id: service.id, data: patch as any })
    }
  }

  const tickets = await payload.find({
    collection: 'tickets',
    where: { customer: { equals: customer.id } },
    limit: 1,
  })

  if (!tickets.docs.length) {
    await payload.create({
      collection: 'tickets',
      data: {
        subject: '演示工单：如何续费？',
        customer: customer.id,
        category: 'billing',
        priority: 'normal',
        status: 'pending',
        messages: [
          {
            author: '演示客户',
            isStaff: false,
            body: '下个月到期，想了解年付 9 折怎么操作。',
            createdAt: new Date().toISOString(),
          },
          {
            author: '管理员',
            isStaff: true,
            body: '年付按 月费 × 12 × 0.9 计算，确认后我们会发付款方式给你。',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    })
  }

  const mediaDir = path.resolve(process.cwd(), 'public/cases')

  async function ensureMedia(filename: string, alt: string) {
    const found = await payload.find({
      collection: 'media',
      where: { filename: { equals: filename } },
      limit: 1,
    })
    if (found.docs.length) return found.docs[0]
    return payload.create({
      collection: 'media',
      data: { alt } as any,
      filePath: path.join(mediaDir, filename),
    } as any)
  }

  const caseDefs = [
    {
      slug: 'independent-store-deploy',
      title: '跨境独立站部署',
      tag: '电商 / 部署',
      category: 'deploy',
      customer: '跨境电商卖家（脱敏）',
      description: '独立站环境从零部署，1 个工作日内上线。',
      challenge: '卖家第一次做独立站，服务器、环境、域名解析都不熟，担心上线慢、配置错。',
      solution: '完成系统初始化、运行环境、安全加固与域名解析，交付账号与操作说明。',
      result: '1 个工作日内上线，首周无故障，后续转为按月运维。',
      metrics: [
        { label: '交付时间', value: '1 个工作日' },
        { label: '首周可用性', value: '100%' },
        { label: '配置项', value: '12 项' },
      ],
      image: '01-monitoring.jpg',
      order: 1,
    },
    {
      slug: 'alerting-onboarding',
      title: '告警接入与响应',
      tag: '运维 / 告警',
      category: 'ops',
      customer: '跨境业务团队（脱敏）',
      description: '把 CPU、磁盘、证书、端口全部纳入告警。',
      challenge: '出问题靠客户反馈才发现，证书过期、磁盘满都发生过。',
      solution: '接入 4 类告警规则，配置邮件/短信/微信通知，明确响应与升级机制。',
      result: '首次响应平均 12 分钟，证书与磁盘类问题提前发现。',
      metrics: [
        { label: '告警规则', value: '4 类' },
        { label: '首次响应', value: '12 分钟' },
        { label: '漏报', value: '0' },
      ],
      image: '03-alerting.jpg',
      order: 3,
    },
    {
      slug: 'terminal-troubleshooting',
      title: '终端排障：从告警到恢复',
      tag: '运维 / 排障',
      category: 'ops',
      customer: '独立站卖家（脱敏）',
      description: '磁盘告警触发后，30 分钟内完成定位与恢复。',
      challenge: '磁盘使用率突然到 91%，网站变慢，卖家不知道从哪里查。',
      solution: '按系统 → 资源 → 服务 → 日志顺序排查，清理日志并调整轮转策略。',
      result: '30 分钟内恢复，磁盘降到 42%，补充了日志轮转与磁盘告警。',
      metrics: [
        { label: '定位耗时', value: '15 分钟' },
        { label: '恢复耗时', value: '30 分钟' },
        { label: '磁盘占用', value: '91% → 42%' },
      ],
      image: '05-terminal.jpg',
      order: 4,
    },
  ]

  for (const def of caseDefs) {
    const existing = await payload.find({
      collection: 'cases',
      where: { slug: { equals: def.slug } },
      limit: 1,
    })
    if (existing.docs.length) continue

    const media = await ensureMedia(def.image, def.title)
    await payload.create({
      collection: 'cases',
      data: {
        ...def,
        image: media.id,
        published: true,
      } as any,
    })
  }

  // 当前业务聚焦部署与运维，删除备份/工单/多平台等其他案例
  const hiddenSlugs = ['daily-backup-drill', 'ticket-workflow', 'multi-platform-store']
  for (const slug of hiddenSlugs) {
    const found = await payload.find({
      collection: 'cases',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    if (found.docs[0]) {
      await payload.delete({
        collection: 'cases',
        id: found.docs[0].id,
      })
    }
  }

  // 同步已有案例文案（去掉备份相关内容）
  const alerting = await payload.find({
    collection: 'cases',
    where: { slug: { equals: 'alerting-onboarding' } },
    limit: 1,
  })
  if (alerting.docs[0]) {
    await payload.update({
      collection: 'cases',
      id: alerting.docs[0].id,
      data: {
        description: '把 CPU、磁盘、证书、端口全部纳入告警。',
        solution: '接入 4 类告警规则，配置邮件/短信/微信通知，明确响应与升级机制。',
        metrics: [
          { label: '告警规则', value: '4 类' },
          { label: '首次响应', value: '12 分钟' },
          { label: '漏报', value: '0' },
        ],
      } as any,
    })
  }

  // 删除早期无配图的占位案例
  const legacy = await payload.find({
    collection: 'cases',
    where: { title: { equals: '跨境卖家环境部署' } },
    limit: 1,
  })
  if (legacy.docs[0]) {
    await payload.delete({ collection: 'cases', id: legacy.docs[0].id })
  }

  payload.logger.info('seed done')
  process.exit(0)
}

main().catch((error) => {
  payload.logger.error({ msg: 'seed failed', err: error })
  process.exit(1)
})
