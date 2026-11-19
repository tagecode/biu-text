import { describe, expect, it } from 'vitest'
import {
  addImageHistoryEntry,
  IMAGE_HISTORY_LIMIT,
  normalizeImageHistory,
  removeImageHistoryEntry,
  type ImageHistoryEntry
} from './image-history'

function entry(id: string, uploadedAt: number, url = `https://img.example.com/${id}.png`): ImageHistoryEntry {
  return { id, url, fileName: `${id}.png`, uploadedAt, provider: 'github' }
}

describe('normalizeImageHistory', () => {
  it('reads both a bare array and an entries wrapper', () => {
    expect(normalizeImageHistory([entry('a', 1)])).toHaveLength(1)
    expect(normalizeImageHistory({ entries: [entry('a', 1)] })).toHaveLength(1)
  })

  it('drops invalid records and keeps only http(s) URLs', () => {
    const normalized = normalizeImageHistory([
      entry('ok', 10),
      { id: 'bad', url: 'javascript:alert(1)', fileName: 'x', uploadedAt: 1 },
      { id: '', url: 'https://a.test/x.png', fileName: 'x', uploadedAt: 1 },
      { id: 'nan', url: 'https://a.test/x.png', fileName: 'x', uploadedAt: 'yesterday' },
      null
    ])

    expect(normalized.map((item) => item.id)).toEqual(['ok'])
  })

  it('sorts newest first and caps the list at the limit', () => {
    const items = Array.from({ length: 5 }, (_, index) => entry(`i${index}`, index))
    const normalized = normalizeImageHistory(items, 3)

    expect(normalized.map((item) => item.id)).toEqual(['i4', 'i3', 'i2'])
    expect(normalizeImageHistory(items).length).toBeLessThanOrEqual(IMAGE_HISTORY_LIMIT)
  })
})

describe('addImageHistoryEntry', () => {
  it('puts the newest entry first', () => {
    const next = addImageHistoryEntry([entry('old', 1)], entry('new', 2))
    expect(next.map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('replaces the same URL instead of duplicating it', () => {
    const next = addImageHistoryEntry([entry('old', 1, 'https://a.test/x.png')], entry('new', 2, 'https://a.test/x.png'))
    expect(next.map((item) => item.id)).toEqual(['new'])
  })

  it('keeps at most the limit', () => {
    let entries: ImageHistoryEntry[] = []
    for (let index = 0; index < IMAGE_HISTORY_LIMIT + 5; index += 1) {
      entries = addImageHistoryEntry(entries, entry(`i${index}`, index))
    }
    expect(entries).toHaveLength(IMAGE_HISTORY_LIMIT)
    expect(entries[0]?.id).toBe(`i${IMAGE_HISTORY_LIMIT + 4}`)
  })
})

describe('removeImageHistoryEntry', () => {
  it('removes by id and keeps the rest', () => {
    expect(removeImageHistoryEntry([entry('a', 1), entry('b', 2)], 'a').map((item) => item.id)).toEqual(['b'])
    expect(removeImageHistoryEntry([entry('a', 1)], 'missing')).toHaveLength(1)
  })
})
