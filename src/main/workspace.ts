import { dirname, join, resolve, sep } from 'node:path'
import { readdir, rename, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { shell } from 'electron'
import {
  compareWorkspaceEntries,
  IGNORED_DIRECTORIES,
  isMarkdownFile,
  isValidFileName,
  MAX_WORKSPACE_DEPTH,
  MAX_WORKSPACE_ENTRIES,
  type WorkspaceDeleteResult,
  type WorkspaceEntry,
  type WorkspaceRenameResult,
  type WorkspaceSnapshot
} from '../shared/workspace'

/**
 * 把目录读成一棵只含 Markdown 文件的树。
 *
 * - 隐藏文件/目录、非 Markdown 文件、构建产物目录都跳过；
 * - 不含 Markdown 的目录会被剪掉（否则树里全是空文件夹）；
 * - 条目总数与递归深度都有上限，误开巨大目录时宁可少列也不要卡死界面。
 */
export async function readWorkspace(root: string): Promise<WorkspaceSnapshot> {
  const absoluteRoot = resolve(root)
  let listed = 0
  let skipped = 0

  const walk = async (directory: string, depth: number): Promise<WorkspaceEntry[]> => {
    if (depth > MAX_WORKSPACE_DEPTH) {
      skipped++
      return []
    }

    let entries: Dirent[]
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      // 权限不足等情况：这个目录当空处理，不影响其它分支
      skipped++
      return []
    }

    const collected: WorkspaceEntry[] = []
    for (const entry of entries) {
      if (listed >= MAX_WORKSPACE_ENTRIES) {
        skipped++
        continue
      }
      const name = entry.name
      if (name.startsWith('.')) {
        skipped++
        continue
      }

      const absolute = join(directory, name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(name)) {
          skipped++
          continue
        }
        const children = await walk(absolute, depth + 1)
        if (children.length === 0) {
          skipped++
          continue
        }
        listed++
        collected.push({ path: absolute, name, type: 'directory', children })
        continue
      }

      if (entry.isFile() && isMarkdownFile(name)) {
        listed++
        collected.push({ path: absolute, name, type: 'file' })
        continue
      }

      skipped++
    }

    return collected.sort(compareWorkspaceEntries)
  }

  const entries = await walk(absoluteRoot, 0)
  return { root: absoluteRoot, entries, skipped }
}

/** 目标必须落在工作区根目录之内（防止渲染进程用 ../ 越界） */
export function resolveInsideRoot(root: string, target: string): string | null {
  const absoluteRoot = resolve(root)
  const absoluteTarget = resolve(target)
  if (absoluteTarget === absoluteRoot) return null
  const prefix = absoluteRoot.endsWith(sep) ? absoluteRoot : absoluteRoot + sep
  return absoluteTarget.startsWith(prefix) ? absoluteTarget : null
}

/** 重命名（只改名字，保持在原目录内） */
export async function renameWorkspaceEntry(
  root: string,
  target: string,
  nextName: string
): Promise<WorkspaceRenameResult> {
  if (!isValidFileName(nextName)) return { ok: false, error: 'invalid' }

  const absolute = resolveInsideRoot(root, target)
  if (!absolute) return { ok: false, error: 'outside' }

  const nextPath = join(dirname(absolute), nextName)
  if (nextPath === absolute) return { ok: true, path: absolute, previousPath: absolute }

  // 目标已存在时不能覆盖。但 Windows / macOS 的文件系统大小写不敏感，
  // `readme.md → README.md` 这种只改大小写的重命名会命中"同一个文件"，
  // 必须放行，所以这里比较的是设备号 + inode 而不是路径字符串。
  const sourceStat = await stat(absolute).catch(() => null)
  const targetStat = await stat(nextPath).catch(() => null)
  if (targetStat) {
    const sameInode =
      sourceStat !== null &&
      sourceStat.dev === targetStat.dev &&
      sourceStat.ino !== 0 &&
      targetStat.ino !== 0 &&
      sourceStat.ino === targetStat.ino
    // inode 不可用时（个别文件系统返回 0）退化为路径比较，仅用于放行大小写重命名
    const caseOnlyRename =
      sourceStat !== null &&
      (sourceStat.ino === 0 || targetStat.ino === 0) &&
      nextPath.toLowerCase() === absolute.toLowerCase()
    if (!sameInode && !caseOnlyRename) return { ok: false, error: 'exists' }
  }

  try {
    await rename(absolute, nextPath)
    return { ok: true, path: nextPath, previousPath: absolute }
  } catch {
    return { ok: false, error: 'failed' }
  }
}

/**
 * 删除（移到回收站，不做不可恢复的删除）。
 * 调用方负责先弹确认框——这里只做根目录校验与落盘动作。
 */
export async function trashWorkspaceEntry(
  root: string,
  target: string
): Promise<WorkspaceDeleteResult> {
  const absolute = resolveInsideRoot(root, target)
  if (!absolute) return { ok: false }
  try {
    await shell.trashItem(absolute)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
