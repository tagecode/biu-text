export interface RecentFileRecord {
  path: string
  openedAt: number | null
}

const RECENT_FILE_LIMIT = 10

export function readRecentFiles(data: unknown): RecentFileRecord[] {
  if (!Array.isArray(data)) return []
  const files: RecentFileRecord[] = []
  for (const item of data) {
    if (typeof item === 'string') {
      const path = item.trim()
      if (path) files.push({ path, openedAt: null })
      continue
    }
    if (item && typeof item === 'object' && 'path' in item && typeof item.path === 'string') {
      const path = item.path.trim()
      if (!path) continue
      const openedAt = 'openedAt' in item && typeof item.openedAt === 'number' ? item.openedAt : null
      files.push({ path, openedAt })
    }
  }
  return files.slice(0, RECENT_FILE_LIMIT)
}

export function recordRecentFileList(
  files: RecentFileRecord[],
  path: string,
  openedAt: number,
  limit = RECENT_FILE_LIMIT
): RecentFileRecord[] {
  const normalized = path.trim()
  if (!normalized) return files.slice(0, limit)
  return [{ path: normalized, openedAt }, ...files.filter((file) => file.path !== normalized)].slice(0, limit)
}

export function recentFileTimeParts(openedAt: number, now: number): 'time' | 'datetime' {
  const opened = new Date(openedAt)
  const current = new Date(now)
  const sameDay =
    opened.getFullYear() === current.getFullYear() &&
    opened.getMonth() === current.getMonth() &&
    opened.getDate() === current.getDate()
  return sameDay ? 'time' : 'datetime'
}

export function formatRecentFileTime(openedAt: number, language: string, now: number): string {
  const options: Intl.DateTimeFormatOptions =
    recentFileTimeParts(openedAt, now) === 'time'
      ? { hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  return new Intl.DateTimeFormat(language, options).format(new Date(openedAt))
}

export function recentFileSublabel(
  path: string,
  openedAt: number | null | undefined,
  language: string,
  now: number
): string {
  if (openedAt == null) return path
  return `${formatRecentFileTime(openedAt, language, now)} · ${path}`
}
