/**
 * 文件树（工作区）的共享类型与纯函数。
 *
 * 目录遍历在 `main/workspace.ts`（渲染进程没有 fs 权限），这里只放
 * 主进程与渲染进程都要用的判断、排序与文件名校验，方便直接单测。
 */

export interface WorkspaceEntry {
  /** 绝对路径；主进程用它做根目录校验，渲染进程直接拿去打开文件 */
  path: string
  name: string
  type: 'file' | 'directory'
  /** 仅目录有；空目录不会出现在树里 */
  children?: WorkspaceEntry[]
}

export interface WorkspaceSnapshot {
  root: string
  entries: WorkspaceEntry[]
  /** 被忽略的条目数（隐藏文件、非 Markdown、被剪掉的目录等） */
  skipped: number
}

/** 与 PRD F-02 的「打开文件」过滤器保持一致 */
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.txt'] as const

/** 这些目录一律不展开：内容量巨大且几乎不会是用户的写作目录 */
export const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'bower_components',
  'dist',
  'out',
  'build',
  'coverage',
  '.git',
  '.hg',
  '.svn',
  '.idea',
  '.vscode',
  '.next',
  '.cache'
])

/** 单个工作区最多列多少个条目，避免误开巨大目录把应用拖死 */
export const MAX_WORKSPACE_ENTRIES = 5000

/** 目录递归深度上限 */
export const MAX_WORKSPACE_DEPTH = 12

export function isMarkdownFile(name: string): boolean {
  const lower = name.toLowerCase()
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

/** 目录优先，其次按名称排序（对中文/英文都按本地化顺序） */
export function compareWorkspaceEntries(a: WorkspaceEntry, b: WorkspaceEntry): number {
  if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * 校验用户输入的文件名。只允许「文件名」，不允许任何路径成分：
 * 重命名必须留在同一个目录里，越界由这里直接挡掉。
 */
export function isValidFileName(name: string): boolean {
  if (!name) return false
  if (name.length > 120) return false
  if (name === '.' || name === '..') return false
  if (/[\\/]/.test(name)) return false
  // 控制字符与 Windows 保留字符（\u0000-\u001f 是控制字符，只能这样写）
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f<>:"|?*]/.test(name)) return false
  // Windows 不允许以点或空格结尾
  if (/[. ]$/.test(name)) return false
  return true
}

/** 把树摊平成条目列表，方便测试与查找 */
export function flattenEntries(entries: readonly WorkspaceEntry[]): WorkspaceEntry[] {
  const result: WorkspaceEntry[] = []
  const walk = (list: readonly WorkspaceEntry[]): void => {
    for (const entry of list) {
      result.push(entry)
      if (entry.children) walk(entry.children)
    }
  }
  walk(entries)
  return result
}

/** 在树里按绝对路径找条目 */
export function findEntry(
  entries: readonly WorkspaceEntry[],
  path: string
): WorkspaceEntry | undefined {
  for (const entry of entries) {
    if (entry.path === path) return entry
    if (entry.children) {
      const found = findEntry(entry.children, path)
      if (found) return found
    }
  }
  return undefined
}

export type WorkspaceRenameError = 'invalid' | 'exists' | 'outside' | 'failed'

export interface WorkspaceRenameResult {
  ok: boolean
  error?: WorkspaceRenameError
  /** 成功后的新绝对路径 */
  path?: string
  /** 重命名前的绝对路径 */
  previousPath?: string
}

export interface WorkspaceDeleteResult {
  ok: boolean
  /** 用户在原生确认框里取消 */
  canceled?: boolean
}
