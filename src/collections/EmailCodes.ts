import type { CollectionConfig } from 'payload'

/**
 * 邮箱验证码（注册 / 重置密码用）
 * 只由服务端通过 overrideAccess 读写，前台/客户不能直接访问
 */
export const EmailCodes: CollectionConfig = {
  slug: 'email-codes',
  labels: { singular: '邮箱验证码', plural: '邮箱验证码' },
  admin: {
    group: '系统',
    useAsTitle: 'email',
    defaultColumns: ['email', 'purpose', 'expiresAt', 'usedAt', 'createdAt'],
    description: '注册/重置密码的验证码记录，只存哈希，不存明文',
  },
  access: {
    read: ({ req: { user } }: any) => user?.collection === 'users',
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }: any) => user?.collection === 'users',
  },
  fields: [
    { name: 'email', type: 'text', label: '邮箱', required: true, index: true },
    { name: 'codeHash', type: 'text', label: '验证码哈希', required: true },
    {
      name: 'purpose',
      type: 'select',
      label: '用途',
      defaultValue: 'register',
      options: [
        { label: '注册', value: 'register' },
        { label: '重置密码', value: 'reset' },
      ],
    },
    { name: 'expiresAt', type: 'date', label: '过期时间' },
    { name: 'usedAt', type: 'date', label: '使用时间' },
    { name: 'attempts', type: 'number', label: '尝试次数', defaultValue: 0 },
  ],
}
