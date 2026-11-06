import { describe, expect, it } from 'vitest'
import {
  imageExtensionForMime,
  imageFileName,
  sanitizeImageName,
  uniqueImageName
} from './image-save'

describe('imageExtensionForMime', () => {
  it('maps known image mime types to extensions', () => {
    expect(imageExtensionForMime('image/png')).toBe('.png')
    expect(imageExtensionForMime('image/jpeg')).toBe('.jpg')
    expect(imageExtensionForMime('IMAGE/WEBP')).toBe('.webp')
    expect(imageExtensionForMime('image/svg+xml')).toBe('.svg')
  })

  it('rejects non-image mime types', () => {
    expect(imageExtensionForMime('text/plain')).toBeNull()
    expect(imageExtensionForMime('application/pdf')).toBeNull()
    expect(imageExtensionForMime('')).toBeNull()
  })
})

describe('sanitizeImageName', () => {
  it('drops directories and unsafe characters', () => {
    expect(sanitizeImageName('../../etc/passwd.png')).toBe('passwd')
    expect(sanitizeImageName('a/b\\c.png')).toBe('c')
    expect(sanitizeImageName('my screenshot.PNG')).toBe('my-screenshot')
  })

  it('falls back to image when nothing usable is left', () => {
    expect(sanitizeImageName('')).toBe('image')
    expect(sanitizeImageName('.png')).toBe('image')
    expect(sanitizeImageName('...')).toBe('image')
  })
})

describe('uniqueImageName', () => {
  it('appends a counter when the name is taken', () => {
    const used = new Set(['a.png', 'a-2.png'])
    expect(uniqueImageName(used, 'a', '.png')).toBe('a-3.png')
    expect(uniqueImageName(new Set(), 'a', '.png')).toBe('a.png')
  })
})

describe('imageFileName', () => {
  it('prefers the mime type over the original extension', () => {
    expect(imageFileName('clip.png', 'image/jpeg', new Set())).toBe('clip.jpg')
  })

  it('falls back to the original extension when the mime type is missing', () => {
    expect(imageFileName('shot.webp', '', new Set())).toBe('shot.webp')
  })

  it('rejects files that are not images', () => {
    expect(imageFileName('notes.md', 'text/markdown', new Set())).toBeNull()
    expect(imageFileName('no-extension', '', new Set())).toBeNull()
  })
})
