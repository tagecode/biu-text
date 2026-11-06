import { isSecureEndpoint, pickJsonPath, type ImageHostConfig } from '../shared/image-host'
import { cloudImageName } from './image-save'
import { sendBuffer } from './http-upload'

export interface UploadInput {
  name: string
  mime: string
  bytes: Uint8Array
}

export interface UploadResult {
  url: string
  fileName: string
}

export type ProgressReporter = (loaded: number, total: number) => void

/** multipart 请求体，字段名与文件名来自配置 */
export function buildMultipartBody(
  boundary: string,
  field: string,
  fileName: string,
  mime: string,
  bytes: Uint8Array
): Buffer {
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${field}"; filename="${fileName}"\r\n` +
      `Content-Type: ${mime || 'application/octet-stream'}\r\n\r\n`,
    'utf-8'
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
  return Buffer.concat([head, Buffer.from(bytes), tail])
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export function githubContentsUrl(repo: string, dir: string, fileName: string): string {
  const prefix = encodePath(dir)
  return `https://api.github.com/repos/${repo}/contents/${prefix ? `${prefix}/` : ''}${encodeURIComponent(fileName)}`
}

export function githubRawUrl(repo: string, branch: string, dir: string, fileName: string): string {
  const prefix = encodePath(dir)
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${prefix ? `${prefix}/` : ''}${encodeURIComponent(fileName)}`
}

/** GitHub / 常见图床都把原因放在 JSON 的 message 字段 */
export function extractApiMessage(text: string): string {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim()
  } catch {
    // 不是 JSON，退回原始文本
  }
  return text.trim().slice(0, 300)
}

function statusError(prefix: string, status: number, text: string): Error {
  const message = extractApiMessage(text)
  return new Error(message ? `${prefix} ${status}: ${message}` : `${prefix} ${status}`)
}

async function uploadToGithub(
  config: ImageHostConfig,
  input: UploadInput,
  onProgress: ProgressReporter
): Promise<UploadResult> {
  const fileName = cloudImageName(input.name, input.mime)
  if (!fileName) throw new Error('unsupported image type')
  // 配置没填全时直接报清楚，别让 /repos//contents 换回一个莫名其妙的 404
  if (!config.github.repo.includes('/') || !config.github.token) {
    throw new Error('repo and token required')
  }

  const body = Buffer.from(
    JSON.stringify({
      message: `Add ${fileName}`,
      content: Buffer.from(input.bytes).toString('base64'),
      branch: config.github.branch
    }),
    'utf-8'
  )

  const res = await sendBuffer(
    githubContentsUrl(config.github.repo, config.github.dir, fileName),
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${config.github.token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'BiuText'
      },
      body
    },
    onProgress
  )

  if (res.status < 200 || res.status >= 300) throw statusError('GitHub', res.status, res.text)

  const downloadUrl = pickJsonPath(JSON.parse(res.text), 'content.download_url')
  return {
    url: downloadUrl ?? githubRawUrl(config.github.repo, config.github.branch, config.github.dir, fileName),
    fileName
  }
}

async function uploadToCustom(
  config: ImageHostConfig,
  input: UploadInput,
  onProgress: ProgressReporter
): Promise<UploadResult> {
  if (!isSecureEndpoint(config.custom.url)) throw new Error('endpoint must use https')
  const fileName = cloudImageName(input.name, input.mime)
  if (!fileName) throw new Error('unsupported image type')

  const boundary = `----BiuText${Date.now().toString(16)}`
  const body = buildMultipartBody(boundary, config.custom.field, fileName, input.mime, input.bytes)

  const res = await sendBuffer(
    config.custom.url,
    {
      method: 'POST',
      headers: {
        ...config.custom.headers,
        // 用户自定义的 Content-Type 一律覆盖，否则 multipart 边界对不上
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      body
    },
    onProgress
  )

  if (res.status < 200 || res.status >= 300) throw statusError('Upload', res.status, res.text)

  let payload: unknown
  try {
    payload = JSON.parse(res.text)
  } catch {
    throw new Error('response is not JSON')
  }

  const url = pickJsonPath(payload, config.custom.responsePath)
  if (!url) throw new Error(`response has no "${config.custom.responsePath}"`)
  return { url, fileName }
}

export async function uploadImage(
  config: ImageHostConfig,
  input: UploadInput,
  onProgress: ProgressReporter
): Promise<UploadResult> {
  if (config.type === 'github') return uploadToGithub(config, input, onProgress)
  if (config.type === 'custom') return uploadToCustom(config, input, onProgress)
  throw new Error('cloud image host is not configured')
}

/** 测试连接：GitHub 查仓库可访问，自定义图床直接传一张 1×1 透明 PNG */
export async function testImageHost(config: ImageHostConfig): Promise<UploadResult> {
  const noop: ProgressReporter = () => {}

  if (config.type === 'github') {
    if (!config.github.repo.includes('/') || !config.github.token) throw new Error('repo and token required')
    const res = await sendBuffer(`https://api.github.com/repos/${config.github.repo}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${config.github.token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'BiuText'
      },
      body: Buffer.alloc(0)
    })
    if (res.status < 200 || res.status >= 300) throw statusError('GitHub', res.status, res.text)
    return { url: config.github.repo, fileName: '' }
  }

  if (config.type === 'custom') {
    return uploadToCustom(
      config,
      {
        name: 'biu-text-connection-test.png',
        mime: 'image/png',
        bytes: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64'
        )
      },
      noop
    )
  }

  throw new Error('no cloud host configured')
}
