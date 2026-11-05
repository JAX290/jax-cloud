import type { CollectionConfig } from 'payload'

const isAdmin = (user: any) => user?.collection === 'users'
const isCustomer = (user: any) => user?.collection === 'customers'

export const Services: CollectionConfig = {
  slug: 'services',
  labels: {
    singular: '服务',
    plural: '服务',
  },
  admin: {
    useAsTitle: 'title',
    group: '客户',
    defaultColumns: ['title', 'customer', 'plan', 'status', 'expiresAt', 'renewalMonthlyPrice'],
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
      name: 'title',
      type: 'text',
      label: '服务名称',
      required: true,
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      label: '所属客户',
      required: true,
      index: true,
    },
    {
      name: 'plan',
      type: 'select',
      label: '套餐',
      options: [
        { label: '独立部署', value: 'deploy-independent' },
        { label: '合用部署', value: 'deploy-shared' },
        { label: '1核1G 运维', value: 'ops-1c1g' },
        { label: '2核2G 运维', value: 'ops-2c2g' },
        { label: '4核4G 运维', value: 'ops-4c4g' },
        { label: '8核8G 运维', value: 'ops-8c8g' },
      ],
      required: true,
    },
    {
      name: 'spec',
      type: 'text',
      label: '配置说明',
    },
    {
      name: 'price',
      type: 'number',
      label: '价格（元）',
    },
    {
      name: 'cycle',
      type: 'select',
      label: '计费周期',
      options: [
        { label: '一次性', value: 'one-time' },
        { label: '按月', value: 'monthly' },
        { label: '按年', value: 'yearly' },
      ],
      defaultValue: 'monthly',
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      options: [
        { label: '正常', value: 'active' },
        { label: '暂停', value: 'suspended' },
        { label: '已到期', value: 'expired' },
      ],
      defaultValue: 'active',
      required: true,
    },
    {
      name: 'startedAt',
      type: 'date',
      label: '开通时间',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'subscriptionContent',
      type: 'textarea',
      label: '订阅内容（客户可见）',
      admin: {
        description: '每行一条，客户后台会按条目展示。这里是核心交付内容。',
      },
    },
    {
      name: 'renewalMonthlyPrice',
      type: 'number',
      label: '续费月价（元）',
      admin: {
        description: '客户后台显示；续费 12 个月按 9 折自动计算。',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: '到期时间',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'serverIp',
      type: 'text',
      label: '服务器 IP',
    },
    {
      name: 'notes',
      type: 'textarea',
      label: '备注（仅后台可见）',
      access: {
        read: ({ req: { user } }: any) => isAdmin(user),
      },
    },
  ],
}
