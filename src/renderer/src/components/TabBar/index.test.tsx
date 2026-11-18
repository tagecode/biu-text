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

afterEach(cleanup)

describe('TabBar', () => {
  const documents = [doc('a', '/notes/a.md'), doc('b'), doc('c', '/notes/c.md')]

  it('每个文档渲染一个标签，并标出活动标签', () => {
    render(
      <TabBar documents={documents} activeId="b" onActivate={() => {}} onClose={() => {}} onNew={() => {}} />
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
  })

  it('有路径显示文件名，没有路径显示未命名', () => {
    render(
      <TabBar documents={documents} activeId="a" onActivate={() => {}} onClose={() => {}} onNew={() => {}} />
    )
    expect(screen.getByRole('tab', { name: /a\.md/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Untitled/ })).toBeTruthy()
  })

  it('脏文档带未保存标记，干净的没有', () => {
    const dirty = { ...doc('d', '/notes/d.md'), content: '改了' }
    render(
      <TabBar documents={[dirty, documents[0]]} activeId="d" onActivate={() => {}} onClose={() => {}} onNew={() => {}} />
    )
    expect(screen.getAllByTestId('tab-dirty')).toHaveLength(1)
  })

  it('点击标签与关闭按钮各自回调对应 id', () => {
    const onActivate = vi.fn()
    const onClose = vi.fn()
    render(
      <TabBar documents={documents} activeId="a" onActivate={onActivate} onClose={onClose} onNew={() => {}} />
    )
    fireEvent.click(screen.getByRole('tab', { name: /a\.md/ }))
    expect(onActivate).toHaveBeenCalledWith('a')

    fireEvent.click(screen.getByRole('button', { name: 'Close tab c.md' }))
    expect(onClose).toHaveBeenCalledWith('c')
  })

  it('加号按钮用于新建标签', () => {
    const onNew = vi.fn()
    render(
      <TabBar documents={documents} activeId="a" onActivate={() => {}} onClose={() => {}} onNew={onNew} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    expect(onNew).toHaveBeenCalledTimes(1)
  })
})
