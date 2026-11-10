import type { CollectionConfig } from 'payload'

import { clientIpFromHeaders, isTailscaleIp } from '../lib/tailscale'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: '系统',
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 60 * 60 * 8,
    cookies: { secure: true, sameSite: 'Lax' },
    strategies: [
      {
        name: 'tailscale-network',
        // 请求来自 Tailscale 网段时，自动识别为管理员（网络层已由 Caddy 拦截）
        authenticate: async ({ headers, payload }: any) => {
          try {
            const ip = clientIpFromHeaders(headers)
            if (!isTailscaleIp(ip)) return { user: null }

            const found = await payload.find({
              collection: 'users',
              limit: 1,
              depth: 0,
              sort: 'id',
              overrideAccess: true,
            })
            const user = found?.docs?.[0] || null
            return { user }
          } catch {
            return { user: null }
          }
        },
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: '称呼',
    },
  ],
}
