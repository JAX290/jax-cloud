import type { CollectionConfig } from 'payload'

import { notifyIndexNow } from '../lib/indexnow'

const isAdmin = (user: any) => user?.collection === 'users'

/**
 * 知识库（博客）文章
 *
 * - 后台：内容 → 知识库
 * - 前台：/blog（列表）、/blog/{slug}（详情）
 * - 发布后自动进 sitemap，并主动推 IndexNow（Bing 系）
 */
export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: {
    singular: '文章',
    plural: '知识库',
  },
  admin: {
    group: '内容',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'published', 'publishedAt', 'updatedAt'],
    description: '发布后自动进 sitemap.xml，并推 IndexNow 给 Bing',
  },
  access: {
    // 公开只能读已发布；草稿只有后台管理员能看（前台页面走 overrideAccess 单独取）
    read: ({ req: { user } }: any) => {
      if (user?.collection === 'users') return true
      return { published: { equals: true } }
    },
    create: ({ req: { user } }: any) => isAdmin(user),
    update: ({ req: { user } }: any) => isAdmin(user),
    delete: ({ req: { user } }: any) => isAdmin(user),
  },
  hooks: {
    afterChange: [
      async ({ doc }: any) => {
        try {
          if (!doc?.published) return
          const slug = String(doc.slug || doc.id || '').trim()
          const paths = ['/', '/blog']
          if (slug) paths.push(`/blog/${slug}`)
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
      label: 'URL 别名（英文/拼音）',
      required: true,
      unique: true,
      admin: {
        description: '例子：amazon-multi-store-ip，会成为 /blog/amazon-multi-store-ip',
      },
    },
    {
      name: 'category',
      type: 'select',
      label: '分类',
      defaultValue: 'troubleshoot',
      options: [
        { label: '问题排查', value: 'troubleshoot' },
        { label: '选型对比', value: 'compare' },
        { label: '案例复盘', value: 'case' },
      ],
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: '摘要（列表页和搜索结果里显示，150 字内）',
      maxLength: 300,
      admin: {
        description: '一句话说清这篇解决什么问题，会被用作 meta description',
      },
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      label: '封面图（可选）',
    },
    {
      name: 'content',
      type: 'richText',
      label: '正文',
    },
    {
      name: 'tags',
      type: 'text',
      label: '标签（逗号分隔，可选）',
    },
    {
      name: 'published',
      type: 'checkbox',
      label: '已发布',
      defaultValue: false,
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: '发布时间',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'publishAt',
      type: 'date',
      label: '定时发布（留空=手动发布）',
      admin: {
        description: '填一个未来时间，到点由定时任务自动勾「已发布」并推 IndexNow；留空则等你手动勾发布',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
}
