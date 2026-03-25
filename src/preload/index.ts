import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'

type UnsubFn = () => void

const fileAPI = {
  openDialog: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke(IPC.FILE_OPEN_DIALOG),

  save: (path: string, content: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.FILE_SAVE, { path, content }),

  saveAs: (content: string): Promise<{ path: string } | null> =>
    ipcRenderer.invoke(IPC.FILE_SAVE_AS, { content }),

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

  onMenuSave: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_SAVE, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_SAVE, handler)
  },

  onMenuSaveAs: (cb: () => void): UnsubFn => {
    const handler = () => cb()
    ipcRenderer.on(IPC.MENU_SAVE_AS, handler)
    return () => ipcRenderer.removeListener(IPC.MENU_SAVE_AS, handler)
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

const windowAPI = {
  platform: process.platform,

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
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.fileAPI = fileAPI
  // @ts-ignore
  window.themeAPI = themeAPI
  // @ts-ignore
  window.windowAPI = windowAPI
}
