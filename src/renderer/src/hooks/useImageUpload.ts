import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImageFileInput } from '@shared/image-input'
import type { ImageHostType, ImageUploadResult } from '@shared/image-host'
import { toast } from '@/lib/toast-store'
import { uploadProgressed, uploadSettled, uploadStarted } from '@/lib/upload-store'
import {
  altFromName,
  hasPlaceholder,
  imageMarkdown,
  placeholderMarkdown,
  replacePlaceholder
} from '@/lib/upload-placeholder'

/** 失败可重试的提示给足阅读时间，其余沿用 3 秒 */
const RETRY_TOAST_DURATION = 8000

let uploadSeq = 0

export function nextUploadId(): string {
  uploadSeq += 1
  return `u${Date.now().toString(36)}${uploadSeq.toString(36)}`
}

export interface UseImageUploadOptions {
  hostType: ImageHostType
  /** 在光标处插入占位符，由调用方决定落到哪个编辑器 */
  insertPlaceholders: (text: string) => void
  /** 占位符回填：只改文档内容，不碰光标 */
  updateContent: (updater: (prev: string) => string) => void
  /** 重试前确认占位符还在文档里，用户删掉的就不要再传了 */
  getContent: () => string
}

export function useImageUpload({
  hostType,
  insertPlaceholders,
  updateContent,
  getContent
}: UseImageUploadOptions) {
  const { t } = useTranslation()
  // 「重试」要调回上传本身，用 ref 打破自引用
  const retryRef = useRef<(id: string, file: ImageFileInput) => Promise<void>>(() =>
    Promise.resolve()
  )

  const uploadOne = useCallback(
    async (id: string, file: ImageFileInput) => {
      uploadStarted(id, file.name, file.bytes.byteLength)
      let result: ImageUploadResult
      try {
        result = await window.imageAPI.upload({ uploadId: id, ...file })
      } catch (err) {
        // 通道本身出错时也要收掉进度条，否则它会一直挂在那里
        result = { ok: false, error: err instanceof Error ? err.message : String(err) }
      } finally {
        uploadSettled(id)
      }

      if (result.ok) {
        updateContent((prev) =>
          replacePlaceholder(prev, id, imageMarkdown(altFromName(file.name), result.url))
        )
        return
      }

      toast({
        level: 'error',
        title: t('imageHost.uploadFailed', { name: file.name }),
        description: result.error,
        duration: RETRY_TOAST_DURATION,
        action: {
          label: t('imageHost.retry'),
          onClick: () => {
            if (!hasPlaceholder(getContent(), id)) return
            void retryRef.current(id, file)
          }
        }
      })
    },
    [getContent, t, updateContent]
  )

  useEffect(() => {
    retryRef.current = uploadOne
  }, [uploadOne])

  /** 先把占位符一次性插好，再并发上传；每张图独立成功/失败 */
  const startUpload = useCallback(
    (files: ImageFileInput[]) => {
      if (files.length === 0) return
      const ids = files.map(() => nextUploadId())
      insertPlaceholders(ids.map(placeholderMarkdown).join('\n'))
      ids.forEach((id, index) => {
        void uploadOne(id, files[index])
      })
    },
    [insertPlaceholders, uploadOne]
  )

  const isCloud = hostType !== 'local'

  useEffect(() => {
    if (!isCloud) return
    return window.imageAPI.onUploadProgress(({ uploadId, loaded, total }) => {
      uploadProgressed(uploadId, loaded, total)
    })
  }, [isCloud])

  return { startUpload, isCloud }
}
