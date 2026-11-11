import { describe, expect, it } from 'vitest'
import { parseChartConfig } from './chart'

const bar = `{
  "type": "bar",
  "data": {
    "labels": ["一月", "二月"],
    "datasets": [{ "label": "销售额", "data": [12, 19] }]
  }
}`

describe('parseChartConfig', () => {
  it('accepts bar, line, pie and radar configs', () => {
    for (const type of ['bar', 'line', 'pie', 'radar'] as const) {
      const parsed = parseChartConfig(bar.replace('"bar"', `"${type}"`))
      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.config.type).toBe(type)
        expect(parsed.config.data.labels).toEqual(['一月', '二月'])
        expect(parsed.config.data.datasets[0]).toMatchObject({ label: '销售额', data: [12, 19] })
      }
    }
  })

  it('keeps explicit colors and drops anything that is not a color', () => {
    const parsed = parseChartConfig(`{
      "type": "pie",
      "data": {
        "labels": ["A"],
        "datasets": [{ "data": [1], "backgroundColor": ["#111", 2], "borderColor": "#222" }]
      }
    }`)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.config.data.datasets[0]?.backgroundColor).toBeUndefined()
      expect(parsed.config.data.datasets[0]?.borderColor).toBe('#222')
    }
  })

  it('rejects invalid json, unknown types and incomplete data', () => {
    expect(parseChartConfig('{')).toEqual({ ok: false, reason: 'invalidJson' })
    expect(parseChartConfig('{"type":"scatter","data":{"labels":["A"],"datasets":[{"data":[1]}]}}')).toEqual({
      ok: false,
      reason: 'unsupportedType'
    })
    expect(parseChartConfig('{"type":"bar"}')).toEqual({ ok: false, reason: 'missingData' })
    expect(parseChartConfig('{"type":"bar","data":{"labels":[],"datasets":[{"data":[1]}]}}')).toEqual({
      ok: false,
      reason: 'missingData'
    })
    expect(parseChartConfig('{"type":"bar","data":{"labels":["A"],"datasets":[{"data":["x"]}]}}')).toEqual({
      ok: false,
      reason: 'missingData'
    })
  })
})
