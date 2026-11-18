/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@/components/Editor', () => ({
  Editor: () => <div data-testid="editor" />
}))

vi.mock('@/components/Preview', () => ({
  Preview: () => <div data-testid="preview" />
}))

const unsub = (): (() => void) => () => undefined
let menuExportHtml: (() => void) | null = null

window.fileAPI = {
  openDialog: async () => null,
  openPath: async () => null,
  save: async () => ({ success: true }),
  saveAs: async () => null,
  exportHtml: vi.fn(async () => null),
  exportPdf: vi.fn(async () => null),
  onMenuNew: () => unsub(),
  onMenuOpen: () => unsub(),
  onMenuOpenRecent: () => unsub(),
  onMenuOpenFolder: () => unsub(),
  onMenuSave: () => unsub(),
  onMenuSaveAs: () => unsub(),
  onMenuExportHtml: (cb) => {
    menuExportHtml = cb
    return unsub()
  },
  onMenuExportPdf: () => unsub(),
  onMenuFind: () => unsub(),
  onMenuReplace: () => unsub()
}

window.windowAPI = {
  platform: 'win32',
  confirmDiscardChanges: async () => 'cancel',
  setTitle: () => undefined,
  onWillClose: () => unsub(),
  onNotify: () => unsub(),
  confirmClose: () => undefined,
  cancelClose: () => undefined
}

window.themeAPI = {
  get: async () => 'light',
  set: () => undefined,
  onChange: () => unsub()
}

window.loginAPI = {
  get: async () => false,
  set: async (value) => value
}

window.imageAPI = {
  setDocumentPath: () => undefined,
  saveImages: async () => [],
  pickImages: async () => [],
  pickImageInputs: async () => [],
  getHostConfig: async () => ({
    type: 'local',
    github: { repo: '', branch: 'main', dir: '', tokenMasked: '', tokenSaved: false },
    custom: { url: '', field: 'file', headers: {}, responsePath: '' }
  }),
  setHostConfig: async (view) => view,
  testHost: async () => ({ ok: true }),
  upload: async () => ({ ok: false, error: 'unused' }),
  onUploadProgress: () => unsub()
}

window.languageAPI = {
  getSync: () => 'en-US',
  set: async (language) => language
}

window.workspaceAPI = {
  openFolder: async () => null,
  load: async () => null,
  rename: async () => ({ ok: true }),
  remove: async () => ({ ok: true })
}

afterEach(() => {
  cleanup()
  menuExportHtml = null
})

describe('App export preview', () => {
  it('opens the export preview from the toolbar', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Export HTML' }))
    expect(await screen.findByRole('heading', { name: 'Export preview' })).toBeTruthy()
  })

  it('opens the export preview from the menu listener', async () => {
    render(<App />)
    menuExportHtml?.()
    expect(await screen.findByRole('heading', { name: 'Export preview' })).toBeTruthy()
  })
})

describe('App tabs', () => {
  it('adds a tab from the tab bar and closes it again', async () => {
    render(<App />)
    expect(screen.getAllByRole('tab')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    expect(screen.getAllByRole('tab')).toHaveLength(2)

    // 新标签是干净的，关闭时不会弹确认框
    fireEvent.click(screen.getAllByRole('button', { name: /^Close tab/ })[1])
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(1))
  })

  it('switches the active tab with Ctrl+1 and Ctrl+2', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    const tabs = screen.getAllByRole('tab')
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    await waitFor(() =>
      expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true')
    )

    fireEvent.keyDown(window, { key: '2', ctrlKey: true })
    await waitFor(() =>
      expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true')
    )
  })
})
