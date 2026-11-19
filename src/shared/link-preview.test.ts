import { describe, expect, it } from 'vitest'
import { isPreviewableUrl, parseLinkPreview } from './link-preview'

describe('parseLinkPreview', () => {
  it('reads Open Graph metadata', () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="BiuText &amp; friends" />
      <meta property="og:description" content="A tiny markdown editor" />
      <meta property="og:site_name" content="BiuText" />
      <meta property="og:image" content="/cover.png" />
    </head></html>`

    expect(parseLinkPreview(html, 'https://example.com/post')).toEqual({
      url: 'https://example.com/post',
      title: 'BiuText & friends',
      description: 'A tiny markdown editor',
      image: 'https://example.com/cover.png',
      siteName: 'BiuText'
    })
  })

  it('falls back to title, description and twitter cards', () => {
    const html = `<title>Fallback &mdash; page</title>
      <meta name="description" content="Plain description">
      <meta name="twitter:image" content="https://cdn.example.com/a.jpg">`

    const preview = parseLinkPreview(html, 'https://example.com/')
    expect(preview?.title).toBe('Fallback — page')
    expect(preview?.description).toBe('Plain description')
    expect(preview?.image).toBe('https://cdn.example.com/a.jpg')
    expect(preview?.siteName).toBe('example.com')
  })

  it('handles unquoted attributes and attribute order', () => {
    const html = `<meta content=Hello property=og:title>
      <meta property='og:description' content='World'>`
    const preview = parseLinkPreview(html, 'https://example.com/')
    expect(preview?.title).toBe('Hello')
    expect(preview?.description).toBe('World')
  })

  it('returns null when there is nothing to show', () => {
    expect(parseLinkPreview('<html><body>hi</body></html>', 'https://example.com/')).toBeNull()
    expect(parseLinkPreview('', 'https://example.com/')).toBeNull()
  })

  it('drops non-http image urls', () => {
    const html = `<meta property="og:title" content="T">
      <meta property="og:image" content="javascript:alert(1)">`
    expect(parseLinkPreview(html, 'https://example.com/')?.image).toBeNull()
  })
})

describe('isPreviewableUrl', () => {
  it('accepts public http(s) urls and loopback for local testing', () => {
    expect(isPreviewableUrl('https://example.com/a')).toBe(true)
    expect(isPreviewableUrl('http://127.0.0.1:3000/a')).toBe(true)
    expect(isPreviewableUrl('http://localhost:3000/a')).toBe(true)
  })

  it('rejects private networks and non-http protocols', () => {
    expect(isPreviewableUrl('http://192.168.1.10/')).toBe(false)
    expect(isPreviewableUrl('http://10.0.0.2/')).toBe(false)
    expect(isPreviewableUrl('http://172.20.0.1/')).toBe(false)
    expect(isPreviewableUrl('http://169.254.1.1/')).toBe(false)
    expect(isPreviewableUrl('file:///etc/passwd')).toBe(false)
    expect(isPreviewableUrl('javascript:alert(1)')).toBe(false)
    expect(isPreviewableUrl('not a url')).toBe(false)
  })
})
