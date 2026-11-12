/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import type { ChartConfiguration } from 'chart.js'
import { renderChartDiagram } from './chart-render'

const charts: Array<{ canvas: HTMLCanvasElement; config: ChartConfiguration; destroyed: boolean }> = []

vi.mock('chart.js', () => {
  class Token {}
  class Chart {
    canvas: HTMLCanvasElement
    config: ChartConfiguration
    destroyed = false
    static register = vi.fn()
    constructor(canvas: HTMLCanvasElement, config: ChartConfiguration) {
      this.canvas = canvas
      this.config = config
      charts.push(this)
    }
    destroy() {
      this.destroyed = true
    }
  }
  return {
    Chart,
    BarController: Token,
    LineController: Token,
    PieController: Token,
    RadarController: Token,
    CategoryScale: Token,
    LinearScale: Token,
    RadialLinearScale: Token,
    PointElement: Token,
    LineElement: Token,
    BarElement: Token,
    ArcElement: Token,
    Filler: Token,
    Tooltip: Token,
    Legend: Token
  }
})

const bar = `{
  "type": "bar",
  "data": { "labels": ["一月"], "datasets": [{ "label": "销售额", "data": [12] }] }
}`

describe('renderChartDiagram', () => {
  it('turns an export chart into a high-resolution image and destroys the chart', async () => {
    HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,qq'
    const host = document.createElement('div')
    await renderChartDiagram(host, { id: 'd0', lang: 'chartjs', code: bar }, 'light', new AbortController().signal, true)

    const chart = charts.at(-1)!
    expect(chart.canvas.width).toBe(1440)
    expect(chart.canvas.height).toBe(810)
    expect(chart.config.options).toMatchObject({ responsive: false, animation: false, devicePixelRatio: 2 })
    expect(chart.destroyed).toBe(true)
    const image = host.querySelector('img')
    expect(image?.getAttribute('src')).toBe('data:image/png;base64,qq')
    expect(image?.getAttribute('alt')).toBe('销售额')
    expect(host.dataset.diagramState).toBe('ready')
  })

  it('keeps a live canvas in the preview and destroys it when cancelled', async () => {
    const host = document.createElement('div')
    const controller = new AbortController()
    await renderChartDiagram(host, { id: 'd0', lang: 'chartjs', code: bar }, 'dark', controller.signal, false)

    expect(host.querySelector('canvas')).toBeTruthy()
    expect(host.querySelector('img')).toBeNull()
    const chart = charts.at(-1)!
    expect(chart.config.options?.plugins).toMatchObject({ legend: { labels: { color: '#e5e7eb' } } })
    controller.abort()
    expect(chart.destroyed).toBe(true)
  })

  it('rejects a chart that is not valid json', async () => {
    const host = document.createElement('div')
    await expect(
      renderChartDiagram(host, { id: 'd0', lang: 'chartjs', code: '{' }, 'light', new AbortController().signal, false)
    ).rejects.toThrow('Chart config is not valid JSON')
  })
})
