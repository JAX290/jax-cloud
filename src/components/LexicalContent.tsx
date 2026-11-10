import React from 'react'

/**
 * 极简 Lexical 富文本渲染器（服务端）
 *
 * Payload 的 richtext 在数据库里是 Lexical JSON。这里只处理文章里会用到的节点：
 * 段落、标题、列表、引用、链接、分隔线、粗体/斜体/删除线/行内代码、换行。
 * 不引入任何第三方依赖，样式由 .prose 控制。
 */

type AnyNode = any

const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_STRIKE = 4
const FORMAT_UNDERLINE = 8
const FORMAT_CODE = 16

function renderText(node: AnyNode, key: React.Key): React.ReactNode {
  let el: React.ReactNode = node.text ?? ''
  const format = Number(node.format || 0)
  if (format & FORMAT_CODE) {
    el = <code>{el}</code>
  }
  if (format & FORMAT_BOLD) {
    el = <strong>{el}</strong>
  }
  if (format & FORMAT_ITALIC) {
    el = <em>{el}</em>
  }
  if (format & FORMAT_STRIKE) {
    el = <s>{el}</s>
  }
  if (format & FORMAT_UNDERLINE) {
    el = <u>{el}</u>
  }
  return <React.Fragment key={key}>{el}</React.Fragment>
}

function renderChildren(children: AnyNode[] | undefined, prefix: string): React.ReactNode {
  if (!Array.isArray(children)) return null
  return children.map((child, i) => renderNode(child, `${prefix}-${i}`))
}

function renderNode(node: AnyNode, key: React.Key): React.ReactNode {
  if (!node) return null

  switch (node.type) {
    case 'text':
      return renderText(node, key)

    case 'linebreak':
      return <br key={key} />

    case 'paragraph':
      return <p key={key}>{renderChildren(node.children, String(key))}</p>

    case 'heading': {
      const level = Number(String(node.tag || 'h2').replace('h', '')) || 2
      const Tag = (`h${Math.min(Math.max(level, 2), 4)}`) as keyof React.JSX.IntrinsicElements
      return React.createElement(Tag, { key }, renderChildren(node.children, String(key)))
    }

    case 'quote':
      return <blockquote key={key}>{renderChildren(node.children, String(key))}</blockquote>

    case 'list': {
      const ordered = node.listType === 'number'
      const Tag = ordered ? 'ol' : 'ul'
      return React.createElement(Tag, { key }, renderChildren(node.children, String(key)))
    }

    case 'listitem':
      return <li key={key}>{renderChildren(node.children, String(key))}</li>

    case 'link':
    case 'autolink': {
      const url = node.fields?.url || node.fields?.linkType === 'internal' ? node.fields?.doc?.value : node.fields?.url
      const href = url || '#'
      const external = /^https?:\/\//.test(String(href))
      return (
        <a key={key} href={String(href)} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
          {renderChildren(node.children, String(key))}
        </a>
      )
    }

    case 'horizontalrule':
      return <hr key={key} />

    case 'upload': {
      const media = node.value
      if (!media || typeof media !== 'object' || !media.url) return null
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={key} src={media.url} alt={media.alt || ''} loading="lazy" />
      )
    }

    default:
      return node.children ? (
        <React.Fragment key={key}>{renderChildren(node.children, String(key))}</React.Fragment>
      ) : null
  }
}

export default function LexicalContent({ content }: { content: any }) {
  const root = content?.root
  if (!root) return null
  return <div className="prose">{renderChildren(root.children, 'root')}</div>
}
