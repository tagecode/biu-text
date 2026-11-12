import { describe, expect, it, vi } from 'vitest'
import { WAIT_FOR_DOCUMENT_IMAGES, writePdfDocument, type PdfPage, type PdfPrinter } from './export-pdf'

function printer(page: PdfPage, failRemove = false): PdfPrinter & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async writeFile(path, data) {
      calls.push(`write:${path}:${typeof data === 'string' ? 'html' : 'pdf'}`)
    },
    async open(path) {
      calls.push(`open:${path}`)
      return page
    },
    async remove(path) {
      calls.push(`remove:${path}`)
      if (failRemove) throw new Error('busy')
    }
  }
}

describe('writePdfDocument', () => {
  it('writes a temp file, waits for images, then prints with background', async () => {
    const order: string[] = []
    const page: PdfPage = {
      executeJavaScript: vi.fn(async () => {
        order.push('wait')
      }),
      printToPDF: vi.fn(async () => {
        order.push('print')
        return new Uint8Array([1, 2, 3])
      }),
      destroy: vi.fn()
    }
    const io = printer(page)

    await writePdfDocument('<p>hi</p>', 'D:/out/a.pdf', 'D:/tmp/a.html', io)

    expect(io.calls).toEqual([
      'write:D:/tmp/a.html:html',
      'open:D:/tmp/a.html',
      'write:D:/out/a.pdf:pdf',
      'remove:D:/tmp/a.html'
    ])
    expect(order).toEqual(['wait', 'print'])
    expect(page.executeJavaScript).toHaveBeenCalledWith(WAIT_FOR_DOCUMENT_IMAGES)
    expect(page.printToPDF).toHaveBeenCalledWith({
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1
    })
    expect(page.destroy).toHaveBeenCalledOnce()
  })

  it('destroys the page and deletes the temp file when printing fails', async () => {
    const page: PdfPage = {
      executeJavaScript: vi.fn(async () => undefined),
      printToPDF: vi.fn(async () => {
        throw new Error('print failed')
      }),
      destroy: vi.fn()
    }
    const io = printer(page)

    await expect(writePdfDocument('<p>hi</p>', 'D:/out/a.pdf', 'D:/tmp/a.html', io)).rejects.toThrow(
      'print failed'
    )
    expect(page.destroy).toHaveBeenCalledOnce()
    expect(io.calls).toContain('remove:D:/tmp/a.html')
    expect(io.calls.some((call) => call.includes('a.pdf'))).toBe(false)
  })
})
