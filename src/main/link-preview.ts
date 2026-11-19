import { net } from 'electron'
import {
  isPreviewableUrl,
  parseLinkPreview,
  type LinkPreview
} from '../shared/link-preview'

/** 只读页面头部，避免为了一个预览卡片把整篇大页面拉下来 */
const MAX_HTML_BYTES = 512 * 1024
const REQUEST_TIMEOUT_MS = 6000
const SUCCESS_TTL_MS = 10 * 60 * 1000
const FAILURE_TTL_MS = 2 * 60 * 1000
const CACHE_LIMIT = 100

interface CacheEntry {
  value: LinkPreview | null
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

function readCache(url: string): CacheEntry | undefined {
  const entry = cache.get(url)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    cache.delete(url)
    return undefined
  }
  // Map 插入顺序即 LRU 顺序：命中后挪到末尾
  cache.delete(url)
  cache.set(url, entry)
  return entry
}

function writeCache(url: string, value: LinkPreview | null): void {
  cache.set(url, {
    value,
    expiresAt: Date.now() + (value ? SUCCESS_TTL_MS : FAILURE_TTL_MS)
  })
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      if (received + value.byteLength > MAX_HTML_BYTES) {
        chunks.push(value.slice(0, MAX_HTML_BYTES - received))
        received = MAX_HTML_BYTES
        await reader.cancel()
        break
      }
      chunks.push(value)
      received += value.byteLength
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
}

/**
 * 抓取并解析链接的 Open Graph 信息。
 *
 * 失败（超时、非 HTML、私有地址）一律返回 null，由渲染层决定不显示卡片。
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  if (!isPreviewableUrl(rawUrl)) return null
  const cached = readCache(rawUrl)
  if (cached) return cached.value

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await net.fetch(rawUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'user-agent': 'BiuText/1.1 (+https://github.com/tagecode/biu-text)'
      }
    })
    if (!response.ok) {
      writeCache(rawUrl, null)
      return null
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType && !contentType.includes('html')) {
      writeCache(rawUrl, null)
      return null
    }
    // 跟随重定向后可能落到私有地址，最终地址再校验一次
    const finalUrl = response.url && isPreviewableUrl(response.url) ? response.url : rawUrl
    const html = await readLimitedText(response)
    const preview = parseLinkPreview(html, finalUrl)
    writeCache(rawUrl, preview)
    return preview
  } catch {
    writeCache(rawUrl, null)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 测试用：清空内存缓存 */
export function resetLinkPreviewCache(): void {
  cache.clear()
}
