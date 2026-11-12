/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { buildExportHtmlDocument } from './export-document'

const dot = ['```dot', 'digraph { A -> B }', '```', ''].join('\n')

describe('buildExportHtmlDocument', () => {
  it('inlines a graphviz svg and keeps print colors', async () => {
    const html = await buildExportHtmlDocument({
      title: 'Note',
      content: dot,
      theme: 'dark',
      previewTheme: 'notion',
      previewFontFamily: 'serif',
      fontSize: 18
    })

    expect(html).toContain('<svg')
    expect(html).toContain('print-color-adjust: exact')
    expect(html).toContain('font-size: 18px')
    expect(html).toContain('max-width: 860px')
    expect(html).not.toContain('data-diagram-state="pending"')
  })

  it('aborts instead of returning a half-rendered document', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      buildExportHtmlDocument({
        title: 'Note',
        content: dot,
        theme: 'light',
        previewTheme: 'github',
        previewFontFamily: 'sans',
        fontSize: 14,
        signal: controller.signal
      })
    ).rejects.toThrow(/aborted/i)
  })
})
