import { describe, expect, it } from 'vitest'
import {
  cloudImageName,
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

describe('cloudImageName', () => {
  const at = new Date(2026, 10, 6, 9, 5, 3)

  it('prefixes the sanitized name with a timestamp', () => {
    expect(cloudImageName('my shot.png', 'image/png', at)).toBe('20261106090503-my-shot.png')
  })

  it('rejects non-images so the caller skips the upload', () => {
    expect(cloudImageName('notes.md', 'text/markdown', at)).toBeNull()
  })

  it('separates same-named images uploaded in the same second', () => {
    expect(cloudImageName('image.png', 'image/png', at)).toBe('20261106090503-image.png')
    expect(cloudImageName('image.png', 'image/png', at)).toBe('20261106090503-image-2.png')
  })
})
