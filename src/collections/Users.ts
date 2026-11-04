import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: '系统',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      label: '称呼',
    },
  ],
}
