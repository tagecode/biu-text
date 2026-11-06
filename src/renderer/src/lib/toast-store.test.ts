import { describe, it, expect, beforeEach } from 'vitest'
import { dismissToast, getToasts, resetToasts, subscribeToasts, toast, TOAST_DURATION } from './toast-store'

describe('toast store', () => {
  beforeEach(() => {
    resetToasts()
  })

  it('默认使用 info 级别与 3 秒时长', () => {
    toast({ title: '已导出 a.html' })
    const [item] = getToasts()
    expect(item.level).toBe('info')
    expect(item.duration).toBe(TOAST_DURATION)
    expect(TOAST_DURATION).toBe(3000)
  })

  it('保留传入的级别与描述', () => {
    toast({ title: '导出失败', description: 'EACCES', level: 'error' })
    const [item] = getToasts()
    expect(item.level).toBe('error')
    expect(item.description).toBe('EACCES')
  })

  it('同屏最多三张，超出时丢掉最旧的', () => {
    toast({ title: '1' })
    toast({ title: '2' })
    toast({ title: '3' })
    toast({ title: '4' })
    expect(getToasts().map((item) => item.title)).toEqual(['2', '3', '4'])
  })

  it('关闭指定 Toast，未知 id 不触发通知', () => {
    let calls = 0
    const unsubscribe = subscribeToasts(() => {
      calls += 1
    })
    const id = toast({ title: '1' })
    toast({ title: '2' })
    dismissToast('missing')
    expect(calls).toBe(2)
    dismissToast(id)
    expect(calls).toBe(3)
    expect(getToasts().map((item) => item.title)).toEqual(['2'])
    unsubscribe()
  })

  it('退订后不再收到通知', () => {
    let calls = 0
    const unsubscribe = subscribeToasts(() => {
      calls += 1
    })
    toast({ title: '1' })
    unsubscribe()
    toast({ title: '2' })
    expect(calls).toBe(1)
  })

  it('快照只在内容变化时换引用', () => {
    const before = getToasts()
    expect(getToasts()).toBe(before)
    toast({ title: '1' })
    expect(getToasts()).not.toBe(before)
  })
})
