import { describe, expect, it } from 'vitest'
import { PREVIEW_ALLOWED_URI_REGEXP, toPreviewImageSrc } from './image-url'

describe('toPreviewImageSrc', () => {
  it('rewrites relative paths onto the custom protocol', () => {
    expect(toPreviewImageSrc('assets/a.png')).toBe('biu-image://local/?path=assets%2Fa.png')
    expect(toPreviewImageSrc('./a.png')).toBe('biu-image://local/?path=.%2Fa.png')
    expect(toPreviewImageSrc('../pic/a b.png')).toBe('biu-image://local/?path=..%2Fpic%2Fa%20b.png')
  })

  it('scopes the url to the document so cached images cannot leak across documents', () => {
    expect(toPreviewImageSrc('assets/a.png', '/docs/a.md')).toBe(
      'biu-image://local/?path=assets%2Fa.png&d=%2Fdocs%2Fa.md'
    )
    expect(toPreviewImageSrc('assets/a.png', '/docs/b.md')).not.toBe(
      toPreviewImageSrc('assets/a.png', '/docs/a.md')
    )
    expect(toPreviewImageSrc('assets/a.png', null)).toBe('biu-image://local/?path=assets%2Fa.png')
  })

  it('leaves remote, data, file and absolute paths untouched', () => {
    expect(toPreviewImageSrc('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(toPreviewImageSrc('http://example.com/a.png')).toBe('http://example.com/a.png')
    expect(toPreviewImageSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    expect(toPreviewImageSrc('file:///etc/passwd')).toBe('file:///etc/passwd')
    expect(toPreviewImageSrc('//cdn.example.com/a.png')).toBe('//cdn.example.com/a.png')
    expect(toPreviewImageSrc('/abs/a.png')).toBe('/abs/a.png')
    expect(toPreviewImageSrc('C:\\img\\a.png')).toBe('C:\\img\\a.png')
  })

  it('handles empty input', () => {
    expect(toPreviewImageSrc('')).toBe('')
    expect(toPreviewImageSrc('   ')).toBe('   ')
  })
})

describe('PREVIEW_ALLOWED_URI_REGEXP', () => {
  it('keeps the custom protocol and the schemes DOMPurify allows by default', () => {
    expect(PREVIEW_ALLOWED_URI_REGEXP.test('biu-image://local/?path=a.png')).toBe(true)
    expect(PREVIEW_ALLOWED_URI_REGEXP.test('https://example.com/a.png')).toBe(true)
    expect(PREVIEW_ALLOWED_URI_REGEXP.test('mailto:a@example.com')).toBe(true)
  })

  it('still rejects file and script schemes', () => {
    expect(PREVIEW_ALLOWED_URI_REGEXP.test('file:///etc/passwd')).toBe(false)
    expect(PREVIEW_ALLOWED_URI_REGEXP.test('javascript:alert(1)')).toBe(false)
    expect(PREVIEW_ALLOWED_URI_REGEXP.test('vbscript:msgbox(1)')).toBe(false)
  })
})
