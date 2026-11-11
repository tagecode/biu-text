import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { listInlineImages } from './inline-image'

function stateWithCursor(doc: string, cursor: number): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage })]
  })
}

describe('listInlineImages', () => {
  it('replaces an image on another line with a preview url', () => {
    const doc = 'hello\n![cat](assets/cat.png)\n'
    const images = listInlineImages(stateWithCursor(doc, 0), '/docs/note.md')

    expect(images).toEqual([
      {
        from: doc.indexOf('!['),
        to: doc.indexOf('![' ) + '![cat](assets/cat.png)'.length,
        alt: 'cat',
        src: 'biu-image://local/?path=assets%2Fcat.png&d=%2Fdocs%2Fnote.md',
        failed: false
      }
    ])
  })

  it('keeps the source when the cursor is on the image line', () => {
    const doc = '![cat](assets/cat.png)\nnext'
    const images = listInlineImages(stateWithCursor(doc, 2), '/docs/note.md')
    expect(images).toEqual([])
  })

  it('hides only the image on the cursor line', () => {
    const doc = '![a](a.png)\n![b](https://example.com/b.png)'
    const images = listInlineImages(stateWithCursor(doc, 0), null)
    expect(images.map((image) => image.alt)).toEqual(['b'])
    expect(images[0]?.src).toBe('https://example.com/b.png')
  })

  it('ignores code, reference images, and in-progress uploads', () => {
    const doc = ['```', '![no](x.png)', '```', '![ref][id]', '![up](uploading:abc)', '`![c](c.png)`'].join('\n')
    expect(listInlineImages(stateWithCursor(doc, 0), null)).toEqual([])
  })

  it('marks empty, file, and script urls as failed without a loadable src', () => {
    const doc = '![]()\n![x](file:///tmp/a.png)\n![y](javascript:alert(1))\n'
    const images = listInlineImages(stateWithCursor(doc, doc.length), null)
    expect(images.map((image) => ({ alt: image.alt, src: image.src, failed: image.failed }))).toEqual([
      { alt: '', src: '', failed: true },
      { alt: 'x', src: '', failed: true },
      { alt: 'y', src: '', failed: true }
    ])
  })

  it('uses the url and drops the title', () => {
    const doc = '![a](b.png "title")\n'
    const images = listInlineImages(stateWithCursor(doc, doc.length), null)
    expect(images[0]?.alt).toBe('a')
    expect(images[0]?.src).toBe('biu-image://local/?path=b.png')
  })
})
