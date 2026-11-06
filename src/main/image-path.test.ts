import { describe, expect, it } from 'vitest'
import { join, sep } from 'node:path'
import { imageContentType, isInsideDirectory, resolveImageRequest } from './image-path'

const DOC_DIR = join(sep, 'docs')

describe('resolveImageRequest', () => {
  it('resolves relative paths inside the document directory', () => {
    expect(resolveImageRequest(DOC_DIR, 'assets/a.png')).toBe(join(DOC_DIR, 'assets', 'a.png'))
    expect(resolveImageRequest(DOC_DIR, './assets/a.png')).toBe(join(DOC_DIR, 'assets', 'a.png'))
  })

  it('rejects paths that escape the document directory', () => {
    expect(resolveImageRequest(DOC_DIR, '../secret.png')).toBeNull()
    expect(resolveImageRequest(DOC_DIR, 'assets/../../secret.png')).toBeNull()
  })

  it('rejects absolute paths and the directory itself', () => {
    expect(resolveImageRequest(DOC_DIR, join(sep, 'etc', 'passwd'))).toBeNull()
    expect(resolveImageRequest(DOC_DIR, '.')).toBeNull()
    expect(resolveImageRequest(DOC_DIR, '')).toBeNull()
  })

  it('rejects everything when the document has no directory', () => {
    expect(resolveImageRequest(null, 'assets/a.png')).toBeNull()
  })
})

describe('isInsideDirectory', () => {
  it('distinguishes sibling directories that share a prefix', () => {
    expect(isInsideDirectory(DOC_DIR, join(DOC_DIR, 'assets', 'a.png'))).toBe(true)
    expect(isInsideDirectory(DOC_DIR, `${DOC_DIR}2${sep}a.png`)).toBe(false)
    expect(isInsideDirectory(DOC_DIR, DOC_DIR)).toBe(false)
  })
})

describe('imageContentType', () => {
  it('maps known image extensions', () => {
    expect(imageContentType('a.PNG')).toBe('image/png')
    expect(imageContentType('a.jpeg')).toBe('image/jpeg')
    expect(imageContentType('a.svg')).toBe('image/svg+xml')
  })

  it('refuses non-image files', () => {
    expect(imageContentType('notes.md')).toBeNull()
    expect(imageContentType('archive.zip')).toBeNull()
    expect(imageContentType('noext')).toBeNull()
  })
})
