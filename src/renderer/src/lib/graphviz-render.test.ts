/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { renderGraphvizSvg } from './graphviz-render'

const block = { id: 'd0', lang: 'dot', code: 'digraph { A -> B }' }

describe('renderGraphvizSvg', () => {
  it('renders a sanitized svg and reuses it for the same source and theme', async () => {
    const first = await renderGraphvizSvg(block, 'light')
    const second = await renderGraphvizSvg(block, 'light')

    expect(first).toContain('<svg')
    expect(first).not.toContain('<script')
    expect(first).toBe(second)
    expect(first).toContain('#24292f')
  })

  it('uses a light ink color in the dark theme', async () => {
    const svg = await renderGraphvizSvg(block, 'dark')
    expect(svg).toContain('#e5e7eb')
  })

  it('rejects source that is not DOT', async () => {
    await expect(renderGraphvizSvg({ ...block, code: 'this is not a graph' }, 'light')).rejects.toThrow()
  })
})
