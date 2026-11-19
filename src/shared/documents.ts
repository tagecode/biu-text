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

/**
 * 路径是否等于 `parent`，或位于它下面。
 *
 * 按分隔符边界比较（`/docs` 不会命中 `/docs2`），并且大小写不敏感——
 * Windows / macOS 默认文件系统不区分大小写，目录重命名后返回的路径大小写
 * 可能与标签里保存的不完全一致。
 */
export function isPathWithin(path: string, parent: string): boolean {
  const target = normalizePath(path)
  const root = normalizePath(parent).replace(/\/+$/, '')
  if (!target || !root) return false
  const targetLower = target.toLowerCase()
  const rootLower = root.toLowerCase()
  if (targetLower === rootLower) return true
  return targetLower.startsWith(`${rootLower}/`)
}

/**
 * 把位于 `from`（文件或目录）下的路径改写到 `to` 下；不在其下返回 null。
 * 例：`from = C:\docs`、`to = C:\notes` 时，`C:\docs\a.md` → `C:\notes\a.md`。
 */
export function rebasePath(path: string, from: string, to: string): string | null {
  if (!isPathWithin(path, from)) return null
  const root = normalizePath(from).replace(/\/+$/, '')
  const rest = normalizePath(path).slice(root.length)
  const nextRoot = to.replace(/[\\/]+$/, '')
  const separator = to.includes('\\') ? '\\' : '/'
  return nextRoot + (separator === '\\' ? rest.replaceAll('/', '\\') : rest)
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

/** 文件或目录重命名后，同步所有位于它下面的标签路径 */
export function rebaseDocumentPaths(
  state: DocumentsState,
  from: string,
  to: string
): DocumentsState {
  let changed = false
  const documents = state.documents.map((document) => {
    if (document.filePath === null) return document
    const nextPath = rebasePath(document.filePath, from, to)
    if (nextPath === null || nextPath === document.filePath) return document
    changed = true
    return { ...document, filePath: nextPath }
  })
  return changed ? { ...state, documents } : state
}

/** 文件或目录被删除后，关掉所有位于它下面的标签（调用方已完成用户确认） */
export function removeDocumentsUnder(state: DocumentsState, target: string): DocumentsState {
  const removedIds = new Set(
    state.documents
      .filter((document) => document.filePath !== null && isPathWithin(document.filePath, target))
      .map((document) => document.id)
  )
  if (removedIds.size === 0) return state

  const documents = state.documents.filter((document) => !removedIds.has(document.id))
  if (documents.length === 0) {
    const fresh = createTabDocument({ id: nextDocumentId(), content: '' })
    return { documents: [fresh], activeId: fresh.id }
  }
  if (!removedIds.has(state.activeId)) return { ...state, documents }

  // 与关单个标签一致：优先激活右边邻居，其次左边
  const firstRemoved = state.documents.findIndex((document) => removedIds.has(document.id))
  const right = state.documents
    .slice(firstRemoved + 1)
    .find((document) => !removedIds.has(document.id))
  const left = state.documents
    .slice(0, firstRemoved)
    .reverse()
    .find((document) => !removedIds.has(document.id))
  return { ...state, documents, activeId: (right ?? left ?? documents[0]).id }
}

/** 当前活动文档；集合理论上永不为空，兜底取第一个 */
export function activeDocumentOf(state: DocumentsState): TabDocument {
  return findDocumentById(state.documents, state.activeId) ?? state.documents[0]
}
