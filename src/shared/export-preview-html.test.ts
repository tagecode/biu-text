import { describe, expect, it } from 'vitest'
import { withPreviewImages } from './export-preview-html'

describe('withPreviewImages', () => {
  it('rewrites relative images for the in-app preview and leaves remote images alone', () => {
    const html = '<p><img src="assets/a.png" alt="a"><img src="https://example.com/b.png"></p>'
    const result = withPreviewImages(html, 'D:/docs/note.md')

    expect(result).toContain('src="biu-image://local/?path=assets%2Fa.png&amp;d=D%3A%2Fdocs%2Fnote.md"')
    expect(result).toContain('src="https://example.com/b.png"')
  })
})
