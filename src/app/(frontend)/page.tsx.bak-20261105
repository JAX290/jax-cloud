import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

function imageSrc(url?: string) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.pathname + parsed.search
    }
    return url
  } catch {
    return url
  }
}

const fallbackSettings = {
  heroTitle: '把跨境业务，部署在|独立、稳定的环境里',
  heroSub:
    '服务器部署 + 运维托管：独立资源、按月付费，从开箱到上线由我们完成。',
  wechat: 'jax31415',
  contactName: '贾克斯',
  email: 'contact@jax.markets',
  disclaimer:
    '禁止一切违法违规业务接入，仅做交流学习使用。对于个人违规使用产生的一切后果由客户自行承担。',
  deployDedicated: 388,
  deployShared: 288,
  opsTiers: [
    { name: '1核1G', traffic: '1000G 流量', price: 80 },
    { name: '2核2G', traffic: '2000G 流量', price: 120 },
    { name: '4核4G', traffic: '4000G 流量', price: 240 },
    { name: '8核8G', traffic: '8000G 流量', price: 480 },
  ],
  qr: null as any,
}

export default async function HomePage() {
  const payload = await getPayload({ config })

  let settings: any = fallbackSettings
  let cases: any[] = []

  try {
    const doc = await payload.findGlobal({ slug: 'site-settings' })
    if (doc) {
      settings = { ...fallbackSettings, ...doc }
    }
  } catch {
    // 首次启动数据库为空时使用默认值
  }

  try {
    const result = await payload.find({
      collection: 'cases',
      where: { published: { equals: true }, image: { exists: true } },
      sort: 'order',
      limit: 4,
    })
    cases = result.docs
  } catch {
    cases = []
  }

  const [titleFirst, titleSecond] = String(settings.heroTitle || '').split('|')
  const opsTiers = settings.opsTiers?.length ? settings.opsTiers : fallbackSettings.opsTiers

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">CROSS-BORDER INFRASTRUCTURE</div>
            <h1>
              {titleFirst}
              {titleSecond ? (
                <>
                  <br />
                  <span className="glow">{titleSecond}</span>
                </>
              ) : null}
            </h1>
            <p className="lead">{settings.heroSub}</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/#contact">
                咨询报价 →
              </Link>
              <Link className="btn btn-ghost" href="/#pricing">
                查看价格
              </Link>
            </div>
            <div className="meta">
              <span>
                运维 <b>¥{opsTiers[0]?.price ?? 80}</b> 起 / 月
              </span>
              <span>
                独立部署 <b>¥{settings.deployDedicated}</b>
              </span>
              <span>
                年付 <b>9 折</b>
              </span>
            </div>
          </div>

          <div className="hero-side">
            <div className="orbit" aria-hidden="true">
              <div className="ring r1">
                <span className="dot" />
              </div>
              <div className="ring r2">
                <span className="dot" />
              </div>
              <div className="ring r3">
                <span className="dot" />
              </div>
              <div className="core" />
              <span className="chip c1">独立 IP</span>
              <span className="chip c2">环境隔离</span>
              <span className="chip c3">7×24 监控</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">// SERVICES</div>
            <h2>宝贵的时间，用来开拓客户</h2>
            <p>服务器部署、环境配置、日常运维这些杂活，交给我们就好，一键托管。</p>
          </div>
          <div className="grid grid-2">
            <article className="card">
              <div className="tag">一次性</div>
              <h3>服务器部署</h3>
              <p>系统初始化、运行环境配置、基础安全加固、域名解析与交付验收。</p>
              <div className="price">
                <span className="cur">¥</span>
                <span className="num">{settings.deployDedicated}</span>
                <span className="unit">/ 独立部署</span>
              </div>
              <div className="subprice">合用部署 ¥{settings.deployShared} · 一次性</div>
            </article>
            <article className="card">
              <div className="tag">按月</div>
              <h3>运维托管</h3>
              <p>服务器 + 监控 + 系统更新 + 故障响应，按月付费，年付 9 折。</p>
              <div className="price">
                <span className="cur">¥</span>
                <span className="num">{opsTiers[0]?.price ?? 80}</span>
                <span className="unit">起 / 月</span>
              </div>
              <div className="subprice">含服务器与基础运维</div>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">// PRICING</div>
            <h2>部署一次，运维按月</h2>
            <p>运维费用已包含服务器；年付享 9 折。所有价格可随配置调整，以沟通确认为准。</p>
          </div>

          <div className="grid grid-2">
            <article className="card">
              <div className="tag">一次性</div>
              <h3>独立部署</h3>
              <p>独享资源与环境，适合对稳定性和隔离有要求的业务。</p>
              <div className="price">
                <span className="cur">¥</span>
                <span className="num">{settings.deployDedicated}</span>
                <span className="unit">/ 次</span>
              </div>
              <ul className="list">
                <li>系统初始化 + 运行环境</li>
                <li>基础安全加固</li>
                <li>域名解析与上线验收</li>
              </ul>
            </article>
            <article className="card">
              <div className="tag">一次性</div>
              <h3>合用部署</h3>
              <p>共享资源、独立环境，适合起步阶段或轻量业务。</p>
              <div className="price">
                <span className="cur">¥</span>
                <span className="num">{settings.deployShared}</span>
                <span className="unit">/ 次</span>
              </div>
              <ul className="list">
                <li>系统初始化 + 运行环境</li>
                <li>基础安全加固</li>
                <li>域名解析与上线验收</li>
              </ul>
            </article>
          </div>

          <div className="grid grid-4" style={{ marginTop: 18 }}>
            {opsTiers.map((tier: any, index: number) => (
              <article className="card" key={index}>
                <div className="tag">运维托管</div>
                <h3>{tier.name}</h3>
                <p>{tier.traffic}</p>
                <div className="price">
                  <span className="cur">¥</span>
                  <span className="num">{tier.price}</span>
                  <span className="unit">/ 月</span>
                </div>
                <div className="subprice">
                  年付 ¥{Math.round(Number(tier.price) * 12 * 0.9)}（9 折）
                </div>
                <ul className="list">
                  <li>含服务器与基础运维</li>
                  <li>监控 + 系统更新 + 故障响应</li>
                  <li>故障响应与日常巡检</li>
                </ul>
              </article>
            ))}
          </div>
          <div className="note">
            年付优惠：运维服务按 <b>9 折</b> 一次性支付全年，相当于省下约 1.2 个月费用。
          </div>
        </div>
      </section>

      <section className="section" id="cases">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">// CASES</div>
            <h2>案例</h2>
            <p>只做部署与运维，挑几个真实场景看看我们怎么做。</p>
          </div>
          <div className="grid grid-2 cases-grid">
            {cases.length ? (
              cases.map((item: any) => (
                <Link
                  className="card case-card"
                  href={`/cases/${item.slug || item.id}`}
                  key={item.id}
                >
                  {item.image?.url ? (
                    <div className="case-image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageSrc(item.image.url)}
                        alt={item.image.alt || item.title || '案例配图'}
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="case-meta">{item.tag || 'CASE'}</div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <span className="case-link">查看详情 →</span>
                </Link>
              ))
            ) : (
              [1, 2, 3].map((item) => (
                <article className="card case-card" key={item}>
                  <div className="case-meta">CASE 0{item} · 待上传</div>
                  <h3>案例位置 {item}</h3>
                  <p>可在后台添加：客户场景、部署方案、结果。</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="wrap">
          <div className="contact">
            <div>
              <div className="kicker">// CONTACT</div>
              <h3>聊聊你的业务</h3>
              <p>
                告诉我们你的场景、预算和上线时间，我们会给出一版部署 + 运维的组合方案。本站暂不支持在线支付，确认方案后线下完成交易。
              </p>
              <div className="wechat">
                <span>微信</span>
                <b>{settings.wechat}</b>
                <span>· {settings.contactName}</span>
              </div>
              <p style={{ marginTop: 14 }}>
                邮箱：<a href={`mailto:${settings.email}`}>{settings.email}</a>
              </p>
              <p style={{ color: 'var(--amber)', fontSize: 12 }}>
                谨防冒充：仅通过以上微信号 / 邮箱联系，勿向任何第三方转账。
              </p>
            </div>
            <div className="qr">
              <div className="qr-frame">
                {settings.qr?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="微信二维码" src={imageSrc(settings.qr.url)} />
                ) : (
                  <div className="qr-ph">微信二维码<br />后台可上传</div>
                )}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>扫码添加好友</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="disclaimer">
        <div className="wrap">
          <div className="disclaimer">
            <div className="kicker">// DISCLAIMER</div>
            <h2>免责声明</h2>
            <p>{settings.disclaimer}</p>
            <ul>
              <li>本站仅提供合法的服务器部署、环境配置与运维技术服务，仅用于技术交流与学习。</li>
              <li>禁止接入任何违法违规业务，包括但不限于侵犯他人权益、传播违法信息、网络攻击、赌博、诈骗、侵权盗版等。</li>
              <li>客户应遵守所在国家 / 地区法律法规及第三方平台规则；因个人违规使用产生的一切后果，由客户自行承担。</li>
              <li>本站不承诺任何平台账号结果，也不构成对第三方平台政策的规避建议。</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
