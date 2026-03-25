export {}

type UnsubFn = () => void

interface FileAPI {
  openDialog: () => Promise<{ path: string; content: string } | null>
  save: (path: string, content: string) => Promise<{ success: boolean }>
  saveAs: (content: string) => Promise<{ path: string } | null>
  onMenuNew: (cb: () => void) => UnsubFn
  onMenuOpen: (cb: () => void) => UnsubFn
  onMenuSave: (cb: () => void) => UnsubFn
  onMenuSaveAs: (cb: () => void) => UnsubFn
}

interface ThemeAPI {
  get: () => Promise<'light' | 'dark'>
  set: (theme: 'light' | 'dark' | 'system') => void
  onChange: (cb: (theme: 'light' | 'dark') => void) => UnsubFn
}

interface WindowAPI {
  platform: string
  setTitle: (title: string) => void
  onWillClose: (cb: () => void) => UnsubFn
  confirmClose: () => void
  cancelClose: () => void
}

declare global {
  interface Window {
    fileAPI: FileAPI
    themeAPI: ThemeAPI
    windowAPI: WindowAPI
  }
}
