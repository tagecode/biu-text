export const CHART_TYPES = ['bar', 'line', 'pie', 'radar'] as const

export type ChartType = (typeof CHART_TYPES)[number]

export type ChartParseFailure = 'invalidJson' | 'unsupportedType' | 'missingData'

export interface ChartDataset {
  label?: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string | string[]
}

export interface ChartConfig {
  type: ChartType
  data: {
    labels: string[]
    datasets: ChartDataset[]
  }
}

const CHART_TYPE_SET = new Set<string>(CHART_TYPES)

/** 只接受 JSON 里的类型、标签和数值，避免把任意配置交给图表库。 */
export function parseChartConfig(
  source: string
): { ok: true; config: ChartConfig } | { ok: false; reason: ChartParseFailure } {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    return { ok: false, reason: 'invalidJson' }
  }
  if (!isRecord(value)) return { ok: false, reason: 'missingData' }
  if (typeof value.type !== 'string' || !CHART_TYPE_SET.has(value.type)) {
    return { ok: false, reason: 'unsupportedType' }
  }
  if (!isRecord(value.data)) return { ok: false, reason: 'missingData' }
  if (!Array.isArray(value.data.labels) || value.data.labels.length === 0) {
    return { ok: false, reason: 'missingData' }
  }
  if (!Array.isArray(value.data.datasets) || value.data.datasets.length === 0) {
    return { ok: false, reason: 'missingData' }
  }

  const datasets: ChartDataset[] = []
  for (const dataset of value.data.datasets) {
    if (!isRecord(dataset) || !Array.isArray(dataset.data)) return { ok: false, reason: 'missingData' }
    if (dataset.data.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
      return { ok: false, reason: 'missingData' }
    }
    const next: ChartDataset = { data: dataset.data }
    if (typeof dataset.label === 'string') next.label = dataset.label
    const backgroundColor = readColor(dataset.backgroundColor)
    const borderColor = readColor(dataset.borderColor)
    if (backgroundColor) next.backgroundColor = backgroundColor
    if (borderColor) next.borderColor = borderColor
    datasets.push(next)
  }

  return {
    ok: true,
    config: {
      type: value.type as ChartType,
      data: {
        labels: value.data.labels.map((label) => String(label)),
        datasets
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readColor(value: unknown): string | string[] | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim() !== '')) {
    return value
  }
  return undefined
}
