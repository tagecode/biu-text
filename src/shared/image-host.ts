/**
 * 图床配置：本地目录 / GitHub 仓库 / 自定义 HTTP 接口。
 * secret 只在主进程落盘时加密，渲染进程拿到的 token 一律是脱敏值。
 */
import type { ImageFileInput } from './image-input'

export const IMAGE_HOST_TYPES = ['local', 'github', 'custom'] as const
export type ImageHostType = (typeof IMAGE_HOST_TYPES)[number]

export interface GithubHostConfig {
  /** owner/repo */
  repo: string
  branch: string
  /** 仓库内目录，空串表示根目录 */
  dir: string
  token: string
}

export interface CustomHostConfig {
  url: string
  field: string
  headers: Record<string, string>
  /** 从响应 JSON 取 URL 的点路径，例如 data.url */
  responsePath: string
}

export interface ImageHostConfig {
  type: ImageHostType
  github: GithubHostConfig
  custom: CustomHostConfig
}

/** 落盘形态：secret 加密后的密文（或密钥环不可用时的明文） */
export interface StoredSecret {
  enc: boolean
  value: string
}

export interface StoredImageHostConfig {
  type: string
  github: { repo: string; branch: string; dir: string; token: StoredSecret }
  custom: { url: string; field: string; headers: Record<string, string>; responsePath: string }
}

export type SecretEncryptor = (plain: string) => StoredSecret
export type SecretDecryptor = (secret: unknown) => string

export function toStoredConfig(config: ImageHostConfig, encrypt: SecretEncryptor): StoredImageHostConfig {
  return {
    type: config.type,
    github: { ...config.github, token: encrypt(config.github.token) },
    custom: config.custom
  }
}

export function fromStoredConfig(raw: unknown, decrypt: SecretDecryptor): ImageHostConfig {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const github =
    typeof stored.github === 'object' && stored.github !== null
      ? (stored.github as Record<string, unknown>)
      : {}
  return normalizeImageHostConfig({
    type: stored.type,
    github: { ...github, token: decrypt(github.token) },
    custom: stored.custom
  })
}

export const DEFAULT_IMAGE_HOST_CONFIG: ImageHostConfig = {
  type: 'local',
  github: { repo: '', branch: 'main', dir: 'images', token: '' },
  custom: { url: '', field: 'file', headers: {}, responsePath: 'data.url' }
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizeHeaders(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {}
  const headers: Record<string, string> = {}
  for (const [name, header] of Object.entries(value as Record<string, unknown>)) {
    const key = name.trim()
    if (key && typeof header === 'string') headers[key] = header
  }
  return headers
}

export function normalizeImageHostType(value: unknown): ImageHostType {
  return IMAGE_HOST_TYPES.includes(value as ImageHostType) ? (value as ImageHostType) : 'local'
}

/** 归一化磁盘 / 渲染进程传来的任意结构，避免下游到处做类型收窄 */
export function normalizeImageHostConfig(input: unknown): ImageHostConfig {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const github = typeof raw.github === 'object' && raw.github !== null ? (raw.github as Record<string, unknown>) : {}
  const custom = typeof raw.custom === 'object' && raw.custom !== null ? (raw.custom as Record<string, unknown>) : {}

  return {
    type: normalizeImageHostType(raw.type),
    github: {
      repo: text(github.repo).trim(),
      branch: text(github.branch, DEFAULT_IMAGE_HOST_CONFIG.github.branch).trim() || 'main',
      dir: text(github.dir, DEFAULT_IMAGE_HOST_CONFIG.github.dir)
        .trim()
        .replace(/^\/+|\/+$/g, ''),
      token: text(github.token).trim()
    },
    custom: {
      url: text(custom.url).trim(),
      field: text(custom.field, DEFAULT_IMAGE_HOST_CONFIG.custom.field).trim() || 'file',
      headers: normalizeHeaders(custom.headers),
      responsePath:
        text(custom.responsePath, DEFAULT_IMAGE_HOST_CONFIG.custom.responsePath).trim() || 'data.url'
    }
  }
}

/** 脱敏占位符，真令牌不会包含这个字符 */
const MASK_CHAR = '•'

/** 只露末四位，供设置面板回显；空值原样返回 */
export function maskSecret(secret: string): string {
  const trimmed = secret.trim()
  if (!trimmed) return ''
  return trimmed.length <= 4 ? MASK_CHAR.repeat(4) : `${MASK_CHAR.repeat(4)}${trimmed.slice(-4)}`
}

/** 每行 `Name: value`，空行与 # 注释忽略 */
export function parseHeaderLines(text: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf(':')
    if (index <= 0) continue
    const name = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    if (name && value) headers[name] = value
  }
  return headers
}

export function formatHeaderLines(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n')
}

/** 按点路径取响应里的 URL；取不到或不是字符串时返回 null */
export function pickJsonPath(value: unknown, path: string): string | null {
  let current: unknown = value
  for (const part of path.split('.')) {
    if (typeof current !== 'object' || current === null) return null
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' && current.trim() !== '' ? current.trim() : null
}

/**
 * 上传端点只允许 HTTPS；开发联调时放行回环地址的 HTTP。
 */
export function isSecureEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') return true
    if (parsed.protocol !== 'http:') return false
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]'
  } catch {
    return false
  }
}

export interface ImageHostConfigView {
  type: ImageHostType
  github: { repo: string; branch: string; dir: string; tokenMasked: string; tokenSaved: boolean }
  custom: { url: string; field: string; headers: Record<string, string>; responsePath: string }
}

export interface ImageUploadRequest extends ImageFileInput {
  uploadId: string
}

export interface ImageUploadProgress {
  uploadId: string
  loaded: number
  total: number
}

export type ImageUploadResult = { ok: true; url: string } | { ok: false; error: string }
export type ImageHostTestResult = { ok: true; url: string } | { ok: false; error: string }

/** 主进程 → 渲染进程：把 token 换成脱敏值 */
export function toImageView(config: ImageHostConfig): ImageHostConfigView {
  const token = config.github.token
  return {
    type: config.type,
    github: {
      repo: config.github.repo,
      branch: config.github.branch,
      dir: config.github.dir,
      tokenMasked: maskSecret(token),
      tokenSaved: token !== ''
    },
    custom: config.custom
  }
}

/** 表单提交：token 为空或仍是脱敏值时表示「不修改」，沿用旧密钥 */
export function mergeImageView(view: ImageHostConfigView | null, previous: ImageHostConfig): ImageHostConfig {
  if (!view) return previous
  const incoming = view.github.tokenMasked.trim()
  // 带圆点的只可能是回显的脱敏值（哪怕被顺手改过），当成真令牌存下去会让上传一直 401
  const unchanged = incoming === '' || incoming.includes(MASK_CHAR)
  return normalizeImageHostConfig({
    type: view.type,
    github: {
      repo: view.github.repo,
      branch: view.github.branch,
      dir: view.github.dir,
      token: unchanged ? previous.github.token : incoming
    },
    custom: view.custom
  })
}
