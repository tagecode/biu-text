/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import '@/i18n'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExcalidrawSceneSnapshot } from './Canvas'
import { ExcalidrawEditor } from './index'

// 真实的 Excalidraw 有 1.7MB，组件测试里换成一个能主动触发 onChange 的假画布
const handlers: { onChange?: (snapshot: ExcalidrawSceneSnapshot) => void } = {}

vi.mock('./Canvas', () => ({
  default: ({ onChange }: { onChange: (snapshot: ExcalidrawSceneSnapshot) => void }) => {
    handlers.onChange = onChange
    return (
      <>
        <button
          type="button"
          data-testid="draw"
          onClick={() =>
            handlers.onChange?.({
              elements: [{ id: 'a', type: 'rectangle', isDeleted: false }],
              appState: { viewBackgroundColor: '#ffffff', scrollX: 99 },
              files: null
            })
          }
        >
          draw
        </button>
        <button
          type="button"
          data-testid="draw-deleted-only"
          onClick={() =>
            handlers.onChange?.({
              elements: [{ id: 'b', type: 'rectangle', isDeleted: true }],
              appState: {},
              files: null
            })
          }
        >
          clear
        </button>
      </>
    )
  }
}))

afterEach(() => {
  cleanup()
  delete handlers.onChange
})

function setup(overrides: Partial<React.ComponentProps<typeof ExcalidrawEditor>> = {}) {
  const props: React.ComponentProps<typeof ExcalidrawEditor> = {
    open: true,
    theme: 'light',
    onClose: vi.fn(),
    onInsert: vi.fn(),
    ...overrides
  }
  render(<ExcalidrawEditor {...props} />)
  return props
}

describe('ExcalidrawEditor', () => {
  it('未打开时不渲染对话框', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('打开后显示标题与空画布提示，插入按钮不可用', async () => {
    setup()
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Insert drawing')).toBeTruthy()
    expect(screen.getByText('Canvas is still empty')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Insert' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('画布有内容后可以插入，写入的是 excalidraw 代码块', async () => {
    const props = setup()
    await screen.findByTestId('draw')
    fireEvent.click(screen.getByTestId('draw'))

    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Insert' }) as HTMLButtonElement).disabled).toBe(
        false
      )
    )

    fireEvent.click(screen.getByRole('button', { name: 'Insert' }))

    expect(props.onInsert).toHaveBeenCalledTimes(1)
    const block = (props.onInsert as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]
    expect(block.startsWith('```excalidraw\n')).toBe(true)
    expect(block.endsWith('\n```')).toBe(true)

    // 写进去的是紧凑场景：只带渲染需要的 appState 字段
    const scene = JSON.parse(block.split('\n')[1])
    expect(scene.elements).toHaveLength(1)
    expect(scene.appState).toEqual({ viewBackgroundColor: '#ffffff' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('全是已删除元素时仍算空画布', async () => {
    setup()
    await screen.findByTestId('draw')
    fireEvent.click(screen.getByTestId('draw-deleted-only'))
    expect((screen.getByRole('button', { name: 'Insert' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('取消会关闭对话框', async () => {
    const props = setup()
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onClose).toHaveBeenCalled()
    expect(props.onInsert).not.toHaveBeenCalled()
  })
})
