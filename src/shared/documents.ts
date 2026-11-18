/**
 * 多标签页的文档集合模型（纯函数）。
 *
 * 只放与运行时无关的逻辑：文档结构、脏标记、标签名、关标签后该激活谁。
 * 状态容器与 IPC 编排在 `renderer/src/hooks/useDocuments.ts`。
 */

export interface DocumentCursor {
  line: number
  col: number
}

export interface TabDocument {
  id: string
  content: string
  filePath: string | null
  /** 最近一次写盘/打开时的内容，脏标记由它与 content 派生 */
  savedContent: string
  /** 切回标签时用来恢复状态栏光标 */
  cursor: DocumentCursor
}

export interface DocumentsState {
  documents: TabDocument[]
  activeId: string
}

const DEFAULT_CURSOR: DocumentCursor = { line: 1, col: 1 }

let documentSeq = 0

/** 运行时唯一的文档 id；不落盘，只在进程内区分标签 */
export function nextDocumentId(): string {
  documentSeq += 1
  return `doc-${Date.now().toString(36)}-${documentSeq.toString(36)}`
}

export function createTabDocument(options: {
  id: string
  content?: string
  filePath?: string | null
  cursor?: DocumentCursor
}): TabDocument {
  const content = options.content ?? ''
  return {
    id: options.id,
    content,
    filePath: options.filePath ?? null,
    savedContent: content,
    cursor: options.cursor ?? { ...DEFAULT_CURSOR }
  }
}

export function isDocumentDirty(document: TabDocument): boolean {
  return document.content !== document.savedContent
}

/** 统一分隔符，便于比较 Windows 与 POSIX 路径 */
export function normalizePath(path: string): string {
  return path.replaceAll('\\', '/')
}

export function documentFileName(path: string | null): string | null {
  if (!path) return null
  return normalizePath(path).split('/').pop() || null
}

/** 标签上显示的名字：有路径取文件名，否则用本地化的「未命名」 */
export function documentLabel(document: TabDocument, untitledLabel: string): string {
  return documentFileName(document.filePath) ?? untitledLabel
}

export function findDocumentById(
  documents: readonly TabDocument[],
  id: string
): TabDocument | undefined {
  return documents.find((document) => document.id === id)
}

/** 同一个文件不重复开标签：已打开时激活既有的那个 */
export function findDocumentByPath(
  documents: readonly TabDocument[],
  path: string
): TabDocument | undefined {
  const target = normalizePath(path)
  return documents.find(
    (document) => document.filePath !== null && normalizePath(document.filePath) === target
  )
}

/**
 * 关掉 `closingId` 之后该激活谁：优先右边那个，没有就取左边；
 * 都不存在（关掉的是唯一标签）时返回 null，由调用方补一个新空文档。
 */
export function neighborDocumentId(
  documents: readonly TabDocument[],
  closingId: string
): string | null {
  const index = documents.findIndex((document) => document.id === closingId)
  if (index === -1) return null
  const rest = documents.filter((document) => document.id !== closingId)
  if (rest.length === 0) return null
  const right = documents[index + 1]
  if (right) return right.id
  const left = documents[index - 1]
  return left ? left.id : null
}

export function patchDocument(
  state: DocumentsState,
  id: string,
  patch: Partial<Omit<TabDocument, 'id'>>
): DocumentsState {
  let changed = false
  const documents = state.documents.map((document) => {
    if (document.id !== id) return document
    changed = true
    return { ...document, ...patch }
  })
  return changed ? { ...state, documents } : state
}

/** 只留下还有对应文档的激活 id，避免 id 悬空 */
export function withActiveId(state: DocumentsState, activeId: string): DocumentsState {
  if (state.activeId === activeId) return state
  return { ...state, activeId }
}

/** 当前活动文档；集合理论上永不为空，兜底取第一个 */
export function activeDocumentOf(state: DocumentsState): TabDocument {
  return findDocumentById(state.documents, state.activeId) ?? state.documents[0]
}
