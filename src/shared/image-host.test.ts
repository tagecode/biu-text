import { describe, expect, it } from 'vitest'
import {
  formatHeaderLines,
  fromStoredConfig,
  isSecureEndpoint,
  maskSecret,
  mergeImageView,
  normalizeImageHostConfig,
  parseHeaderLines,
  pickJsonPath,
  toImageView,
  toStoredConfig
} from './image-host'

describe('normalizeImageHostConfig', () => {
  it('falls back to local defaults for junk input', () => {
    expect(normalizeImageHostConfig(null)).toEqual({
      type: 'local',
      github: { repo: '', branch: 'main', dir: 'images', token: '' },
      custom: { url: '', field: 'file', headers: {}, responsePath: 'data.url' }
    })
    expect(normalizeImageHostConfig('nope').type).toBe('local')
    expect(normalizeImageHostConfig({ type: 'ftp' }).type).toBe('local')
  })

  it('trims fields and strips slashes around the github directory', () => {
    const config = normalizeImageHostConfig({
      type: 'github',
      github: { repo: '  me/pics  ', branch: '  ', dir: '/shots/', token: ' t0ken ' },
      custom: { url: ' https://example.com/up ', field: '', responsePath: '' }
    })
    expect(config.type).toBe('github')
    expect(config.github).toEqual({ repo: 'me/pics', branch: 'main', dir: 'shots', token: 't0ken' })
    expect(config.custom.field).toBe('file')
    expect(config.custom.responsePath).toBe('data.url')
    expect(config.custom.url).toBe('https://example.com/up')
  })

  it('drops non-string headers', () => {
    const config = normalizeImageHostConfig({ custom: { headers: { A: '1', B: 2, ' ': 'x' } } })
    expect(config.custom.headers).toEqual({ A: '1' })
  })
})

describe('maskSecret', () => {
  it('keeps only the last four characters', () => {
    expect(maskSecret('ghp_abcdef1234')).toBe('••••1234')
    expect(maskSecret('abc')).toBe('••••')
    expect(maskSecret('   ')).toBe('')
  })
})

describe('header lines', () => {
  it('parses name/value pairs and ignores blanks, comments and malformed lines', () => {
    const text = ['Authorization: Bearer x', '', '# comment', 'no-colon', 'X-Key: a:b'].join('\n')
    expect(parseHeaderLines(text)).toEqual({ Authorization: 'Bearer x', 'X-Key': 'a:b' })
  })

  it('round-trips through formatHeaderLines', () => {
    const headers = { Authorization: 'Bearer x', Accept: 'application/json' }
    expect(parseHeaderLines(formatHeaderLines(headers))).toEqual(headers)
  })
})

describe('pickJsonPath', () => {
  const payload = { data: { url: ' https://cdn/x.png ' }, result: { urls: ['a'] } }

  it('resolves dotted paths to a trimmed string', () => {
    expect(pickJsonPath(payload, 'data.url')).toBe('https://cdn/x.png')
  })

  it('returns null for missing or non-string values', () => {
    expect(pickJsonPath(payload, 'data.missing')).toBeNull()
    expect(pickJsonPath(payload, 'result.urls')).toBeNull()
    expect(pickJsonPath(null, 'data.url')).toBeNull()
  })
})

describe('isSecureEndpoint', () => {
  it('accepts https everywhere and http only on loopback', () => {
    expect(isSecureEndpoint('https://api.github.com/x')).toBe(true)
    expect(isSecureEndpoint('http://127.0.0.1:8080/up')).toBe(true)
    expect(isSecureEndpoint('http://localhost/up')).toBe(true)
    expect(isSecureEndpoint('http://example.com/up')).toBe(false)
    expect(isSecureEndpoint('ftp://example.com')).toBe(false)
    expect(isSecureEndpoint('not a url')).toBe(false)
  })
})

describe('toImageView / mergeImageView', () => {
  const config = normalizeImageHostConfig({
    type: 'github',
    github: { repo: 'me/pics', token: 'ghp_abcdef1234' }
  })

  it('masks the token on the way to the renderer', () => {
    const view = toImageView(config)
    expect(view.github.tokenMasked).toBe('••••1234')
    expect(view.github.tokenSaved).toBe(true)
    expect(JSON.stringify(view)).not.toContain('ghp_abcdef1234')
  })

  it('keeps the stored token when the form echoes the masked value back', () => {
    const merged = mergeImageView(toImageView(config), config)
    expect(merged.github.token).toBe('ghp_abcdef1234')
  })

  it('replaces the token when a new plain value is submitted', () => {
    const view = toImageView(config)
    view.github.tokenMasked = 'ghp_new9999'
    expect(mergeImageView(view, config).github.token).toBe('ghp_new9999')
  })

  it('does not wipe the token when the field is left empty', () => {
    const view = toImageView(config)
    view.github.tokenMasked = ''
    expect(mergeImageView(view, config).github.token).toBe('ghp_abcdef1234')
  })

  it('never stores a masked value that the user edited in place', () => {
    const view = toImageView(config)
    view.github.tokenMasked = '••••1234abc'
    expect(mergeImageView(view, config).github.token).toBe('ghp_abcdef1234')
  })
})

describe('toStoredConfig / fromStoredConfig', () => {
  const config = normalizeImageHostConfig({
    type: 'github',
    github: { repo: 'me/pics', dir: 'shots', token: 'ghp_abcdef1234' },
    custom: { url: 'https://example.com/up', headers: { 'X-Key': 'v' } }
  })
  const encrypt = (plain: string) => ({ enc: true, value: Buffer.from(`enc:${plain}`).toString('base64') })
  const decrypt = (secret: unknown) => {
    const value = (secret as { value?: string } | null)?.value ?? ''
    return value ? Buffer.from(value, 'base64').toString('utf-8').replace(/^enc:/, '') : ''
  }

  it('keeps the plaintext token out of the stored object', () => {
    const stored = toStoredConfig(config, encrypt)
    expect(stored.github.token.enc).toBe(true)
    expect(JSON.stringify(stored)).not.toContain('ghp_abcdef1234')
  })

  it('round-trips through the store', () => {
    expect(fromStoredConfig(toStoredConfig(config, encrypt), decrypt)).toEqual(config)
  })

  it('degrades to an unconfigured host when the secret cannot be decrypted', () => {
    const stored = toStoredConfig(config, encrypt)
    expect(fromStoredConfig(stored, () => '').github.token).toBe('')
  })

  it('survives junk on disk', () => {
    expect(fromStoredConfig(null, decrypt).type).toBe('local')
  })
})
