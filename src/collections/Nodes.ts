import type { CollectionConfig } from 'payload'

const isAdmin = (user: any) => user?.collection === 'users'

export const Nodes: CollectionConfig = {
  slug: 'nodes',
  labels: {
    singular: '节点',
    plural: '节点',
  },
  admin: {
    useAsTitle: 'name',
    group: '节点',
    defaultColumns: ['name', 'ip', 'panelPort', 'status', 'lastCheckAt'],
  },
  access: {
    admin: ({ req: { user } }: any) => isAdmin(user),
    read: () => true,
    create: ({ req: { user } }: any) => isAdmin(user),
    update: ({ req: { user } }: any) => isAdmin(user),
    delete: ({ req: { user } }: any) => isAdmin(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: '节点名称',
      required: true,
      admin: { description: '如「洛杉矶-01」' },
    },
    {
      name: 'ip',
      type: 'text',
      label: '公网 IP',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'region',
      type: 'text',
      label: '地区',
    },
    {
      name: 'panelPort',
      type: 'number',
      label: '面板端口',
      defaultValue: 2053,
    },
    {
      name: 'panelPath',
      type: 'text',
      label: '面板路径',
      defaultValue: 'jaxpanel',
    },
    {
      name: 'token',
      type: 'text',
      label: 'API Token',
      admin: { description: '探测时自动获取，也可手动填' },
    },
    {
      name: 'subPort',
      type: 'number',
      label: '订阅端口',
    },
    {
      name: 'subPath',
      type: 'text',
      label: '订阅路径',
    },
    {
      name: 'status',
      type: 'select',
      label: '状态',
      options: [
        { label: '在线', value: 'online' },
        { label: '离线', value: 'offline' },
        { label: '维护', value: 'maintenance' },
      ],
      defaultValue: 'online',
      index: true,
    },
    {
      name: 'lastCheckAt',
      type: 'date',
      label: '最后检测时间',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'capacity',
      type: 'number',
      label: '可容纳客户端数',
      admin: { description: '留空表示不限' },
    },
    {
      name: 'clientCount',
      type: 'number',
      label: '当前客户端数',
      admin: { readOnly: true },
    },
    {
      name: 'note',
      type: 'textarea',
      label: '备注',
    },
  ],
}
