import type { GlobalConfig } from 'payload'

const isAdmin = (user: any) => user?.collection === 'users'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: '站点设置',
  admin: {
    group: '内容',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }: any) => isAdmin(user),
  },
  fields: [
    {
      name: 'heroTitle',
      type: 'text',
      label: '首页标题（用 | 换行）',
      defaultValue: '把跨境业务，部署在|独立、稳定的环境里',
    },
    {
      name: 'heroSub',
      type: 'textarea',
      label: '首页副标题',
      defaultValue:
        '面向跨境电商卖家的服务器部署与运维托管：环境配置、独立资源、按月付费，从开箱到上线由我们完成。',
    },
    {
      name: 'wechat',
      type: 'text',
      label: '微信号',
      defaultValue: 'jax31415',
    },
    {
      name: 'whatsapp',
      type: 'text',
      label: 'WhatsApp 联系链接',
      admin: {
        description: '点开就能聊的链接，如 https://wa.me/qr/xxxxx 或 https://wa.me/8613800000000',
      },
    },
    {
      name: 'whatsappQrUrl',
      type: 'text',
      label: 'WhatsApp 二维码图片地址',
      admin: {
        description: '先在「媒体」里上传图片，再把 URL 粘到这里，如 /api/media/file/whatsapp-qr.jpg',
      },
    },
    {
      name: 'contactName',
      type: 'text',
      label: '对外称呼',
      defaultValue: '贾克斯',
    },
    {
      name: 'email',
      type: 'text',
      label: '联系邮箱',
      defaultValue: 'contact@jax.markets',
    },
    {
      name: 'disclaimer',
      type: 'textarea',
      label: '免责声明',
      defaultValue:
        '禁止一切违法违规业务接入，仅做交流学习使用。对于个人违规使用产生的一切后果由客户自行承担。',
    },
    {
      name: 'qr',
      type: 'upload',
      relationTo: 'media',
      label: '微信二维码',
    },
    {
      name: 'deployDedicated',
      type: 'number',
      label: '独立部署价格',
      defaultValue: 388,
    },
    {
      name: 'deployShared',
      type: 'number',
      label: '合用部署价格',
      defaultValue: 288,
    },
    {
      name: 'opsTiers',
      type: 'array',
      label: '运维价格档位',
      defaultValue: [
        { name: '1核1G', traffic: '1000G 流量', price: 80 },
        { name: '2核2G', traffic: '2000G 流量', price: 120 },
        { name: '4核4G', traffic: '4000G 流量', price: 240 },
        { name: '8核8G', traffic: '8000G 流量', price: 480 },
      ],
      fields: [
        { name: 'name', type: 'text', label: '规格', required: true },
        { name: 'traffic', type: 'text', label: '流量' },
        { name: 'price', type: 'number', label: '月价（元）', required: true },
      ],
    },
  ],
}
