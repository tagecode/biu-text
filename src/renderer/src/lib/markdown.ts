import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import markdownItFootnote from 'markdown-it-footnote'
import { full as markdownItEmoji } from 'markdown-it-emoji'
import taskLists from 'markdown-it-task-lists'
import markdownItKatex from '@traptitech/markdown-it-katex'
import type { DiagramBlock } from '@shared/diagram'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function highlightCode(str: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const highlighted = hljs.highlight(str, {
        language: lang,
        ignoreIllegals: true
      }).value
      return `<pre class="hljs"><code class="language-${lang}">${highlighted}</code></pre>`
    } catch {
      // fall through
    }
  }

  return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`
}

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight: highlightCode
})

md.use(markdownItFootnote)
md.use(markdownItEmoji)
md.use(markdownItKatex, {
  throwOnError: false,
  errorColor: '#cc0000'
})
md.use(taskLists, { enabled: true, label: true, labelAfter: false })

// 使外部链接在新窗口打开（配合 Electron shell.openExternal）
type LinkOpenRule = NonNullable<typeof md.renderer.rules.link_open>

const defaultLinkOpen: LinkOpenRule =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const hrefIndex = token.attrIndex('href')
  if (hrefIndex >= 0) {
    const href = token.attrs![hrefIndex][1]
    if (href.startsWith('http://') || href.startsWith('https://')) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    }
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

type ImageRule = NonNullable<typeof md.renderer.rules.image>

const defaultImageRule: ImageRule =
  md.renderer.rules.image || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const resolveImageSrc = env?.resolveImageSrc as MarkdownRenderEnv['resolveImageSrc']
  const srcIndex = token.attrIndex('src')
  if (resolveImageSrc && srcIndex >= 0) {
    token.attrSet('src', resolveImageSrc(token.attrs![srcIndex][1]))
  }
  return defaultImageRule(tokens, idx, options, env, self)
}

type FenceRule = NonNullable<typeof md.renderer.rules.fence>

type DiagramCollector = NonNullable<MarkdownRenderEnv['diagrams']>

// 图表不能同步渲染，这里只产出占位元素，真正的 SVG 由 Preview 在提交后水合
const defaultFence: FenceRule = md.renderer.rules.fence!

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const diagrams = env?.diagrams as DiagramCollector | undefined
  const lang = token.info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (diagrams && lang === 'mermaid') {
    const id = `d${diagrams.length}`
    diagrams.push({ id, lang, code: token.content })
    return `<div class="biu-diagram" data-diagram-id="${id}" data-diagram-lang="${lang}" data-diagram-state="pending"></div>\n`
  }
  return defaultFence(tokens, idx, options, env, self)
}

export interface MarkdownRenderEnv {
  /** 预览区用它把相对路径转成自定义协议地址；导出时不传，保持原始引用 */
  resolveImageSrc?: (src: string) => string
  /** 传入即启用图表占位收集，收集到的块由调用方负责水合 */
  diagrams?: DiagramBlock[]
}

export function renderMarkdown(content: string, env: MarkdownRenderEnv = {}): string {
  return md.render(content, env)
}
