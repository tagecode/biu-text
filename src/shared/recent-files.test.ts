import { describe, expect, it } from 'vitest'
import {
  formatRecentFileTime,
  readRecentFiles,
  recentFileSublabel,
  recordRecentFileList,
  recentFileTimeParts
} from './recent-files'

describe('readRecentFiles', () => {
  it('keeps legacy path lists and stored timestamps', () => {
    expect(readRecentFiles(['/a.md', '  ', 1])).toEqual([{ path: '/a.md', openedAt: null }])
    expect(readRecentFiles([{ path: '/b.md', openedAt: 20 }, { path: '/a.md' }])).toEqual([
      { path: '/b.md', openedAt: 20 },
      { path: '/a.md', openedAt: null }
    ])
    expect(readRecentFiles(null)).toEqual([])
  })
})

describe('recordRecentFileList', () => {
  it('moves the opened file to the front and refreshes its time', () => {
    expect(
      recordRecentFileList(
        [
          { path: '/a.md', openedAt: 1 },
          { path: '/b.md', openedAt: 2 }
        ],
        '/b.md',
        9,
        10
      )
    ).toEqual([
      { path: '/b.md', openedAt: 9 },
      { path: '/a.md', openedAt: 1 }
    ])
  })
})

describe('recent file time', () => {
  const morning = new Date(2026, 0, 20, 9, 5).getTime()
  const afternoon = new Date(2026, 0, 20, 15, 45).getTime()
  const yesterday = new Date(2026, 0, 19, 9, 5).getTime()

  it('uses the clock for today and the date for older files', () => {
    expect(recentFileTimeParts(morning, afternoon)).toBe('time')
    expect(recentFileTimeParts(yesterday, afternoon)).toBe('datetime')
  })

  it('formats the sublabel in the active language', () => {
    const zh = formatRecentFileTime(yesterday, 'zh-CN', afternoon)
    const en = formatRecentFileTime(yesterday, 'en-US', afternoon)
    expect(zh).not.toBe(en)
    expect(recentFileSublabel('/a.md', null, 'zh-CN', afternoon)).toBe('/a.md')
    expect(recentFileSublabel('/a.md', yesterday, 'zh-CN', afternoon)).toBe(`${zh} · /a.md`)
  })
})
