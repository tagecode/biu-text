import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

export interface UploadRequest {
  method: string
  headers: Record<string, string>
  body: Buffer
  timeoutMs?: number
}

export interface UploadResponse {
  status: number
  text: string
}

/** 分块写入，让主进程能在慢速上传时回报进度 */
const CHUNK_SIZE = 64 * 1024

export function sendBuffer(
  url: string,
  request: UploadRequest,
  onProgress?: (loaded: number, total: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const client = target.protocol === 'http:' ? httpRequest : httpsRequest
    const total = request.body.byteLength

    const req = client(
      target,
      {
        method: request.method,
        headers: { ...request.headers, 'content-length': String(total) }
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf-8') })
        )
      }
    )

    req.setTimeout(request.timeoutMs ?? 60_000, () => {
      req.destroy(new Error('upload timeout'))
    })
    req.on('error', reject)

    let offset = 0
    const writeNext = (): void => {
      while (offset < total) {
        const end = Math.min(offset + CHUNK_SIZE, total)
        const flushed = req.write(request.body.subarray(offset, end))
        offset = end
        onProgress?.(offset, total)
        if (!flushed) {
          req.once('drain', writeNext)
          return
        }
      }
      req.end()
    }

    if (total === 0) {
      req.end()
      return
    }
    writeNext()
  })
}
