import { describe, expect, it } from 'vitest'
import { DEFAULT_IMAGE_HOST_CONFIG } from '../shared/image-host'
import {
  buildMultipartBody,
  extractApiMessage,
  getImageHostProvider,
  githubContentsUrl,
  githubRawUrl,
  registerImageHostProvider,
  uploadImage
} from './image-host-providers'

describe('githubContentsUrl', () => {
  it('builds the contents endpoint and skips the directory when empty', () => {
    expect(githubContentsUrl('me/pics', 'shots', 'a b.png')).toBe(
      'https://api.github.com/repos/me/pics/contents/shots/a%20b.png'
    )
    expect(githubContentsUrl('me/pics', '', 'a.png')).toBe(
      'https://api.github.com/repos/me/pics/contents/a.png'
    )
  })

  it('encodes every path segment but keeps the slashes', () => {
    expect(githubContentsUrl('me/pics', 'a b/c', 'x.png')).toBe(
      'https://api.github.com/repos/me/pics/contents/a%20b/c/x.png'
    )
  })
})

describe('githubRawUrl', () => {
  it('falls back to raw.githubusercontent.com', () => {
    expect(githubRawUrl('me/pics', 'main', 'shots', 'x.png')).toBe(
      'https://raw.githubusercontent.com/me/pics/main/shots/x.png'
    )
  })
})

describe('extractApiMessage', () => {
  it('prefers the json message field', () => {
    expect(extractApiMessage('{"message":"Bad credentials"}')).toBe('Bad credentials')
  })

  it('falls back to trimmed text', () => {
    expect(extractApiMessage('  <html>oops</html>  ')).toBe('<html>oops</html>')
    expect(extractApiMessage('')).toBe('')
  })
})

describe('buildMultipartBody', () => {
  it('wraps the bytes with a form-data envelope', () => {
    const body = buildMultipartBody('BOUND', 'file', 'a.png', 'image/png', Uint8Array.from([1, 2, 3])).toString(
      'latin1'
    )
    expect(body).toContain('--BOUND\r\n')
    expect(body).toContain('Content-Disposition: form-data; name="file"; filename="a.png"')
    expect(body).toContain('Content-Type: image/png')
    expect(body.endsWith('\r\n--BOUND--\r\n')).toBe(true)
  })

  it('falls back to octet-stream when the mime is empty', () => {
    const body = buildMultipartBody('B', 'f', 'a.bin', '', Uint8Array.from([0])).toString('latin1')
    expect(body).toContain('Content-Type: application/octet-stream')
  })
})

describe('image host provider registry', () => {
  it('dispatches uploads to a registered plugin provider', async () => {
    const original = getImageHostProvider('custom')
    const calls: string[] = []
    registerImageHostProvider('custom', {
      upload: async (_config, input) => {
        calls.push(input.name)
        return { url: 'https://cdn.example.com/plugin.png', fileName: 'plugin.png' }
      }
    })

    try {
      const result = await uploadImage(
        { ...DEFAULT_IMAGE_HOST_CONFIG, type: 'custom' },
        { name: 'shot.png', mime: 'image/png', bytes: Uint8Array.from([1]) },
        () => undefined
      )
      expect(result).toEqual({ url: 'https://cdn.example.com/plugin.png', fileName: 'plugin.png' })
      expect(calls).toEqual(['shot.png'])
    } finally {
      if (original) registerImageHostProvider('custom', original)
    }
  })

  it('keeps the local type unregistered', async () => {
    await expect(
      uploadImage(
        { ...DEFAULT_IMAGE_HOST_CONFIG, type: 'local' },
        { name: 'a.png', mime: 'image/png', bytes: Uint8Array.from([1]) },
        () => undefined
      )
    ).rejects.toThrow('cloud image host is not configured')
  })
})
