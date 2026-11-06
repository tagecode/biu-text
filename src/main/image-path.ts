import { extname, isAbsolute, relative, resolve } from 'node:path'

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
}

/** 只按扩展名放行图片，避免自定义协议变成任意文件读取入口 */
export function imageContentType(filePath: string): string | null {
  return IMAGE_CONTENT_TYPES[extname(filePath).toLowerCase()] ?? null
}

/** target 必须严格位于 baseDir 之内（不能是目录本身，也不能借前缀逃逸） */
export function isInsideDirectory(baseDir: string, targetPath: string): boolean {
  const rel = relative(baseDir, targetPath)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** 把预览请求的相对路径解析为 baseDir 下的绝对路径，越界或绝对路径一律拒绝 */
export function resolveImageRequest(baseDir: string | null, requested: string): string | null {
  if (!baseDir || !requested) return null
  if (isAbsolute(requested)) return null
  const target = resolve(baseDir, requested)
  return isInsideDirectory(baseDir, target) ? target : null
}
