import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { app, safeStorage } from 'electron'
import {
  DEFAULT_IMAGE_HOST_CONFIG,
  fromStoredConfig,
  toStoredConfig,
  type ImageHostConfig,
  type StoredSecret
} from '../shared/image-host'

function encryptSecret(plain: string): StoredSecret {
  if (!plain) return { enc: false, value: '' }
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return { enc: true, value: safeStorage.encryptString(plain).toString('base64') }
    }
  } catch {
    // 没有可用密钥环（部分 Linux 桌面）时退化为明文，与 language.json 的处理一致
  }
  return { enc: false, value: plain }
}

function decryptSecret(secret: unknown): string {
  if (typeof secret !== 'object' || secret === null) return ''
  const { enc, value } = secret as Partial<StoredSecret>
  if (typeof value !== 'string' || value === '') return ''
  if (!enc) return value
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  } catch {
    // 换机器或密钥环重置后解不开，按未配置处理
    return ''
  }
}

function storePath(): string {
  return join(app.getPath('userData'), 'image-host.json')
}

export async function loadImageHostConfig(): Promise<ImageHostConfig> {
  try {
    const raw = JSON.parse(await readFile(storePath(), 'utf-8'))
    return fromStoredConfig(raw, decryptSecret)
  } catch {
    return DEFAULT_IMAGE_HOST_CONFIG
  }
}

export async function saveImageHostConfig(config: ImageHostConfig): Promise<void> {
  await writeFile(storePath(), JSON.stringify(toStoredConfig(config, encryptSecret), null, 2), 'utf-8')
}
