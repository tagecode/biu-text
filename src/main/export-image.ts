import { readFile } from 'node:fs/promises'
import { imageContentType, resolveImageRequest } from './image-path'

const IMG_SOURCE = /<img\b[^>]*?\bsrc="([^"]*)"/gi

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>'
}

export function decodeHtmlAttribute(value: string): string {
  return value.replace(/&(?:amp|quot|#39|lt|gt);/g, (entity) => ENTITIES[entity] ?? entity)
}

/** 只有相对路径需要内联；带协议（含 data:）、协议相对地址与纯锚点一律跳过 */
export function isLocalImageRef(src: string): boolean {
  if (!src) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return false
  if (src.startsWith('//') || src.startsWith('#')) return false
  return true
}

/**
 * 把文档目录内的相对图片换成 data URI。
 * 打印窗口加载的是 data:text/html，相对路径在那里没有基准目录，不内联就是空白。
 */
export async function inlineLocalImages(
  html: string,
  baseDir: string | null,
  readAsset: (absolutePath: string) => Promise<Buffer> = readFile
): Promise<string> {
  if (!baseDir) return html

  const inlined = new Map<string, string>()
  for (const match of html.matchAll(IMG_SOURCE)) {
    const src = match[1]
    if (inlined.has(src) || !isLocalImageRef(src)) continue
    const target = resolveImageRequest(baseDir, decodeHtmlAttribute(src))
    if (!target) continue
    const contentType = imageContentType(target)
    if (!contentType) continue
    try {
      const data = await readAsset(target)
      inlined.set(src, `data:${contentType};base64,${data.toString('base64')}`)
    } catch {
      // 图片缺失时保留原始引用，导出不至于整份失败
    }
  }

  if (inlined.size === 0) return html
  return html.replace(IMG_SOURCE, (match, src: string) => {
    const replacement = inlined.get(src)
    if (!replacement) return match
    return `${match.slice(0, match.length - src.length - 1)}${replacement}"`
  })
}
