import type { CollectionConfig } from 'payload'

import { renderMail, renderMailText } from '../lib/mail-templates'
import { sendMail } from '../lib/mailer'

const isAdmin = (user: any) => user?.collection === 'users'
const isCustomer = (user: any) => user?.collection === 'customers'

export const Tickets: CollectionConfig = {
  slug: 'tickets',
  labels: {
    singular: '工单',
    plural: '工单',
  },
  admin: {
    useAsTitle: 'subject',
    group: '客户',
    defaultColumns: ['subject', 'customer', 'status', 'priority', 'updatedAt'],
  },
  hooks: {
    afterChange: [
      // 客服在后台回复工单 → 给客户发邮件，客户不用一直刷页面
      async ({ doc, previousDoc, operation, req }: any) => {
        try {
          if (operation !== 'update') return
          const prevLen = Array.isArray(previousDoc?.messages) ? previousDoc.messages.length : 0
          const curLen = Array.isArray(doc.messages) ? doc.messages.length : 0
          if (curLen <= prevLen) return
          const last = doc.messages[curLen - 1]
          if (!last?.isStaff) return

          const custId = typeof doc.customer === 'object' ? doc.customer?.id : doc.customer
          if (!custId) return
          const cust: any = await req.payload.findByID({
            collection: 'customers',
            id: custId,
            depth: 0,
            overrideAccess: true,
          })
          if (!cust?.email) return

          const site = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')
          const escape = (s: string) =>
            String(s || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
          const reply = escape(last.body).slice(0, 800)
          const who = cust.name ? `，${cust.name}` : ''
          const subject = String(doc.subject || '')

          await sendMail(req.payload, {
            to: cust.email,
            type: 'ticket_reply',
            customerId: cust.id,
            dedupeKey: `ticket-${doc.id}-${curLen}`,
            subject: `工单有新回复：${subject}`.slice(0, 80),
            html: renderMail({
              title: '工单有新回复',
              body: `
                <p>你好${who}：</p>
                <p>你的工单「${escape(subject)}」有新的回复：</p>
                <p style="background:#f2f7fa;padding:12px;border-radius:8px;white-space:pre-wrap">${reply}</p>
              `,
              cta: { label: '查看工单并回复', url: `${site}/account/tickets/${doc.id}` },
            }),
            text: renderMailText({
              title: '工单有新回复',
              lines: [`工单：${subject}`, `回复：${String(last.body || '')}`],
            }),
          })
        } catch {
          /* 邮件失败不影响工单 */
        }
      },
    ],
  },
  access: {
    read: ({ req: { user } }: any) => {
      if (isAdmin(user)) return true
      if (isCustomer(user)) return { customer: { equals: user.id } }
      return false
    },
    create: ({ req: { user } }: any) => isAdmin(user),
    update: ({ req: { user } }: any) => isAdmin(user),
    delete: ({ req: { user } }: any) => isAdmin(user),
  },
  fields: [
    {
      name: 'subject',
      type: 'text',
      label: '标题',
      required: true,
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
      name: 'category',
      type: 'select',
      label: '分类',
      options: [
        { label: '部署问题', value: 'deploy' },
        { label: '运维问题', value: 'ops' },
        { label: '账单/续费', value: 'billing' },
        { label: '其他', value: 'other' },
      ],
      defaultValue: 'ops',
      required: true,
    },
    {
      name: 'priority',
      type: 'select',
      label: '优先级',
      options: [
        { label: '低', value: 'low' },
        { label: '普通', value: 'normal' },
        { label: '高', value: 'high' },
      ],
      defaultValue: 'normal',
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      options: [
        { label: '待处理', value: 'open' },
        { label: '处理中', value: 'pending' },
        { label: '已解决', value: 'resolved' },
        { label: '已关闭', value: 'closed' },
      ],
      defaultValue: 'open',
      required: true,
      index: true,
    },
    {
      name: 'messages',
      type: 'array',
      label: '对话',
      fields: [
        {
          name: 'author',
          type: 'text',
          label: '作者',
        },
        {
          name: 'isStaff',
          type: 'checkbox',
          label: '官方回复',
          defaultValue: false,
        },
        {
          name: 'body',
          type: 'textarea',
          label: '内容',
          required: true,
        },
        {
          name: 'createdAt',
          type: 'date',
          label: '时间',
        },
      ],
    },
  ],
}
