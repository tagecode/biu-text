/** 云图床上传历史：主进程落盘、渲染进程只读展示。 */
import type { ImageHostType } from './image-host'

/** PRD：只保留最近 50 张 */
export const IMAGE_HISTORY_LIMIT = 50

export interface ImageHistoryEntry {
  id: string
  url: string
  fileName: string
  uploadedAt: number
  provider: ImageHostType
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 只接受 http(s) URL，避免把 file:// 或 javascript: 写进历史再渲染成图片 */
function isRemoteUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function normalizeEntry(raw: unknown): ImageHistoryEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const url = text(record.url)
  const fileName = text(record.fileName)
  const id = text(record.id)
  const uploadedAt = typeof record.uploadedAt === 'number' ? record.uploadedAt : NaN
  if (!id || !fileName || !isRemoteUrl(url) || !Number.isFinite(uploadedAt)) return null

  const provider = record.provider
  return {
    id,
    url,
    fileName,
    uploadedAt,
    provider:
      provider === 'github' || provider === 'custom' || provider === 'local' ? provider : 'custom'
  }
}

/**
 * 读取磁盘上的历史并做清洗：坏记录直接丢，按时间倒序，最多 50 条。
 * 文件结构兼容裸数组与 `{ entries: [...] }` 两种形态。
 */
export function normalizeImageHistory(raw: unknown, limit = IMAGE_HISTORY_LIMIT): ImageHistoryEntry[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as { entries?: unknown }).entries)
      ? (raw as { entries: unknown[] }).entries
      : []

  const entries: ImageHistoryEntry[] = []
  for (const item of list) {
    const entry = normalizeEntry(item)
    if (entry) entries.push(entry)
  }
  return entries.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, limit)
}

/** 新记录置顶；同一 URL 只保留最新一条，避免重复上传挤掉别的历史 */
export function addImageHistoryEntry(
  entries: readonly ImageHistoryEntry[],
  entry: ImageHistoryEntry,
  limit = IMAGE_HISTORY_LIMIT
): ImageHistoryEntry[] {
  return [entry, ...entries.filter((item) => item.url !== entry.url)].slice(0, limit)
}

export function removeImageHistoryEntry(
  entries: readonly ImageHistoryEntry[],
  id: string
): ImageHistoryEntry[] {
  return entries.filter((entry) => entry.id !== id)
}
