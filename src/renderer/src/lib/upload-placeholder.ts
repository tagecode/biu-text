/**
 * 上传占位符：`![uploading](uploading:<id>)`。
 * id 是本次上传的唯一标识，成功后整段替换为真实图片，失败时保留给用户重试。
 */
const PLACEHOLDER_PREFIX = '![uploading](uploading:'

export function placeholderMarkdown(id: string): string {
  return `${PLACEHOLDER_PREFIX}${id})`
}

export function hasPlaceholder(content: string, id: string): boolean {
  return content.includes(placeholderMarkdown(id))
}

export function replacePlaceholder(content: string, id: string, markdown: string): string {
  const token = placeholderMarkdown(id)
  return content.includes(token) ? content.split(token).join(markdown) : content
}

export function removePlaceholder(content: string, id: string): string {
  return replacePlaceholder(content, id, '')
}

export function altFromName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name
  return base.replace(/\.[^.]+$/, '') || 'image'
}

/** URL 里的空格和括号会让 Markdown 解析错位，这类地址用尖括号包起来 */
export function imageMarkdown(alt: string, url: string): string {
  const target = /[\s()<>]/.test(url) ? `<${url.replace(/[<>]/g, '')}>` : url
  return `![${alt.replace(/[[\]]/g, '')}](${target})`
}
