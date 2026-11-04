import { describe, expect, it } from 'vitest'
import { searchPhrases } from './search-phrases'

describe('searchPhrases', () => {
  it('translates the find and replace panel', () => {
    expect(searchPhrases('zh-CN')).toMatchObject({
      Find: '查找',
      Replace: '替换',
      replace: '替换',
      'replace all': '全部替换',
      'match case': '区分大小写',
      regexp: '正则',
      'by word': '全词匹配'
    })
    expect(searchPhrases('zh-TW').Find).toBe('尋找')
    expect(searchPhrases('en-US').Find).toBe('Find')
    expect(searchPhrases('zh-TW')['by word']).toBe('全詞比對')
  })
})
