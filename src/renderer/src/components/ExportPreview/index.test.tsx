/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExportPreview } from './index'

afterEach(() => {
  cleanup()
})

const props = {
  open: true,
  intent: 'html' as const,
  content: '# Hello\n\n![a](assets/a.png)',
  documentPath: 'D:/docs/note.md',
  title: 'note.md',
  theme: 'light' as const,
  previewTheme: 'github' as const,
  previewFontFamily: 'sans' as const,
  fontSize: 16,
  onClose: vi.fn(),
  onExportHtml: vi.fn(async () => null as { path: string } | null),
  onExportPdf: vi.fn(async () => null as { path: string } | null)
}

describe('ExportPreview', () => {
  it('shows the export page and keeps the dialog open when saving is cancelled', async () => {
    const onClose = vi.fn()
    const onExportHtml = vi.fn(async () => null)
    render(<ExportPreview {...props} onClose={onClose} onExportHtml={onExportHtml} />)

    const frame = await screen.findByTitle('Export preview')
    await waitFor(() => {
      expect(frame.getAttribute('srcdoc')).toContain('Hello')
      expect(frame.getAttribute('srcdoc')).toContain('biu-image://local/')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Export HTML' }))
    await waitFor(() => expect(onExportHtml).toHaveBeenCalledOnce())
    expect(onExportHtml.mock.calls[0]?.[0]).toContain('Hello')
    expect(onExportHtml.mock.calls[0]?.[0]).toContain('assets/a.png')
    expect(onExportHtml.mock.calls[0]?.[0]).not.toContain('biu-image://')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('closes after a successful export', async () => {
    const onClose = vi.fn()
    const onExportPdf = vi.fn(async () => ({ path: 'D:/out/note.pdf' }))
    render(<ExportPreview {...props} intent="pdf" onClose={onClose} onExportPdf={onExportPdf} />)

    await screen.findByTitle('Export preview')
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
})
