import { describe, expect, it } from 'vitest'
import { decodeHtmlAttribute, inlineLocalImages, isLocalImageRef } from './export-image'

const BASE = '/docs/notes'
const PNG = Buffer.from('png-bytes')

const readAsset = async (absolutePath: string): Promise<Buffer> => {
  if (absolutePath.endsWith('missing.png')) throw new Error('ENOENT')
  return PNG
}

describe('isLocalImageRef', () => {
  it('accepts relative references only', () => {
    expect(isLocalImageRef('assets/a.png')).toBe(true)
    expect(isLocalImageRef('./a.png')).toBe(true)
    expect(isLocalImageRef('../pic/a.png')).toBe(true)
  })

  it('rejects anything with a scheme, protocol-relative or fragment', () => {
    expect(isLocalImageRef('https://x/a.png')).toBe(false)
    expect(isLocalImageRef('data:image/png;base64,AAA')).toBe(false)
    expect(isLocalImageRef('file:///etc/passwd')).toBe(false)
    expect(isLocalImageRef('//cdn/a.png')).toBe(false)
    expect(isLocalImageRef('#anchor')).toBe(false)
  })
})

describe('decodeHtmlAttribute', () => {
  it('decodes the entities markdown-it emits in attributes', () => {
    expect(decodeHtmlAttribute('a&amp;b.png')).toBe('a&b.png')
    expect(decodeHtmlAttribute('&quot;x&quot;.png')).toBe('"x".png')
  })
})

describe('inlineLocalImages', () => {
  const html = '<p><img src="assets/a.png" alt="a"></p>'

  it('inlines relative images inside the document directory', async () => {
    const result = await inlineLocalImages(html, BASE, readAsset)
    expect(result).toContain('src="data:image/png;base64,cG5nLWJ5dGVz"')
    expect(result).toContain('alt="a"')
  })

  it('leaves remote, absolute and unknown-extension images alone', async () => {
    const input =
      '<img src="https://x/a.png"><img src="/abs/a.png"><img src="notes.txt"><img src="data:image/png;base64,AA">'
    expect(await inlineLocalImages(input, BASE, readAsset)).toBe(input)
  })

  it('keeps the original reference when the file is missing or escapes the directory', async () => {
    const input = '<img src="missing.png"><img src="../../secret.png">'
    expect(await inlineLocalImages(input, BASE, readAsset)).toBe(input)
  })

  it('does nothing without a document directory', async () => {
    expect(await inlineLocalImages(html, null, readAsset)).toBe(html)
  })

  it('inlines each distinct source once', async () => {
    let reads = 0
    const counting = async (absolutePath: string): Promise<Buffer> => {
      reads += 1
      return readAsset(absolutePath)
    }
    const input = '<img src="assets/a.png"><img src="assets/a.png">'
    const result = await inlineLocalImages(input, BASE, counting)
    expect(reads).toBe(1)
    expect(result.match(/data:image\/png/g)).toHaveLength(2)
  })

  it('decodes HTML entities before resolving the path', async () => {
    const result = await inlineLocalImages('<img src="assets/a&amp;b.png">', BASE, readAsset)
    expect(result).toContain('data:image/png')
  })
})
