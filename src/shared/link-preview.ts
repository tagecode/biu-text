/**
 * 链接预览（Open Graph）解析。
 *
 * 放在 shared 里：主进程负责抓取 HTML，解析逻辑是纯函数，可以直接单测；
 * 渲染进程只拿到结构化结果，不接触原始 HTML。
 */

export interface LinkPreview {
  /** 最终用于展示的地址（可能带重定向后的地址） */
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  copy: '©',
  reg: '®'
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** 读取一个标签上的属性，支持双引号/单引号/无引号 */
function readAttribute(tag: string, name: string): string | null {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`,
    'i'
  )
  const match = pattern.exec(tag)
  if (!match) return null
  return decodeEntities(match[1] ?? match[2] ?? match[3] ?? '').trim() || null
}

function resolveHttpUrl(value: string | null, baseUrl: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value, baseUrl)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * 从 HTML 里提取 OG / Twitter / 常规 meta。
 *
 * 只做「够用」的字符串解析：Node 侧没有 DOMParser，引入解析器反而增加依赖与攻击面。
 */
export function parseLinkPreview(html: string, baseUrl: string): LinkPreview | null {
  const metas = new Map<string, string>()
  const metaPattern = /<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi
  for (const tag of html.match(metaPattern) ?? []) {
    const key = readAttribute(tag, 'property') ?? readAttribute(tag, 'name')
    const content = readAttribute(tag, 'content')
    if (!key || !content) continue
    const normalized = key.toLowerCase()
    if (!metas.has(normalized)) metas.set(normalized, content)
  }

  const documentTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  const title =
    metas.get('og:title') ??
    metas.get('twitter:title') ??
    (documentTitle ? decodeEntities(documentTitle).trim() : null)
  const description =
    metas.get('og:description') ?? metas.get('twitter:description') ?? metas.get('description') ?? null
  const image = resolveHttpUrl(
    metas.get('og:image:secure_url') ?? metas.get('og:image') ?? metas.get('twitter:image') ?? null,
    baseUrl
  )

  let hostname = ''
  try {
    hostname = new URL(baseUrl).hostname
  } catch {
    hostname = ''
  }
  const siteName = metas.get('og:site_name') ?? hostname ?? null

  if (!title && !description && !image) return null
  return {
    url: baseUrl,
    title: title || null,
    description: description || null,
    image,
    siteName: siteName || null
  }
}

/**
 * 只允许预览公网 http(s) 地址。
 *
 * 本机回环地址显式放行，方便联调与端到端测试；其它私有网段一律拒绝，
 * 避免文档里的链接被用来探测内网服务。
 */
export function isPreviewableUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') return true
  if (host.endsWith('.local')) return false

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 192 && b === 168) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
  }
  return true
}
