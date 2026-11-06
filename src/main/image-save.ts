import { extname } from 'node:path'
import { imageContentType } from './image-path'

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/svg+xml': '.svg'
}

/** 只认显式的图片 MIME，避免把任意字节流当成图片落盘 */
export function imageExtensionForMime(mime: string): string | null {
  return MIME_EXTENSIONS[mime.toLowerCase()] ?? null
}

/** 只保留最后一段文件名，并去掉分隔符与控制字符，保证落盘位置只能是 assets/ 这一层 */
export function sanitizeImageName(originalName: string): string {
  const basename = originalName.replaceAll('\\', '/').split('/').pop() ?? ''
  const withoutExtension = basename.replace(/\.[^.]*$/, '')
  const cleaned = withoutExtension
    .replace(/[:*?"<>|]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 60)
  return cleaned || 'image'
}

export function uniqueImageName(used: Set<string>, base: string, ext: string): string {
  let candidate = `${base}${ext}`
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}-${index}${ext}`
    index += 1
  }
  return candidate
}

/**
 * 决定落盘文件名：MIME 优先，其次看原扩展名。
 * 两者都不在图片白名单内时返回 null，调用方直接跳过。
 */
export function imageFileName(originalName: string, mime: string, used: Set<string>): string | null {
  const fromMime = imageExtensionForMime(mime)
  const fromName = extname(originalName).toLowerCase()
  const ext = fromMime ?? (imageContentType(`x${fromName}`) ? fromName : null)
  if (!ext) return null
  return uniqueImageName(used, sanitizeImageName(originalName), ext)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * 同一次运行内已用过的云端文件名。
 * 剪贴板图片的文件名都是 image.png，一次粘贴多张会落在同一秒，不加后缀会互相覆盖。
 */
const usedCloudNames = new Set<string>()

/** 云端文件名带时间戳前缀，避免同一仓库/图床里同名覆盖 */
export function cloudImageName(originalName: string, mime: string, at: Date = new Date()): string | null {
  const name = imageFileName(originalName, mime, new Set())
  if (!name) return null
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
  const ext = extname(name)
  const candidate = uniqueImageName(usedCloudNames, `${stamp}-${name.slice(0, name.length - ext.length)}`, ext)
  usedCloudNames.add(candidate)
  return candidate
}
