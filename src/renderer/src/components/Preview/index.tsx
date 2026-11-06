import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import DOMPurify from 'dompurify'
import { renderMarkdown } from '@/lib/markdown'
import { hydrateDiagrams } from '@/lib/diagram-hydrate'
import { PREVIEW_ALLOWED_URI_REGEXP, toPreviewImageSrc } from '@shared/image-url'
import type { DiagramBlock } from '@shared/diagram'
import { useDebounce } from '@/hooks/useDebounce'
import type { PreviewFontFamily, PreviewTheme } from '@/hooks/useAppearanceSettings'
import type { Theme } from '@/hooks/useTheme'

interface PreviewProps {
  content: string
  documentPath: string | null
  theme: Theme
  previewTheme: PreviewTheme
  previewFontFamily: PreviewFontFamily
  fontSize: number
}

export const Preview = forwardRef<HTMLDivElement, PreviewProps>(
  ({ content, documentPath, theme, previewTheme, previewFontFamily, fontSize }, ref) => {
    const debouncedContent = useDebounce(content, 80)
    const innerRef = useRef<HTMLDivElement>(null)
    const { i18n } = useTranslation()

    // 处理预览区内的链接点击，通过 electron shell 在外部浏览器打开
    useEffect(() => {
      const container = innerRef.current
      if (!container) return
      const handleClick = (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('a')
        if (!target) return
        const href = target.getAttribute('href')
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          e.preventDefault()
          // electron 环境下已在 preload 中设置 target="_blank"，
          // 主进程通过 setWindowOpenHandler 拦截并调用 shell.openExternal
        }
      }
      container.addEventListener('click', handleClick)
      return () => container.removeEventListener('click', handleClick)
    }, [])

    const rendered = useMemo(() => {
      const diagrams: DiagramBlock[] = []
      const raw = renderMarkdown(debouncedContent, {
        resolveImageSrc: (src) => toPreviewImageSrc(src, documentPath),
        diagrams
      })
      return {
        html: DOMPurify.sanitize(raw, {
          ADD_ATTR: ['target', 'rel'],
          ADD_TAGS: ['iframe'],
          ALLOWED_URI_REGEXP: PREVIEW_ALLOWED_URI_REGEXP
        }),
        diagrams
      }
    }, [debouncedContent, documentPath])

    // 图表是异步渲染的：HTML 提交后再水合；内容/主题/语言变化都会重建，旧渲染被 abort
    useEffect(() => {
      const container = innerRef.current
      if (!container || rendered.diagrams.length === 0) return
      const controller = new AbortController()
      void hydrateDiagrams(container, rendered.diagrams, {
        theme,
        signal: controller.signal
      })
      return () => controller.abort()
    }, [rendered, theme, i18n.language])

    return (
      <div
        ref={(node) => {
          innerRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        className={`h-full overflow-y-auto px-10 py-8 ${
          theme === 'dark' ? 'preview-surface-dark' : 'preview-surface-light'
        } preview-theme-${previewTheme} preview-font-${previewFontFamily}`}
      >
        <article
          className="markdown-body max-w-3xl mx-auto"
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
      </div>
    )
  }
)

Preview.displayName = 'Preview'
