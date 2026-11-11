import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import AddToCart from '@/components/AddToCart'
import CartBar from '@/components/CartBar'
import LexicalContent from '@/components/LexicalContent'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const fallbackSettings = {
  wechat: 'jax31415',
  contactName: '贾克斯',
  email: 'contact@jax.markets',
  disclaimer:
    '禁止一切违法违规业务接入，仅做交流学习使用。对于个人违规使用产生的一切后果由客户自行承担。',
  qr: null as any,
}

const capabilities = [
  {
    key: 'P1',
    name: '身份稳定',
    desc: '一个 IP 长期绑定，环境整套对齐。换设备登回来，还是同一个 IP。',
  },
  {
    key: 'P2',
    name: '血统干净',
    desc: '独享 IP，不从共享池分。纯净度九十分以上，主流平台可测。',
  },
  {
    key: 'P3',
    name: '在线稳定',
    desc: '专线节点，低抖动。故障秒级恢复，重连还是同一个 IP。',
  },
  {
    key: 'P4',
    name: '流量自由',
    desc: '一个订阅一个流量池，几台设备一起用都从这里扣，不重复计费。',
  },
  {
    key: 'P5',
    name: '省心好用',
    desc: '免硬件、免配置，登录即用。手机电脑同时在线。',
  },
]

const trafficPlans = [
  {
    name: '轻量档',
    cap: '200G',
    price: 80,
    unit: '¥0.40 / G',
    desc: '日常运营、客服沟通、轻度 AI',
    hot: false,
  },
  {
    name: '标准档',
    cap: '1000G',
    price: 150,
    unit: '¥0.15 / G',
    desc: '直播、视频上传、AI 出图与视频',
    hot: true,
  },
]

const topups = [
  { size: '100G', price: 30 },
  { size: '500G', price: 60 },
  { size: '1000G', price: 120 },
]

const storyCases = [
  {
    tag: '案例 01',
    who: '亚马逊 · 王先生 · 义乌',
    title: '三个店，一夜之间全停了',
    lines: [
      '三个店，品牌、收款、运营、电脑全部是分开的。凌晨两点，三封邮件：账户已停用。',
      '申诉三遍，回复只有一句——与已知风险账户存在关联。后来查到：三个店的网络，都来自同一个共享 IP 池。',
    ],
    quote: '在平台眼里，他跟那个刷单的，住一栋楼。',
  },
  {
    tag: '案例 02',
    who: 'TikTok 直播 · 李女士 · 广州',
    title: '二十秒，走了一千八百人',
    lines: [
      '晚上八点二十，在线刚破三千，她正讲版型，画面停了，然后黑屏。二十秒后重连，人剩一千二。',
      '她换过宽带、路由器、运营商，都没用。问题不在网速，在那个 IP 被很多人用过，权重本来就低。',
    ],
    quote: '直播比的不是带宽，是不抖、不被限流。',
  },
  {
    tag: '案例 03',
    who: '外贸 WhatsApp · 陈先生 · 永康',
    title: '那个号里有三百个客户',
    lines: [
      '一个月换三个号，新号养三天就封。迪拜客户聊了两个月，样品都寄了，号封那天客户找不到人。',
      '半个月后，单子下给了别人。换固定 IP 之后，那个号用到现在，大半年没出事。',
    ],
    quote: '不是钱的事，是人家觉得你这人不靠谱。',
  },
  {
    tag: '案例 04',
    who: '社媒投流 · 张先生 · 深圳',
    title: '投了一个月，一点效果都没有',
    lines: [
      '新号注册，内容、投流都做了，数据一直不动。他以为是素材问题，换了三版，还是一样。',
      '后来查出来：注册时用的网络环境不干净，号从第一天就被标记，限流悄悄进行，后台看不到。',
    ],
    quote: '换干净环境重开一个号，一周二十多个询盘，成交三单。',
  },
]

const faqs = [
  {
    q: '这个跟机场、跟梯子有什么区别？',
    a: '机场解决的是「能出去」，IP 共享、随时漂、一封一串。我们解决的是「账号能活」：IP 是你的、固定不变，环境整套对齐。如果只是看看视频，机场够用；如果拿它养号做生意，机场会害了你。',
  },
  {
    q: '跟指纹浏览器加代理 IP 比呢？',
    a: '那个方案能用，但要自己拼：指纹浏览器买一个，IP 再单独买，两边还得对上，时区、语言、DNS 全得自己调。我们是一套打包好的，IP 和环境绑定，不用你调，出问题有人管。',
  },
  {
    q: '一次部署给几个 IP？',
    a: '1 个。一次部署交付 1 个独立固定 IP，同一 IP 下最多 4 台（入门版）或 8 台（进阶版）设备同时登录。如果需要多个互相隔离的 IP，就部署多次，每次会分配到不同的 VPS。',
  },
  {
    q: '「最多 8 台设备」是什么意思？',
    a: '指同一个 IP 下最多允许 8 台设备同时在线（电脑、手机、平板都算）。超过上限时，需要先下线一台，再上新的。设备数不等于 IP 数——IP 永远只有 1 个。',
  },
  {
    q: '多台设备流量怎么算？会不会重复扣？',
    a: '不会。一个订阅只有一个流量池，几台设备、几个 IP 一起用，都从同一个池子里扣，不重复计费。用超了再买加油包，当场到账。',
  },
  {
    q: '能保证不封号吗？',
    a: '没人能保证。平台封号的原因太多——内容违规、侵权、被举报，这些我们管不了。我们能保证的是：不让你因为 IP 和网络环境被封。剩下的，得靠你自己守规矩。',
  },
  {
    q: '纯净度九十分，哪个平台测的？',
    a: 'IPPURE、IPCECE、IPTOUSHI 这几家主流平台，测出来都是九十分以上。你拿到手可以自己上去测，报告随环境一起给你。',
  },
  {
    q: 'IP 会不会哪天突然变了？',
    a: '不会。IP 是长期绑定的，除非你自己要求换。设备坏了、换电脑、换手机，登上去还是那个 IP。',
  },
  {
    q: '断线了怎么办？',
    a: '平台侧故障，秒级恢复；你这边网络或设备问题，重新登就行，还是原来那个 IP。全天候有人盯，跨境时差也有人在。',
  },
  {
    q: '到期没续费，数据还在吗？',
    a: '在。到期后备份保留 30 天，30 天内回来续费，免部署费。IP 视当时库存安排，多数情况下还是原来那个。',
  },
  {
    q: '1 小时体验是什么？',
    a: '免费给你一个完整环境，1 小时、1G 流量，够你看清楚 IP 是不是固定的、干不干净、稳不稳。测完觉得行，再谈套餐。',
  },
]

export default async function HomePage() {
  const payload = await getPayload({ config })

  let settings: any = fallbackSettings

  try {
    const doc = await payload.findGlobal({ slug: 'site-settings' })
    if (doc) {
      settings = { ...fallbackSettings, ...doc }
    }
  } catch {
    // 首次启动数据库为空时使用默认值
  }

  // 首页知识库：已发布文章，卡片默认折叠，点开看全文
  let posts: any[] = []
  try {
    const found: any = await payload.find({
      collection: 'posts',
      where: { published: { equals: true } },
      sort: '-publishedAt',
      limit: 6,
      depth: 1,
      overrideAccess: true,
    })
    posts = (found.docs || []) as any[]
  } catch {
    posts = []
  }

  const BLOG_CAT: Record<string, string> = {
    troubleshoot: '问题排查',
    compare: '选型对比',
    case: '案例复盘',
  }

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">跨境网络环境部署</div>
            <h1>
              把海外账号，养在
              <br />
              <span className="glow">独立、稳定的环境里</span>
            </h1>
            <p className="lead">
              固定 IP、独享环境、全天候在线。把跨境经营要用的网络环境，一次配好。
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/#contact">
                免费体验 1 小时
              </Link>
              <Link className="btn btn-ghost" href="/#pricing">
                看价格
              </Link>
            </div>
            <div className="meta">
              <span>
                部署 <b>¥288</b> 起
              </span>
              <span>
                流量 <b>¥80</b> 起 / 月
              </span>
              <span>
                年付 <b>省 10%</b>
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
              <span className="chip c1">固定 IP</span>
              <span className="chip c2">环境隔离</span>
              <span className="chip c3">全天候在线</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CASES ================= */}
      <section className="section" id="cases">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">// 真实案例</div>
            <h2>因网络问题，损失惨重</h2>
            <p>不是他们违规，是环境不对。以下为情景示例，人物与细节均为虚构，非特定客户。</p>
          </div>

          <div className="grid grid-2">
            {storyCases.map((item) => (
              <article className="card case-card" key={item.tag}>
                <div className="case-meta">
                  <span>{item.tag}</span>
                  <span>{item.who}</span>
                </div>
                <h3>{item.title}</h3>
                {item.lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                <div className="case-quote">{item.quote}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CAPABILITY ================= */}
      <section className="section" id="services">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">// 产品能力</div>
            <h2>五个维度，压实跨境地基</h2>
            <p>你的时间和精力，应该花在开发客户上。这些基础又专业的事，交给我们。</p>
          </div>

          <div className="grid grid-5">
            {capabilities.map((cap) => (
              <article className="card cap-card" key={cap.key}>
                <div className="cap-key">{cap.key}</div>
                <h3>{cap.name}</h3>
                <p>{cap.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section className="section" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">// 价格方案</div>
            <h2>一次订阅 · 一次部署 · 流量按需</h2>
            <p>同一订阅内，所有设备共享当前流量。部署只收一次，流量按月续。</p>
          </div>

          {/* ---- 部署费 ---- */}
          <div className="price-block">
            <div className="price-block-head">
              <h3>部署费</h3>
              <em>单次收取 · 首月免费</em>
            </div>

            {/* 主推：进阶版 */}
            <article className="card plan-main">
              <div className="plan-main-copy">
                <div className="plan-badge">推荐 · 跨境电商</div>
                <h3>进阶版</h3>
                <div className="price">
                  <span className="cur">¥</span>
                  <span className="num">388</span>
                  <span className="unit">/ 一次性</span>
                </div>
                <p className="plan-sub">1 个固定 IP · 最多 8 台设备共用</p>
                <AddToCart
                  full
                  item={{
                    type: 'deploy',
                    plan: 'advanced',
                    name: '进阶版部署',
                    amount: 388,
                    days: 30,
                    trafficGB: 200,
                    ipLimit: 8,
                  }}
                  label="加入购物车"
                />
              </div>
              <ul className="list plan-main-list">
                <li>交付 1 个独立固定 IP，长期不变</li>
                <li>手机、电脑、平板、软路由可同时登录（最多 8 台）</li>
                <li>专线带宽，直播、投流、AI 都够用</li>
                <li>需要多个独立 IP？再部署一次即可</li>
              </ul>
            </article>

            {/* 过渡 + 入门版 */}
            <div className="plan-divider">
              <span className="plan-divider-text">
                不是跨境电商？如果只需要一个稳定的访问环境，共享线路完全够用。
              </span>
            </div>

            <article className="card plan-entry">
              <div className="plan-entry-copy">
                <h3>
                  入门版 <span>共享线路</span>
                </h3>
                <div className="price">
                  <span className="cur">¥</span>
                  <span className="num">288</span>
                  <span className="unit">/ 一次性</span>
                </div>
                <p className="plan-sub">1 个固定 IP · 最多 4 台设备共用</p>
                <AddToCart
                  full
                  item={{
                    type: 'deploy',
                    plan: 'basic',
                    name: '入门版部署',
                    amount: 288,
                    days: 30,
                    trafficGB: 200,
                    ipLimit: 4,
                  }}
                  label="加入购物车"
                />
              </div>
              <ul className="list plan-entry-list">
                <li>交付 1 个独立固定 IP，长期不变</li>
                <li>手机、电脑、平板可同时登录（最多 4 台）</li>
                <li>仅带宽共用，完全满足日常访问需求</li>
                <li>需要多个独立 IP？再部署一次即可</li>
              </ul>
            </article>
          </div>

          {/* ---- 流量费 ---- */}
          <div className="price-block">
            <div className="price-block-head">
              <h3>流量费</h3>
              <em>按月 · 续费即用</em>
            </div>
            <div className="grid grid-2">
              {trafficPlans.map((plan) => (
                <article className={`card plan-card${plan.hot ? ' hot' : ''}`} key={plan.name}>
                  <h3>{plan.name}</h3>
                  <div className="price">
                    <span className="cur">¥</span>
                    <span className="num">{plan.price}</span>
                    <span className="unit">/ 月</span>
                  </div>
                  <div className="unit-price">
                    每月 {plan.cap}　<span>{plan.unit}</span>
                  </div>
                  <div className="year-price">
                    年付 <b>¥{Math.round(plan.price * 12 * 0.9)}</b>
                    <em>立省 10%</em>
                  </div>
                  <p>{plan.desc}</p>
                  <AddToCart
                    item={{
                      type: 'traffic',
                      name: `${plan.name} · 每月 ${plan.cap}`,
                      amount: plan.price,
                      days: 30,
                      trafficGB: Number(String(plan.cap).replace('G', '')),
                      ipLimit: 4,
                    }}
                    label="加入购物车"
                  />
                </article>
              ))}
            </div>

            <div className="topup">
              <span className="topup-label">流量加油包</span>
              {topups.map((t) => (
                <span className="topup-item" key={t.size}>
                  {t.size} <b>¥{t.price}</b>
                  <AddToCart
                    item={{
                      type: 'topup',
                      name: `流量加油包 ${t.size}`,
                      amount: t.price,
                      days: 30,
                      trafficGB: Number(String(t.size).replace('G', '')),
                      ipLimit: 4,
                    }}
                    label="+"
                  />
                </span>
              ))}
              <span className="topup-note">用完即停，随时补量，当场到账</span>
            </div>
          </div>

          {/* ---- 续费政策 ---- */}
          <div className="price-block">
            <div className="price-block-head">
              <h3>到期与续费</h3>
              <em>不自动扣费</em>
            </div>
            <div className="grid grid-3">
              <article className="card policy-card">
                <h4>保留 30 天</h4>
                <p>到期未续费，备份数据保留 30 天，随时可以回来。</p>
              </article>
              <article className="card policy-card">
                <h4>回来免部署费</h4>
                <p>30 天内重新订阅，部署费全免，直接接着用。</p>
              </article>
              <article className="card policy-card">
                <h4>IP 视库存</h4>
                <p>重新订阅时 IP 尽量沿用原来的，以当时库存为准。</p>
              </article>
            </div>
            <div className="note">
              年付 <b>立省 10%</b> · 首次部署首月流量免费 · 可先领 <b>1 小时体验（1G 流量）</b>，看完报告再决定。
            </div>
          </div>
        </div>
      </section>

      {/* ================= 知识库 ================= */}
      <section className="section" id="blog">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">// 知识库</div>
            <h2>踩过的坑，写成答案</h2>
            <p>跨境环境里反复出现的问题，整理成能照着做的文章。点开卡片直接看全文。</p>
          </div>

          {posts.length ? (
            <div className="grid grid-2 home-blog">
              {posts.map((post: any) => (
                <details className="card home-blog-card" key={post.id}>
                  <summary>
                    <span className="blog-cat">{BLOG_CAT[post.category] || '知识库'}</span>
                    <h3>{post.title}</h3>
                    {post.excerpt ? <p>{String(post.excerpt).slice(0, 110)}</p> : null}
                    <span className="home-blog-more">展开看全文 →</span>
                  </summary>
                  <div className="home-blog-body">
                    <LexicalContent content={post.content} />
                    <Link className="home-blog-link" href={`/blog/${post.slug || post.id}`}>
                      在独立页面看 →
                    </Link>
                  </div>
                </details>
              ))}
            </div>
          ) : null}

          <div className="home-cases-all">
            <Link className="btn btn-ghost" href="/blog">
              全部文章
            </Link>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="section" id="faq">
        <div className="wrap faq-wrap">
          <div className="section-head">
            <div className="kicker">// 常见问题</div>
            <h2>你可能想问的</h2>
          </div>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: faqs.map((f) => ({
                  '@type': 'Question',
                  name: f.q,
                  acceptedAnswer: { '@type': 'Answer', text: f.a },
                })),
              }),
            }}
          />

          <div className="faq-list">
            {faqs.map((item) => (
              <details className="faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section className="section" id="contact">
        <div className="wrap">
          <div className="contact">
            <div>
              <div className="kicker">// 联系我们</div>
              <h3>有任何问题，都可以直接找我们</h3>
              <p>
                不管是刚起步，还是已经在跑量，网络环境这块有疑问都可以来问一句。
                我们可以先给你开一个测试环境（1 小时、1G 流量），试完再决定要不要开。
              </p>

              <div className="contact-channels">
                <div className="channel">
                  <div className="channel-head">
                    <b>微信</b>
                    <span>国内客户 · 回复最快</span>
                  </div>
                  <p>
                    微信号 <b>{settings.wechat}</b>（{settings.contactName}）
                  </p>
                  <p className="channel-tip">
                    扫码加好友，备注「体验」；付款、开票、售后也都走微信。
                  </p>
                </div>

                <div className="channel">
                  <div className="channel-head">
                    <b>WhatsApp</b>
                    <span>海外 / 手机号 · 直接开聊</span>
                  </div>
                  <p>
                    {settings.whatsapp ? (
                      <a
                        className="btn btn-primary"
                        href={settings.whatsapp}
                        target="_blank"
                        rel="noreferrer"
                      >
                        打开 WhatsApp 聊
                      </a>
                    ) : (
                      <span className="channel-tip">（后台还没填 WhatsApp 链接）</span>
                    )}
                  </p>
                  <p className="channel-tip">
                    手机点按钮直接聊；电脑可以用右边的二维码扫一下。
                  </p>
                </div>
              </div>

              <p className="contact-email">
                邮箱：<a href={`mailto:${settings.email}`}>{settings.email}</a>
              </p>

              <div className="contact-warn">
                <span className="contact-warn-tag">提醒</span>
                <span>
                  我们只会用上面这几个渠道联系你，不会让你把钱转给任何个人或第三方账户；遇到可疑信息，先来这边核实一下。
                </span>
              </div>
            </div>

            <div className="qr qr-two">
              <div className="qr-card">
                <div className="qr-frame">
                  {settings.qr?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="微信二维码" src={settings.qr.url} />
                  ) : (
                    <div className="qr-ph">
                      微信二维码
                      <br />
                      后台可上传
                    </div>
                  )}
                </div>
                <div className="qr-label">
                  <b>微信</b>
                  <span>扫码加好友</span>
                </div>
              </div>
              <div className="qr-card">
                <div className="qr-frame">
                  {settings.whatsappQrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="WhatsApp 二维码" src={settings.whatsappQrUrl} />
                  ) : (
                    <div className="qr-ph">
                      WhatsApp
                      <br />
                      二维码
                    </div>
                  )}
                </div>
                <div className="qr-label">
                  <b>WhatsApp</b>
                  <span>扫码直接聊</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= DISCLAIMER ================= */}
      <section className="section" id="disclaimer">
        <div className="wrap">
          <div className="disclaimer">
            <div className="kicker">// 免责声明</div>
            <h2>免责声明</h2>
            <p>{settings.disclaimer}</p>
            <ul>
              <li>本站仅提供合法的网络环境部署与运维技术服务，仅用于合法的跨境经营与技术交流。</li>
              <li>
                禁止接入任何违法违规业务，包括但不限于侵犯他人权益、传播违法信息、网络攻击、赌博、诈骗、侵权盗版等。
              </li>
              <li>客户应遵守所在国家 / 地区法律法规及第三方平台规则；因个人违规使用产生的一切后果，由客户自行承担。</li>
              <li>本站不承诺任何平台账号结果，也不构成对第三方平台政策的规避建议。案例为情景示例，人物与细节均为虚构。</li>
            </ul>
          </div>
        </div>
      </section>
      <CartBar />
    </>
  )
}
