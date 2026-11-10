import type { CollectionConfig } from 'payload'

import { nextCustomerNo } from '../lib/customerNo'

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
    beforeChange: [
      async ({ data, operation, req }: any) => {
        if (operation === 'create' && !data.customerNo) {
          data.customerNo = await nextCustomerNo(req.payload)
        }
        return data
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
  ],
}
