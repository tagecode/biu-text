/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import '@/i18n'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageHistoryEntry } from '@shared/image-history'
import { ImageHistoryDialog } from './index'

const entries: ImageHistoryEntry[] = [
  {
    id: 'a',
    url: 'https://img.example.com/a.png',
    fileName: 'a.png',
    uploadedAt: Date.UTC(2026, 10, 19, 10, 30),
    provider: 'github'
  },
  {
    id: 'b',
    url: 'https://img.example.com/b.png',
    fileName: 'b.png',
    uploadedAt: Date.UTC(2026, 10, 18, 9, 0),
    provider: 'custom'
  }
]

const getHistory = vi.fn(async () => entries)
const removeHistory = vi.fn(async (id: string) => entries.filter((entry) => entry.id !== id))
const showHistoryMenu = vi.fn(async (): Promise<'url' | 'markdown' | 'delete' | null> => null)
const writeClipboard = vi.fn()

beforeEach(() => {
  getHistory.mockClear()
  removeHistory.mockClear()
  showHistoryMenu.mockClear()
  writeClipboard.mockClear()
  window.imageAPI = { getHistory, removeHistory, showHistoryMenu } as unknown as Window['imageAPI']
  window.windowAPI = { writeClipboard } as unknown as Window['windowAPI']
})

afterEach(cleanup)

describe('ImageHistoryDialog', () => {
  it('lists thumbnails, file names, URLs and upload times', async () => {
    render(<ImageHistoryDialog open onClose={() => undefined} />)

    expect(await screen.findByText('a.png')).toBeTruthy()
    expect(screen.getByText('https://img.example.com/a.png')).toBeTruthy()
    expect(screen.getByText('b.png')).toBeTruthy()
    expect(getHistory).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll('img')).toHaveLength(2)
  })

  it('shows the empty state when nothing has been uploaded', async () => {
    getHistory.mockResolvedValueOnce([])
    render(<ImageHistoryDialog open onClose={() => undefined} />)

    expect(await screen.findByText('No uploads yet')).toBeTruthy()
  })

  it('copies the URL from the row context menu', async () => {
    showHistoryMenu.mockResolvedValueOnce('url')
    render(<ImageHistoryDialog open onClose={() => undefined} />)
    await screen.findByText('a.png')

    fireEvent.contextMenu(screen.getByTestId('image-history-a'))

    await waitFor(() => expect(writeClipboard).toHaveBeenCalledWith('https://img.example.com/a.png'))
  })

  it('copies Markdown with the file name as alt text', async () => {
    showHistoryMenu.mockResolvedValueOnce('markdown')
    render(<ImageHistoryDialog open onClose={() => undefined} />)
    await screen.findByText('a.png')

    fireEvent.contextMenu(screen.getByTestId('image-history-a'))

    await waitFor(() =>
      expect(writeClipboard).toHaveBeenCalledWith('![a.png](https://img.example.com/a.png)')
    )
  })

  it('deletes a record and hides it from the list', async () => {
    showHistoryMenu.mockResolvedValueOnce('delete')
    render(<ImageHistoryDialog open onClose={() => undefined} />)
    await screen.findByText('a.png')

    fireEvent.contextMenu(screen.getByTestId('image-history-a'))

    await waitFor(() => expect(screen.queryByText('a.png')).toBeNull())
    expect(removeHistory).toHaveBeenCalledWith('a')
    expect(screen.getByText('b.png')).toBeTruthy()
  })

  it('does nothing when the menu is dismissed', async () => {
    render(<ImageHistoryDialog open onClose={() => undefined} />)
    await screen.findByText('a.png')

    fireEvent.contextMenu(screen.getByTestId('image-history-a'))

    await waitFor(() => expect(showHistoryMenu).toHaveBeenCalledTimes(1))
    expect(writeClipboard).not.toHaveBeenCalled()
    expect(removeHistory).not.toHaveBeenCalled()
  })
})
