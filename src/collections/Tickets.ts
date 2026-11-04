import type { CollectionConfig } from 'payload'

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
