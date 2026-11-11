import { describe, expect, it } from 'vitest'
import { readEditorPreferences } from './editor-preferences'

describe('readEditorPreferences', () => {
  it('uses the current editor defaults when nothing is stored', () => {
    expect(readEditorPreferences(null)).toEqual({
      tabWidth: 2,
      lineHeight: 1.4,
      showLineNumbers: true,
      autoSaveSeconds: 0,
      inlineRender: true
    })
  })

  it('keeps supported values and drops invalid ones', () => {
    expect(
      readEditorPreferences({
        tabWidth: 4,
        lineHeight: 1.25,
        showLineNumbers: false,
        autoSaveSeconds: 60,
        inlineRender: false
      })
    ).toEqual({
      tabWidth: 4,
      lineHeight: 1.3,
      showLineNumbers: false,
      autoSaveSeconds: 60,
      inlineRender: false
    })

    expect(
      readEditorPreferences({
        tabWidth: 3,
        lineHeight: 9,
        showLineNumbers: 'yes',
        autoSaveSeconds: 15,
        inlineRender: 'yes'
      })
    ).toEqual({
      tabWidth: 2,
      lineHeight: 2,
      showLineNumbers: true,
      autoSaveSeconds: 0,
      inlineRender: true
    })
  })
})
