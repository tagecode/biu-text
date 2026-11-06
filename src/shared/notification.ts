/** 主进程 → 渲染进程的轻量通知，渲染进程用右上角 Toast 呈现 */
export type NotificationLevel = 'info' | 'success' | 'error'

export interface NotificationPayload {
  level: NotificationLevel
  title: string
  description?: string
}
