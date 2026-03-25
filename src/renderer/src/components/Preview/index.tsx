import { forwardRef, useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'
import { renderMarkdown } from '@/lib/markdown'
import { useDebounce } from '@/hooks/useDebounce'
import type { PreviewFontFamily, PreviewTheme } from '@/hooks/useAppearanceSettings'
import type { Theme } from '@/hooks/useTheme'

interface PreviewProps {
  content: string
  theme: Theme
  previewTheme: PreviewTheme
  previewFontFamily: PreviewFontFamily
  fontSize: number
}

export const Preview = forwardRef<HTMLDivElement, PreviewProps>(
  ({ content, theme, previewTheme, previewFontFamily, fontSize }, ref) => {
    const debouncedContent = useDebounce(content, 80)
    const innerRef = useRef<HTMLDivElement>(null)

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

    const html = DOMPurify.sanitize(renderMarkdown(debouncedContent), {
      ADD_ATTR: ['target', 'rel'],
      ADD_TAGS: ['iframe']
    })

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
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    )
  }
)

Preview.displayName = 'Preview'
