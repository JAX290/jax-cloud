/**
 * 统一邮件模板（品牌化）
 *
 * 所有发给客户的邮件都走这里，保证样式一致：
 * - 深色标题条 + 白底正文
 * - 中文口语化文案
 * - 统一页脚（品牌 + 官网 + 说明）
 */

const BRAND = 'JAX CLOUD'
const SITE = (process.env.SITE_URL || 'https://cloud.jax.markets').replace(/\/$/, '')

export function renderMail(options: {
  title: string
  /** 正文 HTML（已转义/已组装） */
  body: string
  /** 可选按钮 */
  cta?: { label: string; url: string }
  /** 页脚附加说明 */
  footerNote?: string
}): string {
  const { title, body, cta, footerNote } = options
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="display:inline-block;background:#0aa7c2;color:#041018;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${cta.label}</a></p>`
    : ''
  return `<!doctype html>
<html lang="zh-CN">
<body style="margin:0;padding:0;background:#f2f5f8">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1a2330;line-height:1.75">
    <div style="background:#071018;border-radius:14px 14px 0 0;padding:18px 22px">
      <div style="color:#22d3ee;font-size:15px;letter-spacing:.08em;font-weight:700">${BRAND}</div>
      <div style="color:#e8f2fa;font-size:19px;font-weight:600;margin-top:6px">${title}</div>
    </div>
    <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:22px">
      ${body}
      ${button}
      <p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #e6edf3;color:#8a9aaa;font-size:12px;line-height:1.7">
        ${footerNote ? `${footerNote}<br/>` : ''}
        这是一封系统邮件，请勿直接回复营销内容；有问题可以回复本邮件或联系客服。<br/>
        <a href="${SITE}" style="color:#0aa7c2;text-decoration:none">${SITE.replace(/^https?:\/\//, '')}</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

/** 纯文本版（部分邮件客户端看这个，也利于反垃圾评分） */
export function renderMailText(options: { title: string; lines: string[]; footerNote?: string }): string {
  return [options.title, '', ...options.lines, '', options.footerNote || '', `${BRAND} ${SITE}`]
    .filter(Boolean)
    .join('\n')
}
