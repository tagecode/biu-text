import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { app } from 'electron'
import {
  addImageHistoryEntry,
  normalizeImageHistory,
  removeImageHistoryEntry,
  type ImageHistoryEntry
} from '../shared/image-history'
import type { ImageHostType } from '../shared/image-host'

export interface ImageUploadHistoryInput {
  url: string
  fileName: string
  provider: ImageHostType
}

function storePath(): string {
  return join(app.getPath('userData'), 'image-history.json')
}

let cache: ImageHistoryEntry[] | null = null
// 同一时刻可能有多张图上传完成；串行化读改写，避免后写的覆盖先写的
let queue: Promise<unknown> = Promise.resolve()

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function readHistory(): Promise<ImageHistoryEntry[]> {
  try {
    const parsed = JSON.parse(await readFile(storePath(), 'utf-8'))
    return normalizeImageHistory(parsed)
  } catch {
    return []
  }
}

async function writeHistory(entries: ImageHistoryEntry[]): Promise<void> {
  await writeFile(storePath(), JSON.stringify({ version: 1, entries }, null, 2), 'utf-8')
}

async function ensureCache(): Promise<ImageHistoryEntry[]> {
  if (!cache) cache = await readHistory()
  return cache
}

export function loadImageHistory(): Promise<ImageHistoryEntry[]> {
  return serialize(ensureCache)
}

/** 上传成功后追加一条记录；写盘失败不应影响上传结果，调用方自行忽略异常 */
export function recordImageUpload(input: ImageUploadHistoryInput): Promise<ImageHistoryEntry[]> {
  return serialize(async () => {
    const entries = await ensureCache()
    const entry: ImageHistoryEntry = {
      id: randomUUID(),
      url: input.url,
      fileName: input.fileName,
      uploadedAt: Date.now(),
      provider: input.provider
    }
    cache = addImageHistoryEntry(entries, entry)
    await writeHistory(cache)
    return cache
  })
}

export function removeImageHistoryEntryById(id: string): Promise<ImageHistoryEntry[]> {
  return serialize(async () => {
    const entries = await ensureCache()
    cache = removeImageHistoryEntry(entries, id)
    await writeHistory(cache)
    return cache
  })
}

/** 仅测试用：清掉进程内缓存，模拟重启后重新读盘 */
export function resetImageHistoryCache(): void {
  cache = null
}
