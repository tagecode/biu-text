import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { hydrateDiagrams } from '@/lib/diagram-hydrate'
import { BlockRenderer, type RenderedBlock } from '@/lib/block-renderer'
import { appendBlocks, applyBlocks } from '@/lib/preview-dom'
import { ensureHeadingIds, scrollToHeading } from '@/lib/heading-anchor'
import { toPreviewImageSrc } from '@shared/image-url'
import type { LinkPreview } from '@shared/link-preview'
import { useDebounce } from '@/hooks/useDebounce'
import type { PreviewFontFamily, PreviewTheme } from '@/hooks/useAppearanceSettings'
import type { Theme } from '@/hooks/useTheme'

/**
 * 每帧最多花在渲染上的时间。
 *
 * 这个值同时决定了「单帧卡顿」和「全部填完要多久」：单帧预算越大，总帧数越少、
 * 因反复布局付出的总代价越低，但单帧越卡。12ms 是留出绘制余量后的折中。
 */
const FRAME_BUDGET_MS = 12
const NO_KEYS: ReadonlySet<string> = new Set()
/** 悬停多久后才请求预览，避免划过链接也发请求 */
const LINK_PREVIEW_DELAY_MS = 350

interface LinkPreviewState {
  data: LinkPreview
  anchor: { left: number; top: number; bottom: number }
}

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
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const articleRef = useRef<HTMLElement | null>(null)
    // 渲染器跟着组件实例走：换标签会重挂载，缓存不会串到别的文档
    const [renderer] = useState(() => new BlockRenderer())
    const [linkPreview, setLinkPreview] = useState<LinkPreviewState | null>(null)
    const blocksRef = useRef<RenderedBlock[]>([])
    /** 上一次写进 DOM 的块数组（渲染器在整个 generation 期间返回同一个实例） */
    const appliedBlocksRef = useRef<RenderedBlock[] | null>(null)
    const appliedCountRef = useRef(0)
    // 按块记录水合任务，只中止被替换/移除的那一块，其它块的图表继续渲染
    const hydrationsRef = useRef(new Map<string, AbortController>())
    const themeRef = useRef(theme)
    const { i18n } = useTranslation()

    useEffect(() => {
      themeRef.current = theme
    }, [theme])

    // 处理预览区内的链接点击，通过 electron shell 在外部浏览器打开
    useEffect(() => {
      const container = scrollRef.current
      if (!container) return
      const handleClick = (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('a')
        if (!target) return
        const href = target.getAttribute('href')
        // 文档内锚点：滚动到对应标题，不触发外部打开
        if (href?.startsWith('#')) {
          e.preventDefault()
          scrollToHeading(container, href)
          return
        }
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          e.preventDefault()
          // electron 环境下已在 preload 中设置 target="_blank"，
          // 主进程通过 setWindowOpenHandler 拦截并调用 shell.openExternal
        }
      }
      container.addEventListener('click', handleClick)
      return () => container.removeEventListener('click', handleClick)
    }, [])

    // 悬停外链时抓取 Open Graph 信息，卡片只读且不拦截鼠标
    useEffect(() => {
      const container = scrollRef.current
      if (!container) return
      let timer: number | null = null
      let requested: string | null = null

      const clear = (): void => {
        if (timer !== null) {
          window.clearTimeout(timer)
          timer = null
        }
        requested = null
        setLinkPreview(null)
      }

      const handleOver = (event: MouseEvent): void => {
        const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a')
        if (!anchor) return
        const from = event.relatedTarget as Node | null
        if (from && anchor.contains(from)) return
        const href = anchor.getAttribute('href')
        if (!href || !/^https?:\/\//i.test(href)) return

        if (timer !== null) window.clearTimeout(timer)
        requested = href
        const rect = anchor.getBoundingClientRect()
        const anchorRect = { left: rect.left, top: rect.top, bottom: rect.bottom }
        timer = window.setTimeout(() => {
          timer = null
          window.linkAPI
            .fetchPreview(href)
            .then((data) => {
              if (!data || requested !== href) return
              setLinkPreview({ data, anchor: anchorRect })
            })
            .catch(() => undefined)
        }, LINK_PREVIEW_DELAY_MS)
      }

      const handleOut = (event: MouseEvent): void => {
        const anchor = (event.target as HTMLElement | null)?.closest('a')
        if (!anchor) return
        const to = event.relatedTarget as Node | null
        if (to && anchor.contains(to)) return
        clear()
      }

      container.addEventListener('mouseover', handleOver)
      container.addEventListener('mouseout', handleOut)
      container.addEventListener('scroll', clear, { passive: true })
      return () => {
        clear()
        container.removeEventListener('mouseover', handleOver)
        container.removeEventListener('mouseout', handleOut)
        container.removeEventListener('scroll', clear)
      }
    }, [])

    const hydrateBlock = useCallback((block: RenderedBlock) => {
      const article = articleRef.current
      if (!article || block.diagrams.length === 0) return
      hydrationsRef.current.get(block.key)?.abort()
      const controller = new AbortController()
      hydrationsRef.current.set(block.key, controller)
      void hydrateDiagrams(article, block.diagrams, {
        theme: themeRef.current,
        signal: controller.signal
      }).finally(() => {
        if (hydrationsRef.current.get(block.key) === controller) {
          hydrationsRef.current.delete(block.key)
        }
      })
    }, [])

    // 分帧写入：每帧只渲染到时间预算用完，首屏不会一次性阻塞；剩余块在后续帧补齐
    useLayoutEffect(() => {
      const article = articleRef.current
      if (!article) return

      let cancelled = false
      let frame = 0

      const runFrame = (): void => {
        if (cancelled) return
        const result = renderer.render(
          debouncedContent,
          {
            resolveImageSrc: (src) => toPreviewImageSrc(src, documentPath),
            documentPath
          },
          FRAME_BUDGET_MS
        )
        blocksRef.current = result.blocks

        // 同一 generation 且只是变长：直接追加，避免每帧重建整篇索引
        const appending =
          appliedBlocksRef.current === result.blocks &&
          appliedCountRef.current <= result.blocks.length &&
          article.childNodes.length > 0

        let toHydrate: RenderedBlock[]
        if (appending) {
          const from = appliedCountRef.current
          appendBlocks(article, result.blocks, from)
          toHydrate = result.blocks.slice(from)
        } else {
          const { rebuiltKeys, removedKeys } = applyBlocks(article, result.blocks, NO_KEYS)
          for (const key of removedKeys) {
            hydrationsRef.current.get(key)?.abort()
            hydrationsRef.current.delete(key)
          }
          const rebuilt = new Set(rebuiltKeys)
          toHydrate = result.blocks.filter((block) => rebuilt.has(block.key))
        }

        appliedBlocksRef.current = result.blocks
        appliedCountRef.current = result.blocks.length
        ensureHeadingIds(article)

        for (const block of toHydrate) hydrateBlock(block)
        if (!result.done) frame = requestAnimationFrame(runFrame)
      }

      runFrame()
      return () => {
        cancelled = true
        if (frame) cancelAnimationFrame(frame)
      }
    }, [debouncedContent, documentPath, renderer, hydrateBlock])

    // 主题/语言变化不影响 HTML，但图表要按新主题重画
    const themeHydratedRef = useRef(false)
    useEffect(() => {
      if (!themeHydratedRef.current) {
        themeHydratedRef.current = true
        return
      }
      for (const controller of hydrationsRef.current.values()) controller.abort()
      hydrationsRef.current.clear()
      for (const block of blocksRef.current) hydrateBlock(block)
    }, [theme, i18n.language, hydrateBlock])

    // 卸载时中止所有在途水合，避免往已移除的节点里写 SVG
    useEffect(() => {
      const hydrations = hydrationsRef.current
      return () => {
        for (const controller of hydrations.values()) controller.abort()
        hydrations.clear()
      }
    }, [])

    const CARD_WIDTH = 340
    const cardStyle = linkPreview
      ? (() => {
          const left = Math.min(
            Math.max(8, linkPreview.anchor.left),
            Math.max(8, window.innerWidth - CARD_WIDTH - 8)
          )
          const below = linkPreview.anchor.bottom + 10
          const top =
            below + 200 > window.innerHeight
              ? Math.max(8, linkPreview.anchor.top - 200)
              : below
          return { left, top, width: CARD_WIDTH }
        })()
      : undefined

    return (
      <div
        ref={(node) => {
          scrollRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        className={`h-full overflow-y-auto px-10 py-8 ${
          theme === 'dark' ? 'preview-surface-dark' : 'preview-surface-light'
        } preview-theme-${previewTheme} preview-font-${previewFontFamily}`}
        data-testid="preview-scroll"
      >
        <article
          ref={articleRef}
          className="markdown-body max-w-3xl mx-auto"
          style={{ fontSize: `${fontSize}px` }}
        />

        {linkPreview && cardStyle ? (
          <div
            role="tooltip"
            data-testid="link-preview-card"
            className="pointer-events-none fixed z-50 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
            style={cardStyle}
          >
            {linkPreview.data.image ? (
              <img
                src={linkPreview.data.image}
                alt=""
                className="h-36 w-full bg-muted object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            ) : null}
            <div className="flex flex-col gap-1 p-3">
              {linkPreview.data.siteName ? (
                <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                  {linkPreview.data.siteName}
                </span>
              ) : null}
              {linkPreview.data.title ? (
                <p className="line-clamp-2 text-sm font-semibold">{linkPreview.data.title}</p>
              ) : null}
              {linkPreview.data.description ? (
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {linkPreview.data.description}
                </p>
              ) : null}
              <span className="truncate text-[11px] text-muted-foreground/80">
                {linkPreview.data.url}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    )
  }
)

Preview.displayName = 'Preview'
