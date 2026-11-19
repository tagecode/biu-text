/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import '@/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTabDocument, type TabDocument } from '@shared/documents'
import { TabBar } from './index'

function doc(id: string, filePath: string | null = null, content = ''): TabDocument {
  return createTabDocument({ id, content, filePath })
}

function dragEvent(type: string, init: { clientX?: number; dataTransfer?: Record<string, unknown> }): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, init)
  return event
}

afterEach(cleanup)

describe('TabBar', () => {
  const documents = [doc('a', '/notes/a.md'), doc('b'), doc('c', '/notes/c.md')]
  const noop = (): void => {}

  it('每个文档渲染一个标签，并标出活动标签', () => {
    render(
      <TabBar documents={documents} activeId="b" onActivate={noop} onClose={noop} onNew={noop} onMove={noop} />
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
  })

  it('有路径显示文件名，没有路径显示未命名', () => {
    render(
      <TabBar documents={documents} activeId="a" onActivate={noop} onClose={noop} onNew={noop} onMove={noop} />
    )
    expect(screen.getByRole('tab', { name: /a\.md/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Untitled/ })).toBeTruthy()
  })

  it('脏文档带未保存标记，干净的没有', () => {
    const dirty = { ...doc('d', '/notes/d.md'), content: '改了' }
    render(
      <TabBar
        documents={[dirty, documents[0]]}
        activeId="d"
        onActivate={noop}
        onClose={noop}
        onNew={noop}
        onMove={noop}
      />
    )
    expect(screen.getAllByTestId('tab-dirty')).toHaveLength(1)
  })

  it('点击标签与关闭按钮各自回调对应 id', () => {
    const onActivate = vi.fn()
    const onClose = vi.fn()
    render(
      <TabBar
        documents={documents}
        activeId="a"
        onActivate={onActivate}
        onClose={onClose}
        onNew={noop}
        onMove={noop}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /a\.md/ }))
    expect(onActivate).toHaveBeenCalledWith('a')

    fireEvent.click(screen.getByRole('button', { name: 'Close tab c.md' }))
    expect(onClose).toHaveBeenCalledWith('c')
  })

  it('加号按钮用于新建标签', () => {
    const onNew = vi.fn()
    render(
      <TabBar
        documents={documents}
        activeId="a"
        onActivate={noop}
        onClose={noop}
        onNew={onNew}
        onMove={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('拖到标签左半边时插到该标签之前', () => {
    const onMove = vi.fn()
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() }
    render(
      <TabBar
        documents={documents}
        activeId="a"
        onActivate={noop}
        onClose={noop}
        onNew={noop}
        onMove={onMove}
      />
    )

    const source = screen.getByTestId('tab-c')
    const target = screen.getByTestId('tab-a')
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 100,
      bottom: 36,
      width: 100,
      height: 36,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    fireEvent(source, dragEvent('dragstart', { dataTransfer }))
    fireEvent(target, dragEvent('dragover', { clientX: 10, dataTransfer }))
    expect(screen.getAllByTestId('tab-drop-indicator')).toHaveLength(1)

    fireEvent(target, dragEvent('drop', { dataTransfer }))
    expect(onMove).toHaveBeenCalledWith('c', 0)
    expect(screen.queryAllByTestId('tab-drop-indicator')).toHaveLength(0)
  })

  it('拖到标签右半边时插到该标签之后', () => {
    const onMove = vi.fn()
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() }
    render(
      <TabBar
        documents={documents}
        activeId="a"
        onActivate={noop}
        onClose={noop}
        onNew={noop}
        onMove={onMove}
      />
    )

    const source = screen.getByTestId('tab-a')
    const target = screen.getByTestId('tab-b')
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 100,
      bottom: 36,
      width: 100,
      height: 36,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    fireEvent(source, dragEvent('dragstart', { dataTransfer }))
    fireEvent(target, dragEvent('dragover', { clientX: 80, dataTransfer }))
    fireEvent(target, dragEvent('drop', { dataTransfer }))
    expect(onMove).toHaveBeenCalledWith('a', 2)
  })
})
