import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import markdownItFootnote from 'markdown-it-footnote'
import { full as markdownItEmoji } from 'markdown-it-emoji'
import taskLists from 'markdown-it-task-lists'
import markdownItKatex from '@traptitech/markdown-it-katex'

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
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens: any[], idx: number, options: any, _env: unknown, self: any): string {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.link_open = function (
  tokens: any[],
  idx: number,
  options: any,
  env: unknown,
  self: any
): string {
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

export function renderMarkdown(content: string): string {
  return md.render(content)
}
