/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExcalidrawBlock, type ExcalidrawScene } from '@shared/excalidraw'

const exportToSvg = vi.fn()

vi.mock('@excalidraw/excalidraw', () => ({
  exportToSvg: (...args: unknown[]) => exportToSvg(...(args as []))
}))

const { renderExcalidrawSvg, resetExcalidrawCache } = await import('./excalidraw-render')

function scene(code?: Partial<ExcalidrawScene>): string {
  return buildExcalidrawBlock({
    elements: [{ id: 'a', type: 'rectangle', x: 0, y: 0, width: 100, height: 50 }],
    appState: {},
    files: null,
    ...code
  })
    .split('\n')
    .slice(1, -1)
    .join('\n')
}

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '120')
  svg.setAttribute('height', '70')
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('width', '100')
  rect.setAttribute('height', '50')
  svg.append(rect)
  return svg
}

function block(code: string) {
  return { id: 'd0', lang: 'excalidraw', code }
}

beforeEach(() => {
  exportToSvg.mockReset()
  exportToSvg.mockResolvedValue(makeSvg())
  resetExcalidrawCache()
})

describe('renderExcalidrawSvg', () => {
  it('把场景渲染成 SVG 字符串', async () => {
    const svg = await renderExcalidrawSvg(block(scene()), 'light')
    expect(svg).toContain('<svg')
    expect(svg).toContain('<rect')
    expect(exportToSvg).toHaveBeenCalledTimes(1)
  })

  it('同一份代码 + 主题命中缓存', async () => {
    await renderExcalidrawSvg(block(scene()), 'light')
    await renderExcalidrawSvg(block(scene()), 'light')
    expect(exportToSvg).toHaveBeenCalledTimes(1)

    // 主题变了要重新渲染
    await renderExcalidrawSvg(block(scene()), 'dark')
    expect(exportToSvg).toHaveBeenCalledTimes(2)
  })

  it('暗色主题把 exportWithDarkMode 传下去', async () => {
    await renderExcalidrawSvg(block(scene()), 'dark')
    const options = exportToSvg.mock.calls[0][0] as { appState: Record<string, unknown> }
    expect(options.appState.exportWithDarkMode).toBe(true)
    expect(options.appState.viewBackgroundColor).toBe('#1e1e1e')
  })

  it('亮色主题默认白底', async () => {
    await renderExcalidrawSvg(block(scene()), 'light')
    const options = exportToSvg.mock.calls[0][0] as { appState: Record<string, unknown> }
    expect(options.appState.viewBackgroundColor).toBe('#ffffff')
    expect(options.appState.exportWithDarkMode).toBe(false)
  })

  it('非法 JSON 抛出可读错误，不调用渲染库', async () => {
    await expect(renderExcalidrawSvg(block('{oops'), 'light')).rejects.toThrow(/JSON/i)
    expect(exportToSvg).not.toHaveBeenCalled()
  })

  it('空场景抛出错误', async () => {
    await expect(
      renderExcalidrawSvg(block('{"elements":[]}'), 'light')
    ).rejects.toThrow()
    expect(exportToSvg).not.toHaveBeenCalled()
  })

  it('渲染库返回非 SVG 内容时报错', async () => {
    exportToSvg.mockResolvedValueOnce(document.createElementNS('http://www.w3.org/1999/xhtml', 'div'))
    await expect(renderExcalidrawSvg(block(scene()), 'light')).rejects.toThrow(/SVG/)
  })
})
