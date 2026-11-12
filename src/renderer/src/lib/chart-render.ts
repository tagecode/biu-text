import type { ChartConfiguration } from 'chart.js'
import i18n from '@/i18n'
import { parseChartConfig, type ChartConfig, type ChartType } from '@shared/chart'
import type { DiagramBlock } from '@shared/diagram'
import type { Theme } from '@/hooks/useTheme'

const PALETTE = ['#4c78a8', '#f58518', '#54a24b', '#e45756', '#72b7b2', '#b279a2']

type ChartModule = typeof import('chart.js')

let chartApi: Promise<ChartModule> | null = null

function loadChart(): Promise<ChartModule> {
  chartApi ??= import('chart.js').then((mod) => {
    mod.Chart.register(
      mod.BarController,
      mod.LineController,
      mod.PieController,
      mod.RadarController,
      mod.CategoryScale,
      mod.LinearScale,
      mod.RadialLinearScale,
      mod.PointElement,
      mod.LineElement,
      mod.BarElement,
      mod.ArcElement,
      mod.Filler,
      mod.Tooltip,
      mod.Legend
    )
    return mod
  })
  return chartApi
}

/** 预览区保留可悬停的 Canvas；导出时栅格化成 PNG，避免 innerHTML 丢掉像素。 */
export async function renderChartDiagram(
  host: HTMLElement,
  block: DiagramBlock,
  theme: Theme,
  signal: AbortSignal,
  rasterize: boolean
): Promise<void> {
  const parsed = parseChartConfig(block.code)
  if (!parsed.ok) throw new Error(i18n.t(`diagram.${parsed.reason}`))
  if (signal.aborted) return

  const { Chart } = await loadChart()
  if (signal.aborted) return

  const canvas = document.createElement('canvas')
  if (rasterize) {
    canvas.width = 1440
    canvas.height = parsed.config.type === 'pie' || parsed.config.type === 'radar' ? 1080 : 810
  }
  const wrap = document.createElement('div')
  wrap.className = 'biu-diagram-chart'
  wrap.append(canvas)
  host.replaceChildren(wrap)

  const chart = new Chart(canvas, chartConfiguration(parsed.config, theme, rasterize))
  if (signal.aborted) {
    chart.destroy()
    return
  }
  if (rasterize) {
    const image = document.createElement('img')
    image.src = canvas.toDataURL('image/png')
    image.alt = parsed.config.data.datasets[0]?.label ?? parsed.config.type
    chart.destroy()
    wrap.replaceChildren(image)
  } else {
    signal.addEventListener('abort', () => chart.destroy(), { once: true })
  }
  host.dataset.diagramState = 'ready'
}

function chartConfiguration(config: ChartConfig, theme: Theme, rasterize: boolean): ChartConfiguration {
  const ink = theme === 'dark' ? '#e5e7eb' : '#24292f'
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.16)' : '#d0d7de'
  const datasets = config.data.datasets.map((dataset, index) => {
    const color = PALETTE[index % PALETTE.length]!
    if (config.type === 'pie') {
      return {
        ...dataset,
        backgroundColor:
          dataset.backgroundColor ?? config.data.labels.map((_, slice) => PALETTE[slice % PALETTE.length]),
        borderColor: dataset.borderColor ?? (theme === 'dark' ? '#0f172a' : '#ffffff'),
        borderWidth: 1
      }
    }
    if (config.type === 'radar') {
      return {
        ...dataset,
        backgroundColor: dataset.backgroundColor ?? withAlpha(color, 0.25),
        borderColor: dataset.borderColor ?? color,
        pointBackgroundColor: color
      }
    }
    return {
      ...dataset,
      backgroundColor: dataset.backgroundColor ?? color,
      borderColor: dataset.borderColor ?? color
    }
  })

  return {
    type: config.type,
    data: { labels: config.data.labels, datasets },
    options: {
      responsive: !rasterize,
      animation: false,
      devicePixelRatio: rasterize ? 2 : undefined,
      plugins: { legend: { labels: { color: ink } } },
      scales: scalesFor(config.type, ink, grid)
    }
  }
}

function scalesFor(type: ChartType, ink: string, grid: string) {
  if (type === 'pie') return undefined
  const ticks = { color: ink }
  const gridOption = { color: grid }
  if (type === 'radar') {
    return { r: { ticks, grid: gridOption, angleLines: { color: grid }, pointLabels: { color: ink } } }
  }
  return {
    x: { ticks, grid: gridOption },
    y: { ticks, grid: gridOption, beginAtZero: true }
  }
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.slice(1)
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
