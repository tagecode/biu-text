/** 预览区读取本地图片的自定义协议，由主进程按当前文档目录解析 */
export const IMAGE_SCHEME = 'biu-image'

const IMAGE_HOST = 'local'

const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * 把 Markdown 里的图片地址转换成预览可用的地址。
 * 只重写相对路径（交给主进程按文档目录解析）；远程地址、data:/file: 等显式协议、
 * 协议相对地址和绝对路径一律原样返回，是否放行由 CSP 与主进程决定。
 * docKey 让不同文档的同名相对路径命中不同的 URL，避免切换文档时读到缓存里的旧图。
 */
export function toPreviewImageSrc(raw: string, docKey?: string | null): string {
  const src = raw.trim()
  if (!src) return raw
  if (EXPLICIT_SCHEME.test(src)) return raw
  if (src.startsWith('//')) return raw
  if (src.startsWith('/') || src.startsWith('\\')) return raw
  const scope = docKey ? `&d=${encodeURIComponent(docKey)}` : ''
  return `${IMAGE_SCHEME}://${IMAGE_HOST}/?path=${encodeURIComponent(src)}${scope}`
}

/**
 * DOMPurify 默认 ALLOWED_URI_REGEXP 的副本，额外放行自定义图片协议。
 * 不覆盖的话 DOMPurify 会把 biu-image: 当成未知协议直接剥掉。
 * data: 图片不受此表达式影响，DOMPurify 用独立分支放行 img 上的 data URI。
 */
export const PREVIEW_ALLOWED_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|biu-image):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i
