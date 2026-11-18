import { useMemo } from 'react'

export interface WordCountResult {
  words: number
  chars: number
  lines: number
}

const CJK_MAIN_START = 0x4e00
const CJK_MAIN_END = 0x9fa5
const KANA_START = 0x3040
const KANA_END = 0x30ff
const HANGUL_START = 0xac00
const HANGUL_END = 0xd7af

const CHAR_UNDERSCORE = 95

/**
 * 中英文混合计数。
 *
 * 早期实现是「正则匹配全部中日韩字符 + replace 掉再匹配英文词」，在 5MB 文档上会
 * 分配两个巨大字符串与两个大数组。这里改成单遍字符扫描，且**口径与旧实现完全一致**：
 *
 * - 中日韩字符（汉字 / 假名 / 谚文）各算一个词；
 * - 英文按正则 `\b[a-zA-Z0-9]+\b` 的口径：连续 ASCII 字母数字算一个词，但下划线是
 *   「单词字符」——`e_f` 整体不构成一个由 \b 包裹的英文词，因此不计词。
 */
export function countWords(content: string): WordCountResult {
  if (content === '') return { words: 0, chars: 0, lines: 0 }

  let words = 0
  let lines = 1
  let runOpen = false
  let runHasUnderscore = false

  for (let index = 0; index < content.length; index++) {
    const code = content.charCodeAt(index)
    if (code === 10) lines++

    if (
      (code >= CJK_MAIN_START && code <= CJK_MAIN_END) ||
      (code >= KANA_START && code <= KANA_END) ||
      (code >= HANGUL_START && code <= HANGUL_END)
    ) {
      words++
    } else if (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      code === CHAR_UNDERSCORE
    ) {
      if (!runOpen) {
        runOpen = true
        runHasUnderscore = false
      }
      if (code === CHAR_UNDERSCORE) runHasUnderscore = true
      continue
    }

    // 非单词字符（含中日韩字符与换行）：收束当前 ASCII 词
    if (runOpen) {
      runOpen = false
      if (!runHasUnderscore) words++
    }
  }

  if (runOpen && !runHasUnderscore) words++

  return { words, chars: content.length, lines }
}

export function useWordCount(content: string): WordCountResult {
  return useMemo(() => countWords(content), [content])
}
