import type { MetadataRoute } from 'next'

const SITE = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')

/**
 * robots.txt
 * 只放行营销页；账户、订单、下载、登录注册、工作台、后台、接口全部不抓。
 * 订阅域名（sub.jax.markets）在 Caddy 里单独返回 Disallow: /，见 Caddyfile。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/account',
          '/account/',
          '/orders',
          '/download',
          '/downloads/',
          '/login',
          '/register',
          '/forgot',
          '/reset',
          '/verify',
          '/staff',
          '/admin',
          '/api/',
          '/sub/',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
