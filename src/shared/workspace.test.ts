import { describe, expect, it } from 'vitest'
import {
  compareWorkspaceEntries,
  findEntry,
  flattenEntries,
  isMarkdownFile,
  isValidFileName,
  type WorkspaceEntry
} from './workspace'

function entry(
  name: string,
  type: 'file' | 'directory',
  children?: WorkspaceEntry[]
): WorkspaceEntry {
  return { name, path: `/root/${name}`, type, children }
}

describe('isMarkdownFile', () => {
  it('只认 Markdown 与纯文本扩展名', () => {
    for (const name of ['a.md', 'b.MARKDOWN', 'c.txt', 'd.mdown', 'e.mkd']) {
      expect(isMarkdownFile(name), name).toBe(true)
    }
    for (const name of ['a.png', 'b.md.bak', 'c', 'd.html', 'e.docx']) {
      expect(isMarkdownFile(name), name).toBe(false)
    }
  })
})

describe('isValidFileName', () => {
  it('接受普通文件名', () => {
    expect(isValidFileName('笔记.md')).toBe(true)
    expect(isValidFileName('README.markdown')).toBe(true)
    expect(isValidFileName('2026-11-18 draft.txt')).toBe(true)
  })

  it('拒绝空名、路径分隔符与越界写法', () => {
    expect(isValidFileName('')).toBe(false)
    expect(isValidFileName('   ')).toBe(false)
    expect(isValidFileName('..')).toBe(false)
    expect(isValidFileName('.')).toBe(false)
    expect(isValidFileName('a/b.md')).toBe(false)
    expect(isValidFileName('a\\b.md')).toBe(false)
    expect(isValidFileName('../escape.md')).toBe(false)
  })

  it('拒绝 Windows 保留字符与结尾的点/空格', () => {
    expect(isValidFileName('a:b.md')).toBe(false)
    expect(isValidFileName('a*b.md')).toBe(false)
    expect(isValidFileName('a?b.md')).toBe(false)
    expect(isValidFileName('a|b.md')).toBe(false)
    expect(isValidFileName('a\u0000b.md')).toBe(false)
    expect(isValidFileName('name.md.')).toBe(false)
    expect(isValidFileName('name.md ')).toBe(false)
  })

  it('拒绝过长的名字', () => {
    expect(isValidFileName(`${'a'.repeat(121)}.md`)).toBe(false)
    expect(isValidFileName(`${'a'.repeat(100)}.md`)).toBe(true)
  })
})

describe('compareWorkspaceEntries', () => {
  it('目录排在文件前面', () => {
    const files = [entry('a.md', 'file'), entry('z-dir', 'directory')]
    expect(files.sort(compareWorkspaceEntries).map((item) => item.name)).toEqual(['z-dir', 'a.md'])
  })

  it('同类按名称排序，且数字按数值大小', () => {
    const files = [entry('10.md', 'file'), entry('2.md', 'file'), entry('a.md', 'file')]
    expect(files.sort(compareWorkspaceEntries).map((item) => item.name)).toEqual([
      '2.md',
      '10.md',
      'a.md'
    ])
  })
})

describe('flattenEntries / findEntry', () => {
  const tree: WorkspaceEntry[] = [
    entry('docs', 'directory', [
      entry('guide.md', 'file'),
      entry('deep', 'directory', [entry('x.md', 'file')])
    ]),
    entry('readme.md', 'file')
  ]

  it('摊平后包含所有层级', () => {
    const names = flattenEntries(tree).map((item) => item.name)
    expect(names).toEqual(['docs', 'guide.md', 'deep', 'x.md', 'readme.md'])
  })

  it('按路径查找', () => {
    expect(findEntry(tree, '/root/readme.md')?.name).toBe('readme.md')
    expect(findEntry(tree, '/root/deep/x.md')).toBeUndefined()
    expect(
      findEntry(tree, '/root/docs')?.children?.map((item) => item.name)
    ).toEqual(['guide.md', 'deep'])
  })
})
