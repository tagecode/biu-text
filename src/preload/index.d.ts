import type { AppLanguage } from '../shared/i18n/types'
import type { ImageFileInput } from '../shared/image-input'
import type { NotificationPayload } from '../shared/notification'

export {}

type UnsubFn = () => void

interface FileAPI {
  openDialog: () => Promise<{ path: string; content: string } | null>
  openPath: (path: string) => Promise<{ path: string; content: string } | null>
  save: (path: string, content: string) => Promise<{ success: boolean }>
  saveAs: (content: string) => Promise<{ path: string } | null>
  exportHtml: (html: string, fileName?: string, documentPath?: string) => Promise<{ path: string } | null>
  exportPdf: (html: string, fileName?: string, documentPath?: string) => Promise<{ path: string } | null>
  onMenuNew: (cb: () => void) => UnsubFn
  onMenuOpen: (cb: () => void) => UnsubFn
  onMenuOpenRecent: (cb: (path: string) => void) => UnsubFn
  onMenuSave: (cb: () => void) => UnsubFn
  onMenuSaveAs: (cb: () => void) => UnsubFn
  onMenuExportHtml: (cb: () => void) => UnsubFn
  onMenuExportPdf: (cb: () => void) => UnsubFn
  onMenuFind: (cb: () => void) => UnsubFn
  onMenuReplace: (cb: () => void) => UnsubFn
}

interface ThemeAPI {
  get: () => Promise<'light' | 'dark'>
  set: (theme: 'light' | 'dark' | 'system') => void
  onChange: (cb: (theme: 'light' | 'dark') => void) => UnsubFn
}

interface WindowAPI {
  platform: string
  confirmDiscardChanges: (documentName: string) => Promise<'save' | 'discard' | 'cancel'>
  setTitle: (title: string) => void
  onWillClose: (cb: () => void) => UnsubFn
  onNotify: (cb: (payload: NotificationPayload) => void) => UnsubFn
  confirmClose: () => void
  cancelClose: () => void
}

interface LanguageAPI {
  getSync: () => AppLanguage
  set: (language: AppLanguage) => Promise<AppLanguage>
}

interface LoginAPI {
  get: () => Promise<boolean>
  set: (openAtLogin: boolean) => Promise<boolean>
}

interface ImageAPI {
  setDocumentPath: (path: string | null) => void
  saveImages: (documentPath: string, files: ImageFileInput[]) => Promise<string[]>
  pickImages: (documentPath: string) => Promise<string[]>
}

declare global {
  interface Window {
    fileAPI: FileAPI
    themeAPI: ThemeAPI
    windowAPI: WindowAPI
    languageAPI: LanguageAPI
    loginAPI: LoginAPI
    imageAPI: ImageAPI
  }
}
