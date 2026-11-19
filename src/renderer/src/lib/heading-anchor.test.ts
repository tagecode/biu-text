/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { ensureHeadingIds, scrollToHeading, slugifyHeading } from './heading-anchor'

describe('slugifyHeading', () => {
  it('lowercases, strips punctuation and joins words with dashes', () => {
    expect(slugifyHeading('Hello, World!')).toBe('hello-world')
    expect(slugifyHeading('  A   B  ')).toBe('a-b')
  })

  it('keeps unicode letters so Chinese headings work', () => {
    expect(slugifyHeading('快速开始')).toBe('快速开始')
    expect(slugifyHeading('安装 & 配置')).toBe('安装--配置'.replace(/--/g, '-'))
  })

  it('collapses repeated dashes and trims them', () => {
    expect(slugifyHeading('--a -- b--')).toBe('a-b')
  })
})

describe('ensureHeadingIds', () => {
  it('assigns stable ids and disambiguates duplicates', () => {
    const article = document.createElement('article')
    article.innerHTML = '<h1>Intro</h1><h2>Setup</h2><h2>Setup</h2><h3>使用</h3>'

    ensureHeadingIds(article)

    expect(Array.from(article.querySelectorAll('h1,h2,h3')).map((node) => node.id)).toEqual([
      'intro',
      'setup',
      'setup-1',
      '使用'
    ])
  })

  it('is idempotent across incremental renders', () => {
    const article = document.createElement('article')
    article.innerHTML = '<h2>Same</h2><h2>Same</h2>'
    ensureHeadingIds(article)
    const first = Array.from(article.querySelectorAll('h2')).map((node) => node.id)
    ensureHeadingIds(article)
    expect(Array.from(article.querySelectorAll('h2')).map((node) => node.id)).toEqual(first)
  })

  it('falls back to section for headings with only punctuation', () => {
    const article = document.createElement('article')
    article.innerHTML = '<h2>!!!</h2>'
    ensureHeadingIds(article)
    expect(article.querySelector('h2')?.id).toBe('section')
  })
})

describe('scrollToHeading', () => {
  it('scrolls the container to the target heading', () => {
    const container = document.createElement('div')
    const article = document.createElement('article')
    article.innerHTML = '<h2 id="快速开始">快速开始</h2>'
    container.append(article)
    document.body.append(container)
    container.scrollTo = vi.fn()

    const target = article.querySelector('h2')!
    target.getBoundingClientRect = () => ({ top: 300 }) as DOMRect
    container.getBoundingClientRect = () => ({ top: 100 }) as DOMRect
    container.scrollTop = 40

    expect(scrollToHeading(container, '#%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B')).toBe(true)
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 224, behavior: 'smooth' })
  })

  it('returns false for unknown or external targets', () => {
    const container = document.createElement('div')
    document.body.append(container)
    expect(scrollToHeading(container, '#missing')).toBe(false)
    expect(scrollToHeading(container, '#')).toBe(false)
  })
})
