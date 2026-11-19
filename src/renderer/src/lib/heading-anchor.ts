/**
 * 预览区标题锚点：给标题生成稳定 id，并支持 `[section](#heading)` 内部跳转。
 *
 * 标题 id 在每次增量渲染后按文档顺序重算：重复标题追加 `-1`、`-2`，
 * 与 GitHub 的锚点习惯一致，文档里的 `#heading` 通常能直接命中。
 */

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function ensureHeadingIds(root: ParentNode): void {
  const seen = new Map<string, number>()
  for (const heading of Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
    const text = heading.textContent?.trim() ?? ''
    const slug = slugifyHeading(text) || 'section'
    const count = seen.get(slug) ?? 0
    seen.set(slug, count + 1)
    const id = count === 0 ? slug : `${slug}-${count}`
    if (heading.id !== id) heading.id = id
  }
}

/** 在滚动容器里跳到 `#heading`；找不到目标时返回 false，交给浏览器默认行为 */
export function scrollToHeading(container: HTMLElement, hash: string): boolean {
  let id = hash.replace(/^#/, '')
  try {
    id = decodeURIComponent(id)
  } catch {
    // 保留原始值：非法百分号编码时按字面匹配
  }
  if (!id) return false
  const target = document.getElementById(id)
  if (!target || !container.contains(target)) return false

  const top =
    target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16
  container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  return true
}
