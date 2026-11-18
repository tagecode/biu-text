/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import '@/i18n'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Preview } from './index'

const paragraphs = Array.from({ length: 600 }, (_, index) => `段落 ${index}`)
const content = paragraphs.join('\n\n')

let frames: FrameRequestCallback[] = []

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** 把排队的帧回调依次执行掉，直到没有新的帧 */
function flushFrames(limit = 2000): number {
  let count = 0
  while (frames.length > 0 && count < limit) {
    const callback = frames.shift()!
    act(() => {
      callback(performance.now())
    })
    count++
  }
  return count
}

function renderPreview(): HTMLElement {
  const { container } = render(
    <Preview
      content={content}
      documentPath={null}
      theme="light"
      previewTheme="github"
      previewFontFamily="sans"
      fontSize={14}
    />
  )
  return container.querySelector('article') as HTMLElement
}

describe('Preview 分帧渲染', () => {
  it('首屏只渲染一部分，后续帧补齐且不重复', () => {
    const article = renderPreview()

    const firstFrame = article.querySelectorAll('p').length
    expect(firstFrame).toBeGreaterThan(0)
    expect(firstFrame).toBeLessThan(paragraphs.length)
    expect(frames.length).toBeGreaterThan(0)

    const frameCount = flushFrames()
    expect(frameCount).toBeGreaterThan(0)
    const rendered = Array.from(article.querySelectorAll('p')).map((node) => node.textContent)
    expect(rendered).toEqual(paragraphs)
  })

  it('分帧过程中卸载不会继续写 DOM', () => {
    const article = renderPreview()
    const renderedAtUnmount = article.querySelectorAll('p').length

    cleanup()
    flushFrames()

    expect(article.querySelectorAll('p')).toHaveLength(renderedAtUnmount)
  })
})
