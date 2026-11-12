import { toPreviewImageSrc } from './image-url'

const IMG_SOURCE = /<img\b[^>]*?\bsrc="([^"]*)"/gi

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>'
}

function decodeHtmlAttribute(value: string): string {
  return value.replace(/&(?:amp|quot|#39|lt|gt);/g, (entity) => ENTITIES[entity] ?? entity)
}

function encodeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
}

/** 预览窗里把相对图片换成应用内地址。导出用的 HTML 仍保留相对路径，由主进程再内联。 */
export function withPreviewImages(html: string, documentPath: string | null): string {
  return html.replace(IMG_SOURCE, (match, src: string) => {
    const next = toPreviewImageSrc(decodeHtmlAttribute(src), documentPath)
    if (next === decodeHtmlAttribute(src)) return match
    return `${match.slice(0, match.length - src.length - 1)}${encodeHtmlAttribute(next)}"`
  })
}
