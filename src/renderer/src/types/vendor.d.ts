declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'
  interface Options {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }
  const plugin: (md: MarkdownIt, options?: Options) => void
  export default plugin
}

declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-emoji' {
  import type MarkdownIt from 'markdown-it'
  export const bare: (md: MarkdownIt) => void
  export const light: (md: MarkdownIt) => void
  export const full: (md: MarkdownIt) => void
}

declare module '@traptitech/markdown-it-katex' {
  import type MarkdownIt from 'markdown-it'

  interface Options {
    throwOnError?: boolean
    errorColor?: string
    strict?: boolean | 'ignore' | 'warn' | 'error'
    output?: 'html' | 'mathml' | 'htmlAndMathml'
  }

  const plugin: (md: MarkdownIt, options?: Options) => void
  export default plugin
}
