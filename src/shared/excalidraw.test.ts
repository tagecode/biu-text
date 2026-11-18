import { describe, expect, it } from 'vitest'
import {
  buildExcalidrawBlock,
  compactAppState,
  parseExcalidrawScene,
  serializeExcalidrawScene
} from './excalidraw'

const ELEMENT = { id: 'a', type: 'rectangle', x: 0, y: 0, width: 120, height: 60 }

describe('compactAppState', () => {
  it('只保留渲染需要的字段', () => {
    const compacted = compactAppState({
      viewBackgroundColor: '#ffffff',
      exportBackground: true,
      exportWithDarkMode: false,
      scrollX: 123,
      currentItemStrokeColor: '#000',
      collaborators: new Map()
    })
    expect(compacted).toEqual({
      viewBackgroundColor: '#ffffff',
      exportBackground: true,
      exportWithDarkMode: false
    })
  })

  it('容忍空值与非对象', () => {
    expect(compactAppState(undefined)).toEqual({})
    expect(compactAppState(null)).toEqual({})
  })
})

describe('parseExcalidrawScene', () => {
  it('解析合法的场景', () => {
    const result = parseExcalidrawScene(
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [ELEMENT], appState: {} })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.scene.elements).toHaveLength(1)
    expect(result.scene.files).toBeNull()
  })

  it('空代码块报 empty', () => {
    expect(parseExcalidrawScene('   ')).toEqual({ ok: false, error: 'empty' })
  })

  it('不是 JSON 报 invalidJson', () => {
    expect(parseExcalidrawScene('{ not json')).toEqual({ ok: false, error: 'invalidJson' })
    expect(parseExcalidrawScene('42')).toEqual({ ok: false, error: 'invalidJson' })
  })

  it('缺少 elements 报 missingElements', () => {
    expect(parseExcalidrawScene('{"type":"excalidraw"}')).toEqual({
      ok: false,
      error: 'missingElements'
    })
    expect(parseExcalidrawScene('{"elements":"nope"}')).toEqual({
      ok: false,
      error: 'missingElements'
    })
  })

  it('elements 为空数组报 empty', () => {
    expect(parseExcalidrawScene('{"elements":[]}')).toEqual({ ok: false, error: 'empty' })
  })

  it('保留 files（内嵌图片）', () => {
    const result = parseExcalidrawScene(
      JSON.stringify({ elements: [ELEMENT], files: { f1: { dataURL: 'data:image/png;base64,AA' } } })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.scene.files).toMatchObject({ f1: { dataURL: expect.stringContaining('data:') } })
  })
})

describe('serialize / buildExcalidrawBlock', () => {
  it('序列化后能再解析回来，且夹带 type 与 version', () => {
    const text = serializeExcalidrawScene({ elements: [ELEMENT], appState: {}, files: null })
    expect(JSON.parse(text)).toMatchObject({ type: 'excalidraw', version: 2 })
    const parsed = parseExcalidrawScene(text)
    expect(parsed.ok).toBe(true)
  })

  it('生成可直接插入文档的围栏代码块', () => {
    const block = buildExcalidrawBlock({ elements: [ELEMENT], appState: {}, files: null })
    expect(block.startsWith('```excalidraw\n')).toBe(true)
    expect(block.endsWith('\n```')).toBe(true)
    expect(block.split('\n')).toHaveLength(3)
  })
})
