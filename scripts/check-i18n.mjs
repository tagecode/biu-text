import { messages } from '../src/shared/i18n/messages.ts'

function keyPaths(tree, prefix = '') {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : keyPaths(value, path)
  })
}

const languages = Object.keys(messages)
const baseline = keyPaths(messages['zh-CN']).sort()
const mismatches = []

for (const language of languages) {
  const keys = keyPaths(messages[language]).sort()
  for (const key of baseline) {
    if (!keys.includes(key)) mismatches.push(`${language} 缺少 ${key}`)
  }
  for (const key of keys) {
    if (!baseline.includes(key)) mismatches.push(`${language} 多出 ${key}`)
  }
}

if (mismatches.length > 0) {
  console.error(mismatches.join('\n'))
  process.exit(1)
}

console.log(`翻译 key 已对齐：${languages.join(', ')}（${baseline.length} 个）`)
