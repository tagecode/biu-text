/**
 * Excalidraw 手绘图的场景格式（纯函数）。
 *
 * 文档里存的是 `.excalidraw` 同构的 JSON 代码块：
 *
 * ```markdown
 * ```excalidraw
 * {"type":"excalidraw","version":2,"elements":[…],"appState":{…}}
 * ```
 * ```
 *
 * 这样文档既能被本应用渲染，也能直接拖进 excalidraw.com 或别的编辑器继续编辑。
 * 这里只做结构与尺寸层面的校验，具体渲染交给 `@excalidraw/excalidraw`。
 */

export const EXCALIDRAW_BLOCK_LANG = 'excalidraw'

/** 场景里真正需要进 Markdown 的 appState 字段：其余都是编辑器运行时状态 */
const KEPT_APP_STATE_KEYS = ['viewBackgroundColor', 'exportBackground', 'exportWithDarkMode'] as const

export interface ExcalidrawScene {
  elements: unknown[]
  appState: Record<string, unknown>
  files: Record<string, unknown> | null
}

export type ExcalidrawParseError = 'invalidJson' | 'missingElements' | 'empty'

export type ExcalidrawParseResult =
  | { ok: true; scene: ExcalidrawScene }
  | { ok: false; error: ExcalidrawParseError }

/** 把编辑器状态压缩到渲染需要的几个字段，避免把整份 appState 写进文档 */
export function compactAppState(appState: unknown): Record<string, unknown> {
  const source = (appState ?? {}) as Record<string, unknown>
  const kept: Record<string, unknown> = {}
  for (const key of KEPT_APP_STATE_KEYS) {
    const value = source[key]
    if (value !== undefined) kept[key] = value
  }
  return kept
}

export function parseExcalidrawScene(code: string): ExcalidrawParseResult {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, error: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'invalidJson' }
  }

  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'invalidJson' }
  const record = parsed as Record<string, unknown>
  if (!Array.isArray(record.elements)) return { ok: false, error: 'missingElements' }
  if (record.elements.length === 0) return { ok: false, error: 'empty' }

  const files =
    record.files && typeof record.files === 'object' && !Array.isArray(record.files)
      ? (record.files as Record<string, unknown>)
      : null

  return {
    ok: true,
    scene: {
      elements: record.elements,
      appState: compactAppState(record.appState),
      files
    }
  }
}

/** 生成写进 Markdown 的场景 JSON（不换行缩进，避免把文档撑长） */
export function serializeExcalidrawScene(scene: ExcalidrawScene): string {
  return JSON.stringify({
    type: EXCALIDRAW_BLOCK_LANG,
    version: 2,
    elements: scene.elements,
    appState: scene.appState,
    files: scene.files ?? {}
  })
}

/** 生成可直接插入文档的围栏代码块 */
export function buildExcalidrawBlock(scene: ExcalidrawScene): string {
  return ['```' + EXCALIDRAW_BLOCK_LANG, serializeExcalidrawScene(scene), '```'].join('\n')
}
