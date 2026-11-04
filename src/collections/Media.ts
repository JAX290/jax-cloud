import type { CollectionConfig } from 'payload'

const isAdmin = (user: any) => user?.collection === 'users'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: '媒体',
    plural: '媒体',
  },
  admin: {
    group: '系统',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }: any) => isAdmin(user),
    update: ({ req: { user } }: any) => isAdmin(user),
    delete: ({ req: { user } }: any) => isAdmin(user),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: '替代文本',
      required: true,
    },
  ],
  upload: true,
}
