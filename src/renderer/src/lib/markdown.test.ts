import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown diagrams', () => {
  it('collects mermaid and chartjs fences and leaves other code alone', () => {
    const diagrams: { id: string; lang: string; code: string }[] = []
    const html = renderMarkdown(
      ['```chartjs', '{"type":"bar"}', '```', '', '```js', 'const a = 1', '```', ''].join('\n'),
      { diagrams }
    )

    expect(diagrams).toEqual([{ id: 'd0', lang: 'chartjs', code: '{"type":"bar"}\n' }])
    expect(html).toContain('data-diagram-lang="chartjs"')
    expect(html).toContain('class="language-js"')
  })

  it('collects a dot fence as a graphviz diagram', () => {
    const diagrams: { id: string; lang: string; code: string }[] = []
    const html = renderMarkdown(['```dot', 'digraph { A -> B }', '```', ''].join('\n'), { diagrams })

    expect(diagrams).toEqual([{ id: 'd0', lang: 'dot', code: 'digraph { A -> B }\n' }])
    expect(html).toContain('data-diagram-lang="dot"')
  })
})
