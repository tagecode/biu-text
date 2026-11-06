import { useTranslation } from 'react-i18next'
import { useUploads } from '@/hooks/useUploads'

/** 右上角 Toast 下方：正在上传的图片与字节进度 */
export function UploadIndicator() {
  const { t } = useTranslation()
  const uploads = useUploads()

  if (uploads.length === 0) return null

  return (
    <div className="fixed right-3 bottom-11 z-[60] flex w-80 max-w-[calc(100%-1.5rem)] flex-col gap-2">
      {uploads.map((upload) => {
        const percent =
          upload.total > 0 ? Math.min(100, Math.round((upload.loaded / upload.total) * 100)) : 0
        return (
          <div key={upload.id} className="rounded-lg border bg-background p-3 shadow-lg">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{t('imageHost.uploading', { name: upload.name })}</span>
              <span className="tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <div
              className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-primary transition-[width] duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
