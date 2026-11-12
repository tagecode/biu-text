import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { buildExportHtmlDocument } from '@/lib/export-document'
import { withPreviewImages } from '@shared/export-preview-html'
import type { PreviewFontFamily, PreviewTheme } from '@/hooks/useAppearanceSettings'
import type { Theme } from '@/hooks/useTheme'

export type ExportIntent = 'html' | 'pdf'

interface ExportPreviewProps {
  open: boolean
  intent: ExportIntent
  content: string
  documentPath: string | null
  title: string
  theme: Theme
  previewTheme: PreviewTheme
  previewFontFamily: PreviewFontFamily
  fontSize: number
  onClose: () => void
  onExportHtml: (html: string) => Promise<{ path: string } | null>
  onExportPdf: (html: string) => Promise<{ path: string } | null>
}

export function ExportPreview({
  open,
  intent,
  content,
  documentPath,
  title,
  theme: initialTheme,
  previewTheme: initialPreviewTheme,
  previewFontFamily: initialFontFamily,
  fontSize: initialFontSize,
  onClose,
  onExportHtml,
  onExportPdf
}: ExportPreviewProps) {
  const { t } = useTranslation()
  const [theme, setTheme] = useState(initialTheme)
  const [previewTheme, setPreviewTheme] = useState(initialPreviewTheme)
  const [previewFontFamily, setPreviewFontFamily] = useState(initialFontFamily)
  const [fontSize, setFontSize] = useState(initialFontSize)
  const [html, setHtml] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (!open || wasOpen.current) return
    setTheme(initialTheme)
    setPreviewTheme(initialPreviewTheme)
    setPreviewFontFamily(initialFontFamily)
    setFontSize(initialFontSize)
    setHtml(null)
  }, [open, initialTheme, initialPreviewTheme, initialFontFamily, initialFontSize])

  useEffect(() => {
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setPreparing(true)
    const timer = setTimeout(() => {
      setPreparing(true)
      void buildExportHtmlDocument({
        title,
        content,
        theme,
        previewTheme,
        previewFontFamily,
        fontSize,
        signal: controller.signal
      })
        .then((next) => {
          if (!controller.signal.aborted) setHtml(next)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (!controller.signal.aborted) setHtml(null)
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreparing(false)
        })
    }, 120)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, title, content, theme, previewTheme, previewFontFamily, fontSize])

  const exportWith = async (format: ExportIntent) => {
    if (!html || exporting) return
    setExporting(true)
    try {
      const saved = format === 'html' ? await onExportHtml(html) : await onExportPdf(html)
      if (saved) onClose()
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !exporting) onClose() }}>
      <DialogContent
        className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        aria-describedby={undefined}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <DialogTitle>{t('exportPreview.title')}</DialogTitle>
          <p className="text-xs text-muted-foreground">{t('exportPreview.hint')}</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="flex shrink-0 flex-col gap-4 border-b p-4 md:w-56 md:border-r md:border-b-0">
            <Field label={t('exportPreview.theme')}>
              <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('appearance.light')}</SelectItem>
                  <SelectItem value="dark">{t('appearance.dark')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('settings.previewTheme')}>
              <Select value={previewTheme} onValueChange={(value) => setPreviewTheme(value as PreviewTheme)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="notion">Notion</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('settings.previewFont')}>
              <Select
                value={previewFontFamily}
                onValueChange={(value) => setPreviewFontFamily(value as PreviewFontFamily)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sans">{t('settings.sans')}</SelectItem>
                  <SelectItem value="serif">{t('settings.serif')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={`${t('settings.fontSize')} ${fontSize}px`}>
              <Slider
                min={12}
                max={24}
                step={1}
                value={[fontSize]}
                onValueChange={(value) => setFontSize(value[0] ?? fontSize)}
                thumbLabel={t('settings.adjustFontSize')}
              />
            </Field>
          </div>
          <div className="relative min-w-0 flex-1 bg-muted/40">
            {html ? (
              <iframe
                title={t('exportPreview.title')}
                className="h-full w-full border-0 bg-white"
                sandbox=""
                srcDoc={withPreviewImages(html, documentPath)}
              />
            ) : null}
            {preparing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
                {t('exportPreview.preparing')}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" disabled={exporting} onClick={onClose}>
            {t('dialog.cancel')}
          </Button>
          <Button
            variant={intent === 'html' ? 'default' : 'outline'}
            disabled={!html || preparing || exporting}
            onClick={() => void exportWith('html')}
          >
            {t('toolbar.exportHtml')}
          </Button>
          <Button
            variant={intent === 'pdf' ? 'default' : 'outline'}
            disabled={!html || preparing || exporting}
            onClick={() => void exportWith('pdf')}
          >
            {t('toolbar.exportPdf')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
