import DOMPurify from 'dompurify'
import { renderMarkdown } from '@/lib/markdown'
import type { PreviewFontFamily, PreviewTheme } from '@/hooks/useAppearanceSettings'
import type { Theme } from '@/hooks/useTheme'

interface ExportDocumentOptions {
  title: string
  content: string
  theme: Theme
  previewTheme: PreviewTheme
  previewFontFamily: PreviewFontFamily
  fontSize: number
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildExportHtmlDocument(options: ExportDocumentOptions): string {
  const {
    title,
    content,
    theme,
    previewTheme,
    previewFontFamily,
    fontSize
  } = options

  const html = DOMPurify.sanitize(renderMarkdown(content), {
    ADD_ATTR: ['target', 'rel'],
    ADD_TAGS: ['iframe']
  })

  const isDark = theme === 'dark'
  const bg = isDark ? '#0f172a' : '#ffffff'
  const fg = isDark ? '#e5e7eb' : '#24292f'
  const border = isDark ? '#334155' : '#d0d7de'
  const codeBg = isDark ? '#0b1220' : '#f6f8fa'
  const fontFamily =
    previewFontFamily === 'serif'
      ? '"Noto Serif SC", "Songti SC", "Times New Roman", Georgia, serif'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif'
  const maxWidth = previewTheme === 'notion' ? '860px' : '980px'

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: ${isDark ? 'dark' : 'light'}; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: ${bg};
      color: ${fg};
      font-family: ${fontFamily};
      font-size: ${fontSize}px;
      line-height: 1.75;
    }
    article {
      max-width: ${maxWidth};
      margin: 0 auto;
      padding: 48px 32px 64px;
      word-break: break-word;
    }
    h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.3em 0 0.7em; }
    p, ul, ol, blockquote, pre, table { margin: 0 0 1em; }
    blockquote {
      margin-left: 0;
      padding-left: 1em;
      border-left: 4px solid ${border};
      opacity: 0.9;
    }
    code {
      background: ${codeBg};
      border-radius: 6px;
      padding: 0.15em 0.35em;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 0.9em;
    }
    pre {
      background: ${codeBg};
      border: 1px solid ${border};
      border-radius: 10px;
      padding: 14px 16px;
      overflow-x: auto;
    }
    pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
      font-size: 0.88em;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      display: block;
      overflow-x: auto;
    }
    th, td {
      border: 1px solid ${border};
      padding: 0.45em 0.65em;
      text-align: left;
    }
    hr {
      border: 0;
      border-top: 1px solid ${border};
      margin: 1.8em 0;
    }
    img { max-width: 100%; height: auto; }
    @page { margin: 16mm 14mm; }
  </style>
</head>
<body>
  <article class="markdown-body">
    ${html}
  </article>
</body>
</html>`
}
