/**
 * 关窗确认的握手状态。
 *
 * 主进程拦截 `close` 事件 → 通知渲染进程检查所有脏标签 → 渲染进程回
 * `APP_CLOSE_CONFIRMED` 或 `APP_CLOSE_CANCELLED`。只有确认之后才放行这一次 close。
 *
 * 这个「已放行」状态**不能跨窗口生命周期保留**：macOS 上关窗不会退出应用，
 * 点 dock 图标会重新走 `createWindow()`；如果状态还是 true，新窗口再关时就会
 * 直接放行，脏文档会被静默丢弃。因此 `createWindow()` 必须调用 `reset()`。
 */
export interface CloseGuard {
  isReady: () => boolean
  markReady: () => void
  reset: () => void
}

export function createCloseGuard(): CloseGuard {
  let ready = false
  return {
    isReady: () => ready,
    markReady: () => {
      ready = true
    },
    reset: () => {
      ready = false
    }
  }
}
