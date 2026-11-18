import { describe, expect, it } from 'vitest'
import {
  activeDocumentOf,
  createTabDocument,
  documentFileName,
  documentLabel,
  findDocumentByPath,
  isDocumentDirty,
  neighborDocumentId,
  nextDocumentId,
  normalizePath,
  patchDocument,
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

describe('neighborDocumentId', () => {
  const documents = [doc('a'), doc('b'), doc('c')]

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

describe('activeDocumentOf', () => {
  it('activeId 悬空时回退到第一个文档', () => {
    const state = { documents: [doc('a'), doc('b')], activeId: 'zzz' }
    expect(activeDocumentOf(state).id).toBe('a')
  })
})
