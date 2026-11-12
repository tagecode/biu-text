/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { hydrateDiagrams } from './diagram-hydrate'

function hostFor(id: string): HTMLElement {
  const root = document.createElement('div')
  const host = document.createElement('div')
  host.dataset.diagramId = id
  root.append(host)
  return root
}

describe('hydrateDiagrams', () => {
  it('mounts a graphviz svg and leaves other hosts alone', async () => {
    const root = hostFor('d0')
    await hydrateDiagrams(
      root,
      [{ id: 'd0', lang: 'dot', code: 'digraph { A -> B }' }],
      { theme: 'light', signal: new AbortController().signal }
    )

    const host = root.querySelector('[data-diagram-id="d0"]') as HTMLElement
    expect(host.querySelector('svg')).toBeTruthy()
    expect(host.dataset.diagramState).toBe('ready')
  })

  it('keeps the source and shows an error when DOT cannot be rendered', async () => {
    const root = hostFor('d0')
    await hydrateDiagrams(
      root,
      [{ id: 'd0', lang: 'dot', code: 'this is not a graph' }],
      { theme: 'light', signal: new AbortController().signal }
    )

    const host = root.querySelector('[data-diagram-id="d0"]') as HTMLElement
    expect(host.querySelector('.biu-diagram-source')?.textContent).toContain('this is not a graph')
    expect(host.querySelector('.biu-diagram-error')).toBeTruthy()
    expect(host.dataset.diagramState).toBe('error')
  })

  it('keeps the source and shows an error when a chart is invalid', async () => {
    const root = hostFor('d0')
    await hydrateDiagrams(
      root,
      [{ id: 'd0', lang: 'chartjs', code: 'not-json' }],
      { theme: 'light', signal: new AbortController().signal }
    )

    const host = root.querySelector('[data-diagram-id="d0"]') as HTMLElement
    expect(host.querySelector('.biu-diagram-source')?.textContent).toContain('not-json')
    expect(host.querySelector('.biu-diagram-error')?.textContent).toContain('Diagram failed to render')
    expect(host.querySelector('.biu-diagram-error')?.textContent).toContain('Chart config is not valid JSON')
    expect(host.dataset.diagramState).toBe('error')
  })

  it('stops before mounting when the signal is already aborted', async () => {
    const root = hostFor('d0')
    const signal = new AbortController()
    signal.abort()
    await hydrateDiagrams(root, [{ id: 'd0', lang: 'dot', code: 'digraph { A -> B }' }], { theme: 'light', signal: signal.signal })

    const host = root.querySelector('[data-diagram-id="d0"]') as HTMLElement
    expect(host.childElementCount).toBe(0)
  })
})
