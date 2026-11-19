import { describe, expect, it } from 'vitest'
import {
  activeDocumentOf,
  createTabDocument,
  documentFileName,
  documentLabel,
  findDocumentByPath,
  isDocumentDirty,
  isPathWithin,
  moveDocument,
  neighborDocumentId,
  nextDocumentId,
  normalizePath,
  patchDocument,
  rebaseDocumentPaths,
  rebasePath,
  removeDocumentsUnder,
  type DocumentsState,
  type TabDocument
} from './documents'

function doc(id: string, filePath: string | null = null, content = 'x'): TabDocument {
  return createTabDocument({ id, content, filePath })
}

describe('createTabDocument', () => {
  it('把初始内容当作已保存内容，新建的文档不脏', () => {
    const document = createTabDocument({ id: 'a', content: '# hi' })
    expect(document.savedContent).toBe('# hi')
    expect(isDocumentDirty(document)).toBe(false)
    expect(document.cursor).toEqual({ line: 1, col: 1 })
  })

  it('默认是未落盘的空文档', () => {
    const document = createTabDocument({ id: 'a' })
    expect(document.filePath).toBeNull()
    expect(document.content).toBe('')
  })
})

describe('isDocumentDirty', () => {
  it('内容与 savedContent 不同才算脏', () => {
    const document = createTabDocument({ id: 'a', content: 'one' })
    expect(isDocumentDirty(document)).toBe(false)
    expect(isDocumentDirty({ ...document, content: 'one more' })).toBe(true)
  })
})

describe('nextDocumentId', () => {
  it('连续调用不重复', () => {
    const ids = new Set([nextDocumentId(), nextDocumentId(), nextDocumentId()])
    expect(ids.size).toBe(3)
  })
})

describe('path helpers', () => {
  it('取文件名时兼容反斜杠路径', () => {
    expect(documentFileName('C:\\notes\\README.md')).toBe('README.md')
    expect(documentFileName('/home/me/a.md')).toBe('a.md')
    expect(documentFileName(null)).toBeNull()
  })

  it('normalizePath 统一分隔符', () => {
    expect(normalizePath('C:\\a\\b.md')).toBe('C:/a/b.md')
  })

  it('标签名回退到本地化的未命名', () => {
    expect(documentLabel(doc('a', '/tmp/a.md'), '未命名')).toBe('a.md')
    expect(documentLabel(doc('b'), '未命名')).toBe('未命名')
  })

  it('按路径找已打开的文档，且忽略分隔符差异', () => {
    const documents = [doc('a', 'C:\\notes\\a.md'), doc('b')]
    expect(findDocumentByPath(documents, 'C:/notes/a.md')?.id).toBe('a')
    expect(findDocumentByPath(documents, 'C:/notes/missing.md')).toBeUndefined()
    // 未落盘的文档不能被路径命中
    expect(findDocumentByPath(documents, '')).toBeUndefined()
  })
})

describe('目录级路径操作', () => {
  it('isPathWithin 按分隔符边界比较，且大小写不敏感', () => {
    expect(isPathWithin('C:\\notes\\docs\\a.md', 'C:\\notes\\docs')).toBe(true)
    expect(isPathWithin('C:/notes/docs/a.md', 'C:/notes/docs/')).toBe(true)
    expect(isPathWithin('C:/NOTES/Docs/A.md', 'C:/notes/docs')).toBe(true)
    expect(isPathWithin('C:/notes/docs', 'C:/notes/docs')).toBe(true)
    // 前缀相似但不是子路径
    expect(isPathWithin('C:/notes/docs2/a.md', 'C:/notes/docs')).toBe(false)
    expect(isPathWithin('/notes/other.md', '/notes/docs')).toBe(false)
    expect(isPathWithin('/notes/docs/a.md', '')).toBe(false)
  })

  it('rebasePath 只改写位于 from 下的路径，并保留分隔符风格', () => {
    expect(rebasePath('C:\\notes\\docs\\a.md', 'C:\\notes\\docs', 'C:\\notes\\new')).toBe(
      'C:\\notes\\new\\a.md'
    )
    expect(rebasePath('/notes/docs/deep/a.md', '/notes/docs', '/notes/new')).toBe(
      '/notes/new/deep/a.md'
    )
    expect(rebasePath('/notes/docs', '/notes/docs', '/notes/new')).toBe('/notes/new')
    expect(rebasePath('/notes/docs2/a.md', '/notes/docs', '/notes/new')).toBeNull()
  })

  it('rebaseDocumentPaths 同步目录下所有打开的标签', () => {
    const state: DocumentsState = {
      documents: [
        doc('a', 'C:\\notes\\docs\\a.md'),
        doc('b', 'C:\\notes\\docs\\deep\\b.md'),
        doc('c', 'C:\\notes\\other.md'),
        doc('d')
      ],
      activeId: 'a'
    }
    const next = rebaseDocumentPaths(state, 'C:\\notes\\docs', 'C:\\notes\\new')

    expect(next.documents.map((document) => document.filePath)).toEqual([
      'C:\\notes\\new\\a.md',
      'C:\\notes\\new\\deep\\b.md',
      'C:\\notes\\other.md',
      null
    ])
    // 没有命中的标签原样复用，不触发无意义重渲染
    expect(next.documents[2]).toBe(state.documents[2])
    expect(next.documents[3]).toBe(state.documents[3])
    expect(next.activeId).toBe('a')
  })

  it('rebaseDocumentPaths 没有命中时返回同一个对象', () => {
    const state: DocumentsState = { documents: [doc('a', '/notes/a.md')], activeId: 'a' }
    expect(rebaseDocumentPaths(state, '/notes/docs', '/notes/new')).toBe(state)
  })

  it('removeDocumentsUnder 关掉目录下的所有标签，并激活右边邻居', () => {
    const state: DocumentsState = {
      documents: [
        doc('a', '/notes/docs/a.md'),
        doc('b', '/notes/docs/b.md'),
        doc('c', '/notes/other.md'),
        doc('d')
      ],
      activeId: 'b'
    }
    const next = removeDocumentsUnder(state, '/notes/docs')

    expect(next.documents.map((document) => document.id)).toEqual(['c', 'd'])
    expect(next.activeId).toBe('c')
  })

  it('目录删空时补一个空文档，不会出现零标签', () => {
    const state: DocumentsState = {
      documents: [doc('a', '/notes/docs/a.md'), doc('b', '/notes/docs/b.md')],
      activeId: 'a'
    }
    const next = removeDocumentsUnder(state, '/notes/docs')

    expect(next.documents).toHaveLength(1)
    expect(next.documents[0].content).toBe('')
    expect(next.documents[0].filePath).toBeNull()
  })

  it('removeDocumentsUnder 没有命中时返回同一个对象', () => {
    const state: DocumentsState = { documents: [doc('a', '/notes/a.md')], activeId: 'a' }
    expect(removeDocumentsUnder(state, '/notes/docs')).toBe(state)
  })
})

describe('neighborDocumentId', () => {  const documents = [doc('a'), doc('b'), doc('c')]

  it('优先取右边那个', () => {
    expect(neighborDocumentId(documents, 'a')).toBe('b')
  })

  it('最后一个取左边那个', () => {
    expect(neighborDocumentId(documents, 'c')).toBe('b')
  })

  it('关的是唯一标签时返回 null', () => {
    expect(neighborDocumentId([doc('a')], 'a')).toBeNull()
  })

  it('id 不存在时返回 null', () => {
    expect(neighborDocumentId(documents, 'zzz')).toBeNull()
  })
})

describe('patchDocument', () => {
  const state = { documents: [doc('a'), doc('b')], activeId: 'a' }

  it('只改命中 id 的那个文档', () => {
    const next = patchDocument(state, 'b', { content: 'edited' })
    expect(next.documents[0]).toBe(state.documents[0])
    expect(next.documents[1].content).toBe('edited')
  })

  it('id 不存在时返回同一个对象，避免无意义重渲染', () => {
    expect(patchDocument(state, 'zzz', { content: 'x' })).toBe(state)
  })
})

describe('moveDocument', () => {
  const documents = [doc('a'), doc('b'), doc('c')]

  it('向前移动插到目标位置之前', () => {
    expect(moveDocument(documents, 'c', 0)?.map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(moveDocument(documents, 'c', 1)?.map((item) => item.id)).toEqual(['a', 'c', 'b'])
  })

  it('向后移动按移动前的下标换算', () => {
    expect(moveDocument(documents, 'a', 2)?.map((item) => item.id)).toEqual(['b', 'a', 'c'])
    expect(moveDocument(documents, 'a', 3)?.map((item) => item.id)).toEqual(['b', 'c', 'a'])
  })

  it('拖到邻居左侧不算移动，返回 null', () => {
    expect(moveDocument(documents, 'b', 2)).toBeNull()
  })

  it('原地不动返回 null', () => {
    expect(moveDocument(documents, 'b', 1)).toBeNull()
    expect(moveDocument(documents, 'a', 0)).toBeNull()
  })

  it('越界下标夹到有效范围', () => {
    expect(moveDocument(documents, 'b', 99)?.map((item) => item.id)).toEqual(['a', 'c', 'b'])
    expect(moveDocument(documents, 'b', -5)?.map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })

  it('id 不存在时返回 null', () => {
    expect(moveDocument(documents, 'zzz', 0)).toBeNull()
  })
})

describe('activeDocumentOf', () => {
  it('activeId 悬空时回退到第一个文档', () => {
    const state = { documents: [doc('a'), doc('b')], activeId: 'zzz' }
    expect(activeDocumentOf(state).id).toBe('a')
  })
})
