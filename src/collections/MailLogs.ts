import type { CollectionConfig } from 'payload'

/** 邮件发送日志：限制、去重、排查都靠它 */
export const MailLogs: CollectionConfig = {
  slug: 'mail-logs',
  labels: { singular: '邮件日志', plural: '邮件日志' },
  admin: {
    group: '系统',
    useAsTitle: 'to',
    defaultColumns: ['to', 'type', 'status', 'createdAt'],
    description: '所有客户邮件的发送记录（用于限流、去重和排查）',
  },
  access: {
    read: ({ req: { user } }: any) => user?.collection === 'users',
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }: any) => user?.collection === 'users',
  },
  fields: [
    { name: 'to', type: 'text', label: '收件人', required: true, index: true },
    { name: 'type', type: 'text', label: '邮件类型', required: true, index: true },
    { name: 'subject', type: 'text', label: '主题' },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      options: [
        { label: '已发送', value: 'sent' },
        { label: '失败', value: 'failed' },
        { label: '跳过', value: 'skipped' },
      ],
    },
    { name: 'error', type: 'text', label: '错误' },
    { name: 'customerId', type: 'number', label: '客户 ID' },
    { name: 'dedupeKey', type: 'text', label: '去重 key' },
  ],
}
