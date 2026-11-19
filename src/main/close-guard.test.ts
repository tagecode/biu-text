import { describe, expect, it } from 'vitest'
import { createCloseGuard } from './close-guard'

describe('createCloseGuard', () => {
  it('初始不放行，确认后放行，取消后复位', () => {
    const guard = createCloseGuard()
    expect(guard.isReady()).toBe(false)

    guard.markReady()
    expect(guard.isReady()).toBe(true)

    guard.reset()
    expect(guard.isReady()).toBe(false)
  })

  it('重开窗口必须重新走确认流程（macOS 关窗不退出应用）', () => {
    const guard = createCloseGuard()
    // 第一个窗口：确认后放行并关闭
    guard.markReady()
    expect(guard.isReady()).toBe(true)

    // createWindow() 重建窗口
    guard.reset()
    // 新窗口的关窗必须再次拦截并确认，不能沿用上一次的放行状态
    expect(guard.isReady()).toBe(false)
  })
})
