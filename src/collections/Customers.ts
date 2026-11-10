import { APIError, type CollectionConfig } from 'payload'

import { nextCustomerNo } from '../lib/customerNo'
import { renderMail } from '../lib/mail-templates'
import { consumeCode } from '../lib/verify-code'

const isAdmin = (user: any) => user?.collection === 'users'
const isCustomer = (user: any) => user?.collection === 'customers'

export const Customers: CollectionConfig = {
  slug: 'customers',
  labels: {
    singular: '客户',
    plural: '客户',
  },
  admin: {
    useAsTitle: 'email',
    group: '客户',
    defaultColumns: ['customerNo', 'email', 'name', 'createdAt'],
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7,
    maxLoginAttempts: 8,
    lockTime: 10 * 60 * 1000,
    forgotPassword: {
      generateEmailSubject: () => '重置密码 · JAX CLOUD',
      generateEmailHTML: ({ token }: any) => `
        <div style="font-family:system-ui,sans-serif;line-height:1.7;color:#1a2330">
          <h2>重置密码</h2>
          <p>点击下面的链接设置新密码：</p>
          <p><a href="${process.env.SERVER_URL || 'http://localhost:3000'}/reset?token=${token}" style="color:#0088cc">重置密码</a></p>
          <p style="color:#7a8a9a;font-size:12px">链接 1 小时内有效。若非本人操作，请忽略此邮件。</p>
        </div>
      `,
    },
  },
  hooks: {
    // 注册必须带邮箱验证码（后台管理员创建不受限）
    beforeValidate: [
      async ({ data, operation, req }: any) => {
        if (operation !== 'create') return data
        const isAdminUser = req?.user?.collection === 'users'
        if (isAdminUser) return data
        const result = await consumeCode(req.payload, data?.email, 'register', data?.emailCode)
        if (!result.ok) {
          throw new APIError(result.error || '请先获取邮箱验证码', 400)
        }
        delete data.emailCode
        return data
      },
    ],
    beforeChange: [
      async ({ data, operation, req }: any) => {
        if (operation === 'create' && !data.customerNo) {
          data.customerNo = await nextCustomerNo(req.payload)
        }
        return data
      },
    ],
    afterChange: [
      // 注册成功后发一封欢迎邮件（失败不影响注册）
      async ({ doc, operation, req }: any) => {
        if (operation !== 'create' || !doc?.email) return
        try {
          const site = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')
          await req.payload.sendEmail({
            to: doc.email,
            subject: '欢迎使用 JAX CLOUD',
            html: renderMail({
              title: '账号已创建',
              body: `
                <p>你好${doc.name ? `，${doc.name}` : ''}：</p>
                <p>你的 JAX CLOUD 账号已创建成功，客户编号 <b>#${doc.customerNo || ''}</b>。</p>
                <p>接下来可以：</p>
                <ul style="padding-left:20px;margin:10px 0">
                  <li>在账户页领取 <b>1 小时免费体验</b>（1 小时 / 1G 流量）</li>
                  <li>需要正式环境时，直接在账户页下单或找客服</li>
                </ul>
              `,
              cta: { label: '进入我的账户', url: `${site}/account` },
              footerNote: '如果这不是你本人注册，直接忽略这封邮件即可。',
            }),
          })
        } catch {
          /* 邮件失败不影响注册 */
        }
      },
    ],
  },
  access: {
    admin: ({ req: { user } }: any) => isAdmin(user),
    create: () => true,
    read: ({ req: { user } }: any) => {
      if (isAdmin(user)) return true
      if (isCustomer(user)) return { id: { equals: user.id } }
      return false
    },
    update: ({ req: { user } }: any) => {
      if (isAdmin(user)) return true
      if (isCustomer(user)) return { id: { equals: user.id } }
      return false
    },
    delete: ({ req: { user } }: any) => isAdmin(user),
  },
  fields: [
    {
      name: 'customerNo',
      type: 'number',
      label: '客户编号',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: '注册时自动生成，5 位递增编号',
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'name',
      type: 'text',
      label: '称呼',
    },
    {
      name: 'phone',
      type: 'text',
      label: '手机号',
    },
    {
      name: 'wechat',
      type: 'text',
      label: '微信号',
    },
    {
      name: 'trialUsed',
      type: 'checkbox',
      label: '已领取体验',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'trialStopped',
      type: 'checkbox',
      label: '体验已停用',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'trialClientEmail',
      type: 'text',
      label: '体验客户端 email',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'trialNodeId',
      type: 'number',
      label: '体验所在节点 ID',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'trialSubId',
      type: 'text',
      label: '体验订阅 ID',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'trialExpiresAt',
      type: 'date',
      label: '体验到期时间',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      // 注册时前端传的邮箱验证码：虚拟字段，不落库，只在 beforeValidate 里校验
      name: 'emailCode',
      type: 'text',
      virtual: true,
      admin: { hidden: true },
    },
  ],
}
