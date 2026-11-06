import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { AppLanguage } from '../shared/i18n/types'
import type { ImageFileInput } from '../shared/image-input'

type UnsubFn = () => void

const fileAPI = {
  openDialog: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke(IPC.FILE_OPEN_DIALOG),

  openPath: (path: string): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke(IPC.FILE_OPEN_PATH, { path }),

  save: (path: string, content: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.FILE_SAVE, { path, content }),

  saveAs: (content: string): Promise<{ path: string } | null> =>
    ipcRenderer.invoke(IPC.FILE_SAVE_AS, { content }),

  exportHtml: (html: string, fileName?: string, documentPath?: string): Promise<{ path: string } | null> =>
    ipcRenderer.invoke(IPC.FILE_EXPORT_HTML, { html, fileName, documentPath }),

  exportPdf: (html: string, fileName?: string, documentPath?: string): Promise<{ path: string } | null> =>
    ipcRenderer.invoke(IPC.FILE_EXPORT_PDF, { html, fileName, documentPath }),

  onMenuNew: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_NEW_FILE, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_NEW_FILE, handler)
  },

  onMenuOpen: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_OPEN_FILE, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_OPEN_FILE, handler)
  },

  onMenuOpenRecent: (cb: (path: string) => void): UnsubFn => {
    const handler = (_: Electron.IpcRendererEvent, path: string) => cb(path)
    ipcRenderer.on(IPC.MENU_OPEN_RECENT, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_OPEN_RECENT, handler)
  },

  onMenuSave: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_SAVE, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_SAVE, handler)
  },

  onMenuSaveAs: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_SAVE_AS, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_SAVE_AS, handler)
  },

  onMenuExportHtml: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_EXPORT_HTML, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_EXPORT_HTML, handler)
  },

  onMenuExportPdf: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_EXPORT_PDF, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_EXPORT_PDF, handler)
  },

  onMenuFind: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_FIND, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_FIND, handler)
  },

  onMenuReplace: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_REPLACE, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_REPLACE, handler)
  }
}

const themeAPI = {
  get: (): Promise<'light' | 'dark'> => ipcRenderer.invoke(IPC.THEME_GET),

  set: (theme: 'light' | 'dark' | 'system'): void => {
    ipcRenderer.send(IPC.THEME_SET, theme)
  },

  onChange: (cb: (theme: 'light' | 'dark') => void): UnsubFn => {
    const handler = (_: Electron.IpcRendererEvent, theme: 'light' | 'dark') => cb(theme)
    ipcRenderer.on(IPC.THEME_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.THEME_CHANGED, handler)
  }
}

const loginAPI = {
  get: (): Promise<boolean> => ipcRenderer.invoke(IPC.LOGIN_GET),

  set: (openAtLogin: boolean): Promise<boolean> => ipcRenderer.invoke(IPC.LOGIN_SET, openAtLogin)
}

const languageAPI = {
  getSync: (): AppLanguage => ipcRenderer.sendSync(IPC.LANGUAGE_GET),

  set: (language: AppLanguage): Promise<AppLanguage> => ipcRenderer.invoke(IPC.LANGUAGE_SET, language)
}

const imageAPI = {
  setDocumentPath: (path: string | null): void => {
    ipcRenderer.send(IPC.DOCUMENT_SET_PATH, path)
  },

  saveImages: (documentPath: string, files: ImageFileInput[]): Promise<string[]> =>
    ipcRenderer.invoke(IPC.IMAGE_SAVE, { documentPath, files }),

  pickImages: (documentPath: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC.IMAGE_PICK, documentPath)
}

const windowAPI = {
  platform: process.platform,

  confirmDiscardChanges: (documentName: string): Promise<'save' | 'discard' | 'cancel'> =>
    ipcRenderer.invoke(IPC.APP_CONFIRM_DISCARD, documentName),

  setTitle: (title: string): void => {
    ipcRenderer.send(IPC.WINDOW_SET_TITLE, title)
  },

  onWillClose: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.APP_WILL_CLOSE, handler)
    return () => ipcRenderer.removeListener(IPC.APP_WILL_CLOSE, handler)
  },

  confirmClose: (): void => {
    ipcRenderer.send(IPC.APP_CLOSE_CONFIRMED)
  },

  cancelClose: (): void => {
    ipcRenderer.send(IPC.APP_CLOSE_CANCELLED)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('fileAPI', fileAPI)
    contextBridge.exposeInMainWorld('themeAPI', themeAPI)
    contextBridge.exposeInMainWorld('windowAPI', windowAPI)
    contextBridge.exposeInMainWorld('languageAPI', languageAPI)
    contextBridge.exposeInMainWorld('loginAPI', loginAPI)
    contextBridge.exposeInMainWorld('imageAPI', imageAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error preload 的 Node 类型环境没有 DOM window
  window.fileAPI = fileAPI
  // @ts-expect-error preload 的 Node 类型环境没有 DOM window
  window.themeAPI = themeAPI
  // @ts-expect-error preload 的 Node 类型环境没有 DOM window
  window.windowAPI = windowAPI
  // @ts-expect-error preload 的 Node 类型环境没有 DOM window
  window.languageAPI = languageAPI
  // @ts-expect-error preload 的 Node 类型环境没有 DOM window
  window.loginAPI = loginAPI
  // @ts-expect-error preload 的 Node 类型环境没有 DOM window
  window.imageAPI = imageAPI
}
