import { useEffect } from 'react'
import { toast } from '@/lib/toast-store'

/** 主进程推来的轻量通知，统一渲染成右上角 Toast */
export function useNotifications(): void {
  useEffect(() => window.windowAPI.onNotify((payload) => toast(payload)), [])
}
