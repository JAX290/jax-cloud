import type { CollectionConfig } from 'payload'

/** 图形验证码（防邮件轰炸）：只存哈希，5 分钟有效，用一次即作废 */
export const Captchas: CollectionConfig = {
  slug: 'captchas',
  labels: { singular: '图形验证码', plural: '图形验证码' },
  admin: { group: '系统', useAsTitle: 'ip', description: '发送验证邮件前的图形码，防轰炸' },
  access: {
    read: ({ req: { user } }: any) => user?.collection === 'users',
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }: any) => user?.collection === 'users',
  },
  fields: [
    { name: 'codeHash', type: 'text', label: '验证码哈希', required: true },
    { name: 'expiresAt', type: 'date', label: '过期时间' },
    { name: 'usedAt', type: 'date', label: '使用时间' },
    { name: 'ip', type: 'text', label: '来源 IP' },
  ],
}
