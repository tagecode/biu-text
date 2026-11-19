import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { flattenEntries } from '../shared/workspace'

const trashItem = vi.fn(async () => undefined)

vi.mock('electron', () => ({
  shell: {
    trashItem: (...args: unknown[]) => trashItem(...(args as []))
  }
}))

// 注意：mock 必须在导入被测模块之前生效，所以这里用动态导入
const { readWorkspace, renameWorkspaceEntry, resolveInsideRoot, trashWorkspaceEntry } = await import(
  './workspace'
)

let root = ''

/** 成功时返回快照；失败（根目录不可读）返回 null 的用例单独断言 */
async function read(rootPath: string) {
  const snapshot = await readWorkspace(rootPath)
  if (!snapshot) throw new Error(`expected a workspace snapshot for ${rootPath}`)
  return snapshot
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'biu-ws-'))
  // docs/guide.md、docs/deep/spec.markdown、readme.md
  await mkdir(join(root, 'docs', 'deep'), { recursive: true })
  await writeFile(join(root, 'docs', 'guide.md'), '# guide', 'utf-8')
  await writeFile(join(root, 'docs', 'deep', 'spec.markdown'), '# spec', 'utf-8')
  await writeFile(join(root, 'readme.md'), '# readme', 'utf-8')
  // 应当被忽略的内容
  await writeFile(join(root, 'cover.png'), 'binary', 'utf-8')
  await writeFile(join(root, '.hidden.md'), '# hidden', 'utf-8')
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true })
  await writeFile(join(root, 'node_modules', 'pkg', 'readme.md'), '# pkg', 'utf-8')
  await mkdir(join(root, 'empty-dir'), { recursive: true })
  await mkdir(join(root, '.git'), { recursive: true })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
  trashItem.mockClear()
})

describe('readWorkspace', () => {
  it('只列出 Markdown 文件与包含它们的目录', async () => {
    const snapshot = await read(root)
    const names = flattenEntries(snapshot.entries).map((entry) => entry.name)

    expect(snapshot.root).toBe(resolve(root))
    expect(names).toContain('docs')
    expect(names).toContain('guide.md')
    expect(names).toContain('spec.markdown')
    expect(names).toContain('readme.md')
    // 非 Markdown、隐藏项、node_modules、空目录都不出现
    expect(names).not.toContain('cover.png')
    expect(names).not.toContain('.hidden.md')
    expect(names).not.toContain('node_modules')
    expect(names).not.toContain('empty-dir')
    expect(names).not.toContain('.git')
  })

  it('目录排在文件前，并记录被忽略的条目数', async () => {
    const snapshot = await read(root)
    expect(snapshot.entries[0]).toMatchObject({ name: 'docs', type: 'directory' })
    expect(snapshot.entries[1]).toMatchObject({ name: 'readme.md', type: 'file' })
    expect(snapshot.skipped).toBeGreaterThan(0)
  })

  it('路径是绝对路径，可直接用于打开文件', async () => {
    const snapshot = await read(root)
    const file = flattenEntries(snapshot.entries).find((entry) => entry.name === 'guide.md')
    expect(file?.path).toBe(join(resolve(root), 'docs', 'guide.md'))
  })

  it('目录不存在时返回 null，与「空文件夹」区分开', async () => {
    expect(await readWorkspace(join(root, 'missing'))).toBeNull()
  })

  it('根路径不是目录时返回 null', async () => {
    expect(await readWorkspace(join(root, 'readme.md'))).toBeNull()
  })
})

describe('resolveInsideRoot', () => {
  it('允许根目录内的路径', () => {
    expect(resolveInsideRoot(root, join(root, 'docs', 'guide.md'))).toBe(
      join(resolve(root), 'docs', 'guide.md')
    )
  })

  it('拒绝根目录本身与越界路径', () => {
    expect(resolveInsideRoot(root, root)).toBeNull()
    expect(resolveInsideRoot(root, join(root, '..', 'escape.md'))).toBeNull()
  })
})

describe('renameWorkspaceEntry', () => {
  it('重命名成功后返回新旧路径', async () => {
    const from = join(root, 'readme.md')
    const result = await renameWorkspaceEntry(root, from, 'READMD.md')
    expect(result.ok).toBe(true)
    expect(result.path).toBe(join(resolve(root), 'READMD.md'))
    expect(result.previousPath).toBe(join(resolve(root), 'readme.md'))
  })

  it('非法名字直接拒绝', async () => {
    for (const name of ['', 'a/b.md', '..', 'x\u0000.md']) {
      expect(await renameWorkspaceEntry(root, join(root, 'readme.md'), name), name).toMatchObject({
        ok: false,
        error: 'invalid'
      })
    }
  })

  it('目标已存在时报 exists', async () => {
    // 重命名只改名字、留在原目录，所以目标要放在同一层
    await writeFile(join(root, 'existing.md'), '# existing', 'utf-8')
    const result = await renameWorkspaceEntry(root, join(root, 'readme.md'), 'existing.md')
    expect(result).toMatchObject({ ok: false, error: 'exists' })
  })

  it('大小写重命名（readme.md → README.md）必须放行', async () => {
    // Windows / macOS 上目标"已存在"其实是同一个文件，不能误判为冲突
    const result = await renameWorkspaceEntry(root, join(root, 'readme.md'), 'README.md')
    expect(result.ok).toBe(true)
    expect(result.path).toBe(join(resolve(root), 'README.md'))
    // 内容还在：重命名没有把它覆盖成空文件
    expect(await readdir(resolve(root))).toContain('README.md')
  })

  it('越界路径拒绝执行', async () => {
    const result = await renameWorkspaceEntry(root, join(root, '..', 'escape.md'), 'x.md')
    expect(result).toMatchObject({ ok: false, error: 'outside' })
  })
})

describe('trashWorkspaceEntry', () => {
  it('调用系统的回收站接口', async () => {
    const target = join(root, 'readme.md')
    await expect(trashWorkspaceEntry(root, target)).resolves.toEqual({ ok: true })
    expect(trashItem).toHaveBeenCalledWith(join(resolve(root), 'readme.md'))
  })

  it('越界路径不调用回收站', async () => {
    await expect(trashWorkspaceEntry(root, join(root, '..', 'x.md'))).resolves.toEqual({ ok: false })
    expect(trashItem).not.toHaveBeenCalled()
  })
})
