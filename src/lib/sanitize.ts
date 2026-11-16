/** Whitelist sanitizer for the small amount of inline HTML the editor stores. */

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'CODE', 'BR', 'A'])
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE'])

function clean(node: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove()
      continue
    }
    const el = child as Element
    const tag = el.tagName.toUpperCase()
    if (DROP.has(tag)) {
      el.remove()
      continue
    }
    clean(el)
    if (!ALLOWED.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes))
      continue
    }
    const href = tag === 'A' ? el.getAttribute('href') : null
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name)
    if (href && /^(https?:|mailto:)/i.test(href.trim())) {
      el.setAttribute('href', href.trim())
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
    }
  }
}

export function sanitize(html: string): string {
  if (!html) return ''
  if (!/[<&]/.test(html)) return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  clean(doc.body)
  return doc.body.innerHTML
}

export function htmlToText(html: string): string {
  if (!html) return ''
  if (!/[<&]/.test(html)) return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  return doc.body.textContent ?? ''
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
