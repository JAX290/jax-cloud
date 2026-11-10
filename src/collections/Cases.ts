import type { CollectionConfig } from 'payload'

import { notifyIndexNow } from '../lib/indexnow'

const isAdmin = (user: any) => user?.collection === 'users'

export const Cases: CollectionConfig = {
  slug: 'cases',
  labels: {
    singular: '案例',
    plural: '案例',
  },
  admin: {
    useAsTitle: 'title',
    group: '内容',
    defaultColumns: ['title', 'category', 'order', 'published'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }: any) => isAdmin(user),
    update: ({ req: { user } }: any) => isAdmin(user),
    delete: ({ req: { user } }: any) => isAdmin(user),
  },
  hooks: {
    // 案例发布/更新后主动推给 Bing（IndexNow），不用等它自己按 sitemap 发现
    afterChange: [
      async ({ doc }: any) => {
        try {
          if (!doc?.published) return
          const slug = String(doc.slug || doc.id || '').trim()
          const paths = ['/', '/cases']
          if (slug) paths.push(`/cases/${encodeURIComponent(slug)}`)
          await notifyIndexNow(paths)
        } catch {
          /* 推送失败不影响保存 */
        }
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: '标题',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'URL 标识',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: '用于 /cases/xxx，留空则用 ID',
      },
    },
    {
      name: 'category',
      type: 'select',
      label: '分类',
      options: [
        { label: '部署', value: 'deploy' },
        { label: '运维', value: 'ops' },
      ],
      defaultValue: 'deploy',
    },
    {
      name: 'tag',
      type: 'text',
      label: '标签',
    },
    {
      name: 'customer',
      type: 'text',
      label: '客户（可脱敏）',
    },
    {
      name: 'description',
      type: 'textarea',
      label: '描述',
    },
    {
      name: 'challenge',
      type: 'textarea',
      label: '遇到的问题',
    },
    {
      name: 'solution',
      type: 'textarea',
      label: '我们做了什么',
    },
    {
      name: 'result',
      type: 'textarea',
      label: '结果',
    },
    {
      name: 'metrics',
      type: 'array',
      label: '关键指标',
      fields: [
        { name: 'label', type: 'text', label: '指标名', required: true },
        { name: 'value', type: 'text', label: '数值', required: true },
      ],
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: '配图',
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: '首页推荐',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'order',
      type: 'number',
      label: '排序',
      defaultValue: 0,
      admin: { position: 'sidebar' },
    },
    {
      name: 'published',
      type: 'checkbox',
      label: '发布',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
  ],
}
