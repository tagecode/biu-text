import { app, shell, BrowserWindow, ipcMain, Menu, dialog, nativeTheme } from 'electron'
import { join, basename, extname } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc-channels'
import { createAppMenuTemplate } from '../shared/i18n/menu-template'
import { readLanguagePreference } from '../shared/i18n/read-language-preference'
import { resolveLanguage } from '../shared/i18n/resolve-language'
import { translate } from '../shared/i18n/translate'
import type { AppLanguage } from '../shared/i18n/types'
import { readRecentFiles, recordRecentFileList, type RecentFileRecord } from '../shared/recent-files'

let mainWindow: BrowserWindow | null = null
let isReadyToClose = false
let recentFiles: RecentFileRecord[] = []
let currentLanguage: AppLanguage = 'en-US'
const RECENT_FILES_LIMIT = 10

function languageStorePath(): string {
  return join(app.getPath('userData'), 'language.json')
}

function t(key: string, vars?: Record<string, string | number>): string {
  return translate(currentLanguage, key, vars)
}

function recentFilesStorePath(): string {
  return join(app.getPath('userData'), 'recent-files.json')
}

function getExportBaseName(fileName?: string): string {
  if (!fileName) return 'document'
  const base = basename(fileName, extname(fileName)).trim()
  return base || 'document'
}

async function loadRecentFiles(): Promise<void> {
  try {
    const raw = await readFile(recentFilesStorePath(), 'utf-8')
    recentFiles = readRecentFiles(JSON.parse(raw))
  } catch {
    recentFiles = []
  }
}

async function persistRecentFiles(): Promise<void> {
  await writeFile(recentFilesStorePath(), JSON.stringify(recentFiles, null, 2), 'utf-8')
}

async function recordRecentFile(filePath: string): Promise<void> {
  const normalized = filePath.trim()
  if (!normalized) return
  recentFiles = recordRecentFileList(recentFiles, normalized, Date.now(), RECENT_FILES_LIMIT)
  try {
    await persistRecentFiles()
  } catch {
    // 最近文件持久化失败不影响核心读写流程
  }
  buildMenu()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: process.platform !== 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false)
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // 拦截窗口关闭，询问渲染进程是否有未保存内容
  mainWindow.on('close', (e) => {
    if (!isReadyToClose) {
      e.preventDefault()
      mainWindow!.webContents.send(IPC.APP_WILL_CLOSE)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function loadLanguage(): Promise<void> {
  let saved: string | null = null
  try {
    saved = readLanguagePreference(await readFile(languageStorePath(), 'utf-8'))
  } catch {
    saved = null
  }
  currentLanguage = resolveLanguage(saved, app.getLocale())
}

async function persistLanguage(language: AppLanguage): Promise<void> {
  await writeFile(languageStorePath(), JSON.stringify({ language }, null, 2), 'utf-8')
}

function buildMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }

  const template = createAppMenuTemplate({
    language: currentLanguage,
    isMac: true,
    isDev: is.dev,
    appName: app.name,
    recentFiles: recentFiles.map((file) => ({
      path: file.path,
      label: basename(file.path),
      openedAt: file.openedAt
    })),
    actions: {
      newFile: () => mainWindow?.webContents.send(IPC.MENU_NEW_FILE),
      openFile: () => mainWindow?.webContents.send(IPC.MENU_OPEN_FILE),
      openRecent: (path) => mainWindow?.webContents.send(IPC.MENU_OPEN_RECENT, path),
      save: () => mainWindow?.webContents.send(IPC.MENU_SAVE),
      saveAs: () => mainWindow?.webContents.send(IPC.MENU_SAVE_AS),
      exportHtml: () => mainWindow?.webContents.send(IPC.MENU_EXPORT_HTML),
      exportPdf: () => mainWindow?.webContents.send(IPC.MENU_EXPORT_PDF),
      find: () => mainWindow?.webContents.send(IPC.MENU_FIND),
      replace: () => mainWindow?.webContents.send(IPC.MENU_REPLACE)
    }
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template as Electron.MenuItemConstructorOptions[]))
}

// ─── IPC Handlers ───────────────────────────────────────────────

ipcMain.handle(IPC.FILE_OPEN_DIALOG, async () => {
  if (!mainWindow) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: t('dialog.openFile'),
    filters: [
      { name: t('dialog.markdown'), extensions: ['md', 'markdown', 'txt'] },
      { name: t('dialog.allFiles'), extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return null
  try {
    const content = await readFile(filePaths[0], 'utf-8')
    await recordRecentFile(filePaths[0])
    return { path: filePaths[0], content }
  } catch (err) {
    dialog.showErrorBox(t('dialog.openFailed'), String(err))
    return null
  }
})

ipcMain.handle(IPC.FILE_OPEN_PATH, async (_e, { path }: { path: string }) => {
  try {
    const content = await readFile(path, 'utf-8')
    await recordRecentFile(path)
    return { path, content }
  } catch (err) {
    dialog.showErrorBox(t('dialog.openFailed'), String(err))
    return null
  }
})

ipcMain.handle(IPC.FILE_SAVE, async (_e, { path, content }: { path: string; content: string }) => {
  try {
    await writeFile(path, content, 'utf-8')
    await recordRecentFile(path)
    return { success: true }
  } catch (err) {
    dialog.showErrorBox(t('dialog.saveFailed'), String(err))
    return { success: false }
  }
})

ipcMain.handle(IPC.FILE_SAVE_AS, async (_e, { content }: { content: string }) => {
  if (!mainWindow) return null
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: t('dialog.saveAs'),
    filters: [
      { name: t('dialog.markdown'), extensions: ['md'] },
      { name: t('dialog.allFiles'), extensions: ['*'] }
    ]
  })
  if (canceled || !filePath) return null
  try {
    await writeFile(filePath, content, 'utf-8')
    await recordRecentFile(filePath)
    return { path: filePath }
  } catch (err) {
    dialog.showErrorBox(t('dialog.saveFailed'), String(err))
    return null
  }
})

ipcMain.handle(
  IPC.FILE_EXPORT_HTML,
  async (_e, { html, fileName }: { html: string; fileName?: string }) => {
    if (!mainWindow) return null
    const defaultName = `${getExportBaseName(fileName)}.html`
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: t('dialog.exportHtml'),
      defaultPath: defaultName,
      filters: [
        { name: t('dialog.htmlFiles'), extensions: ['html'] },
        { name: t('dialog.allFiles'), extensions: ['*'] }
      ]
    })
    if (canceled || !filePath) return null
    try {
      await writeFile(filePath, html, 'utf-8')
      return { path: filePath }
    } catch (err) {
      dialog.showErrorBox(t('dialog.exportHtmlFailed'), String(err))
      return null
    }
  }
)

ipcMain.handle(
  IPC.FILE_EXPORT_PDF,
  async (_e, { html, fileName }: { html: string; fileName?: string }) => {
    if (!mainWindow) return null
    const defaultName = `${getExportBaseName(fileName)}.pdf`
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: t('dialog.exportPdf'),
      defaultPath: defaultName,
      filters: [
        { name: t('dialog.pdfFiles'), extensions: ['pdf'] },
        { name: t('dialog.allFiles'), extensions: ['*'] }
      ]
    })
    if (canceled || !filePath) return null

    let pdfWindow: BrowserWindow | null = null
    try {
      pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false
        }
      })
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdfData = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true
      })
      await writeFile(filePath, pdfData)
      return { path: filePath }
    } catch (err) {
      dialog.showErrorBox(t('dialog.exportPdfFailed'), String(err))
      return null
    } finally {
      pdfWindow?.destroy()
    }
  }
)

ipcMain.on(IPC.APP_CLOSE_CONFIRMED, () => {
  isReadyToClose = true
  mainWindow?.close()
})

ipcMain.on(IPC.APP_CLOSE_CANCELLED, () => {
  isReadyToClose = false
})

ipcMain.on(IPC.WINDOW_SET_TITLE, (_e, title: string) => {
  mainWindow?.setTitle(title)
})

ipcMain.handle(IPC.THEME_GET, () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
})

ipcMain.on(IPC.THEME_SET, (_e, theme: 'light' | 'dark' | 'system') => {
  nativeTheme.themeSource = theme === 'system' ? 'system' : theme
})

ipcMain.on(IPC.LANGUAGE_GET, (event) => {
  event.returnValue = currentLanguage
})

ipcMain.handle(IPC.LOGIN_GET, () => {
  try {
    return app.getLoginItemSettings().openAtLogin
  } catch {
    return false
  }
})

ipcMain.handle(IPC.LOGIN_SET, (_e, openAtLogin: unknown) => {
  const enabled = openAtLogin === true
  try {
    app.setLoginItemSettings({ openAtLogin: enabled })
    return app.getLoginItemSettings().openAtLogin
  } catch {
    return false
  }
})

ipcMain.handle(IPC.LANGUAGE_SET, async (_e, language: unknown) => {
  const next = resolveLanguage(typeof language === 'string' ? language : null, currentLanguage)
  currentLanguage = next
  try {
    await persistLanguage(next)
  } catch {
    // 语言偏好写入失败时仍保持本次会话的选择
  }
  buildMenu()
  return next
})

// ─── App Lifecycle ───────────────────────────────────────────────

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.biu-text')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send(
      IPC.THEME_CHANGED,
      nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    )
  })

  await loadLanguage()
  await loadRecentFiles()
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
