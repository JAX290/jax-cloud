'use client'

import { QRCodeSVG } from 'qrcode.react'

/** 订阅/节点链接二维码：vless 链接直接扫码导入，手机端一步到位 */
export default function SubQr({
  value,
  label,
  size = 132,
}: {
  value: string
  label: string
  size?: number
}) {
  if (!value) return null
  return (
    <div className="sub-qr">
      <div className="sub-qr-box">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          bgColor="#ffffff"
          fgColor="#031018"
          marginSize={2}
          title={label}
        />
      </div>
      <div className="sub-qr-label">{label}</div>
    </div>
  )
}
