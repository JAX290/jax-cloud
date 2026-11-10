import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '客户端下载 · JAX CLOUD',
  description: 'v2rayN / v2rayNG / V2RayXS 客户端下载与订阅导入说明。',
}

type Client = {
  platform: string
  name: string
  size: string
  file: string
  note: string
  external?: boolean
  extra?: { label: string; file: string }
}

const clients: Client[] = [
  {
    platform: 'Windows',
    name: 'v2rayN',
    size: '144 MB · ZIP',
    file: '/downloads/v2rayN-windows-64.zip',
    note: '解压后双击 v2rayN.exe 运行，无需安装',
  },
  {
    platform: 'Android',
    name: 'v2rayNG',
    size: '71 MB · APK',
    file: '/downloads/v2rayNG_2.3.15_universal.apk',
    note: '下载后直接安装（需允许「未知来源」安装）',
  },
  {
    platform: 'iOS',
    name: 'Shadowrocket',
    size: 'App Store',
    file: 'https://apps.apple.com/app/shadowrocket/id932747118',
    note: '需要外区 Apple ID 才能搜索到；也可用其他支持 vless 的客户端',
    external: true,
  },
  {
    platform: 'macOS',
    name: 'V2RayXS',
    size: '21 MB · ZIP',
    file: '/downloads/V2RayXS_arm64.app.zip',
    note: 'Apple 芯片（M1/M2/M3）选这个',
    extra: { label: 'Intel 版', file: '/downloads/V2RayXS_x86_64.app.zip' },
  },
]

const quickSteps = [
  '登录「我的账户」，在「我的订阅」里找到要用的那条，点「复制节点」',
  '打开客户端：Windows 在节点列表空白处右键；安卓点右上角「＋」',
  '选「从剪贴板导入」，节点会自动加进来',
  '点一下节点连接，浏览器打开 google.com 验证',
]

const subSteps = [
  '登录「我的账户」，在「我的订阅」里点「复制订阅」，会得到一条 https://sub.jax.markets/... 开头的链接',
  'v2rayN：点顶部「订阅分组」→「订阅分组设置」→ 左下角「＋」→ 别名随便写、粘贴链接 → 确定',
  '回到主界面，点「订阅分组」→「更新全部订阅（不通过代理）」，节点就出现了',
  '以后你换了服务器或我们加了新节点，再点一次「更新全部订阅」，不用重新配置',
]

export default async function DownloadPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user || user.collection !== 'customers') {
    redirect('/login')
  }

  return (
    <div className="page dl-page">
      <div className="wrap dl-wrap">
        <div className="dl-head">
          <div className="kicker">// 客户端下载</div>
          <h1>选一个客户端，导入订阅就能用</h1>
          <p>
            下面都是 v2ray 官方客户端，免费开源。装好之后，把账户页的订阅链接粘进去就行。
          </p>
        </div>

        <div className="dl-grid">
          {clients.map((c) => (
            <article className="dl-card" key={c.platform}>
              <div className="dl-platform">{c.platform}</div>
              <h2>{c.name}</h2>
              <div className="dl-size">{c.size}</div>
              <p className="dl-note">{c.note}</p>
              <a
                className="btn btn-primary dl-btn"
                href={c.file}
                {...(c.external ? { target: '_blank', rel: 'noreferrer' } : { download: true })}
              >
                {c.external ? '前往 App Store' : '下载'}
              </a>
              {c.extra ? (
                <a className="dl-extra" href={c.extra.file} download>
                  {c.extra.label}（下载）
                </a>
              ) : null}
            </article>
          ))}
        </div>

        <section className="dl-methods">
          <h2>两种用法，选一个</h2>

          <div className="dl-method">
            <div className="dl-method-head">
              <span className="dl-method-tag">方式一</span>
              <h3>快速使用</h3>
            </div>
            <p className="dl-method-desc">
              复制一条链接，右键导入，马上能用。适合先试试，缺点是以后换节点要重新导一次。
            </p>
            <ol>
              {quickSteps.map((item, i) => (
                <li key={i}>
                  <span className="dl-step-no">{i + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="dl-method recommended">
            <div className="dl-method-head">
              <span className="dl-method-tag">方式二 · 推荐</span>
              <h3>稳定使用</h3>
            </div>
            <p className="dl-method-desc">
              配置一次订阅，以后换服务器、加节点都自动更新，不用再折腾。长期使用选这个。
            </p>
            <ol>
              {subSteps.map((item, i) => (
                <li key={i}>
                  <span className="dl-step-no">{i + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="dl-faq">
          <h2>几个常见问题</h2>
          <div className="dl-faq-item">
            <b>订阅链接打不开？</b>
            <p>先在浏览器里打开试试。如果浏览器能打开、客户端提示失败，多半是客户端版本太旧。</p>
          </div>
          <div className="dl-faq-item">
            <b>Windows 提示「缺少 WebView2」？</b>
            <p>v2rayN 需要系统里有 WebView2。Win10/11 一般自带，没有的话去微软官网下「WebView2 Runtime」。</p>
          </div>
          <div className="dl-faq-item">
            <b>iOS 搜不到 Shadowrocket？</b>
            <p>它只在中国区以外的 App Store 上架。需要一个非中国区 Apple ID，或者用你手上已有的 v2ray 客户端。</p>
          </div>
          <div className="dl-faq-item">
            <b>连上了但没网？</b>
            <p>先在客户端里点「更新订阅」，让节点列表刷新到最新；还不行就联系客服。</p>
          </div>
        </section>

        <div className="dl-foot">
          找不到订阅链接？<a href="/account">去我的账户</a> 或 <a href="/#contact">联系客服</a>
        </div>
      </div>
    </div>
  )
}
