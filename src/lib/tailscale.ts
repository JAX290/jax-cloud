/**
 * Tailscale CGNAT 段：100.64.0.0/10
 * 即 100.64.x.x ~ 100.127.x.x
 */
export function isTailscaleIp(ip?: string | null): boolean {
  if (!ip) return false
  const clean = String(ip).trim().replace(/^::ffff:/, '')
  const m = /^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(clean)
  if (!m) return false
  const second = Number(m[1])
  return second >= 64 && second <= 127
}

/** 从请求头里取客户端真实 IP（Caddy 会写入 X-Forwarded-For） */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for') || ''
  if (forwarded) {
    const first = forwarded.split(',')[0].trim()
    if (first) return first
  }
  return headers.get('x-real-ip') || ''
}
