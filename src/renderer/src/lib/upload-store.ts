export interface UploadState {
  id: string
  name: string
  loaded: number
  total: number
}

let uploads: UploadState[] = []
const listeners = new Set<() => void>()

function publish(next: UploadState[]): void {
  uploads = next
  for (const listener of listeners) listener()
}

export function subscribeUploads(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 快照引用要保持稳定，useSyncExternalStore 靠它判断是否重渲染 */
export function getUploads(): UploadState[] {
  return uploads
}

export function uploadStarted(id: string, name: string, total: number): void {
  publish([...uploads, { id, name, loaded: 0, total }])
}

export function uploadProgressed(id: string, loaded: number, total: number): void {
  if (!uploads.some((item) => item.id === id)) return
  publish(uploads.map((item) => (item.id === id ? { ...item, loaded, total } : item)))
}

export function uploadSettled(id: string): void {
  if (!uploads.some((item) => item.id === id)) return
  publish(uploads.filter((item) => item.id !== id))
}

/** 仅测试用 */
export function resetUploads(): void {
  uploads = []
  listeners.clear()
}
