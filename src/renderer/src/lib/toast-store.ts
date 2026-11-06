import type { NotificationLevel } from '@shared/notification'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastInput {
  title: string
  description?: string
  level?: NotificationLevel
  duration?: number
  action?: ToastAction
}

export interface ToastItem extends ToastInput {
  id: string
}

/** PRD 5.1：Toast 自动消失 3 秒 */
export const TOAST_DURATION = 3000

/** 同屏最多堆三张，超出的从最旧的开始丢 */
const TOAST_LIMIT = 3

let toasts: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()

function publish(next: ToastItem[]): void {
  toasts = next
  for (const listener of listeners) listener()
}

/** 订阅变更，返回退订函数；配合 useSyncExternalStore 使用 */
export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 快照必须保持引用稳定，否则 useSyncExternalStore 会无限重渲染 */
export function getToasts(): ToastItem[] {
  return toasts
}

export function toast(input: ToastInput): string {
  const id = `t${++seq}`
  const item: ToastItem = { level: 'info', duration: TOAST_DURATION, ...input, id }
  publish([...toasts, item].slice(-TOAST_LIMIT))
  return id
}

export function dismissToast(id: string): void {
  if (!toasts.some((item) => item.id === id)) return
  publish(toasts.filter((item) => item.id !== id))
}

/** 仅测试用：清空队列、计数与订阅 */
export function resetToasts(): void {
  toasts = []
  seq = 0
  listeners.clear()
}
