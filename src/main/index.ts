import { app, shell, BrowserWindow, ipcMain, Menu, dialog, nativeTheme, protocol } from 'electron'
import { join, basename, extname, dirname, isAbsolute } from 'path'
import { mkdir, readdir, readFile, writeFile, realpath } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc-channels'
import { IMAGE_SCHEME } from '../shared/image-url'
import { imageContentType, isInsideDirectory, resolveImageRequest } from './image-path'
import { imageFileName } from './image-save'
import { inlineLocalImages } from './export-image'
import type { ImageFileInput } from '../shared/image-input'
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
let imageBaseDir: string | null = null
const RECENT_FILES_LIMIT = 10

// 必须在 app ready 之前注册，预览区才能从自定义协议加载本地图片
protocol.registerSchemesAsPrivileged([
  {
    scheme: IMAGE_SCHEME,
    privileges: { standard: true, secure: true, stream: true }
  }
])

// ─── 预览图片协议 ───────────────────────────────────────────────

function registerImageProtocol(): void {
  protocol.handle(IMAGE_SCHEME, async (request) => {
    const requested = new URL(request.url).searchParams.get('path') ?? ''
    const baseDir = imageBaseDir
    const target = baseDir ? resolveImageRequest(baseDir, requested) : null
    if (!baseDir || !target) return new Response(null, { status: 403 })

    const contentType = imageContentType(target)
    if (!contentType) return new Response(null, { status: 403 })

    try {
      // realpath 兜底，防止文档目录内的软链接指向目录之外
      const [realBase, realTarget] = await Promise.all([realpath(baseDir), realpath(target)])
      if (!isInsideDirectory(realBase, realTarget)) return new Response(null, { status: 403 })
      const data = await readFile(realTarget)
      return new Response(data, { headers: { 'content-type': contentType } })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}

const IMAGE_DIALOG_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg']

/** 未保存的新文档没有目录，暂时无法插图 */
function documentDirectory(documentPath: unknown): string | null {
  return typeof documentPath === 'string' && isAbsolute(documentPath) ? dirname(documentPath) : null
}

async function saveImageAssets(documentPath: unknown, files: unknown): Promise<string[]> {
  const baseDir = documentDirectory(documentPath)
  if (!baseDir || !Array.isArray(files)) return []

  const assetsDir = join(baseDir, 'assets')
  const saved: string[] = []
  try {
    await mkdir(assetsDir, { recursive: true })
    const used = new Set(await readdir(assetsDir))
    for (const file of files as ImageFileInput[]) {
      const name = file ? imageFileName(file.name ?? '', file.mime ?? '', used) : null
      if (!name || !file.bytes) continue
      await writeFile(join(assetsDir, name), Buffer.from(file.bytes))
      used.add(name)
      saved.push(`assets/${name}`)
    }
  } catch (err) {
    dialog.showErrorBox(t('image.saveFailed'), String(err))
  }
  return saved
}

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
  const template = createAppMenuTemplate({
    language: currentLanguage,
    isMac: process.platform === 'darwin',
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

ipcMain.handle(IPC.IMAGE_SAVE, (_e, payload: { documentPath?: unknown; files?: unknown }) =>
  saveImageAssets(payload?.documentPath, payload?.files)
)

// 工具栏「插入图片」：选文件后直接由主进程读取，渲染进程拿不到任意路径
ipcMain.handle(IPC.IMAGE_PICK, async (_e, documentPath: unknown) => {
  if (!mainWindow) return []
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: t('image.insert'),
    filters: [{ name: t('dialog.imageFiles'), extensions: IMAGE_DIALOG_EXTENSIONS }],
    properties: ['openFile', 'multiSelections']
  })
  if (canceled || filePaths.length === 0) return []

  const files: ImageFileInput[] = []
  for (const filePath of filePaths) {
    try {
      const data = await readFile(filePath)
      const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      files.push({ bytes, name: basename(filePath), mime: imageContentType(filePath) ?? '' })
    } catch {
      // 单个文件读不出来不影响其余图片
    }
  }
  return saveImageAssets(documentPath, files)
})

ipcMain.handle(
  IPC.FILE_EXPORT_HTML,
  async (_e, { html, fileName, documentPath }: { html: string; fileName?: string; documentPath?: string }) => {
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
      const selfContained = await inlineLocalImages(html, documentDirectory(documentPath) ?? imageBaseDir)
      await writeFile(filePath, selfContained, 'utf-8')
      return { path: filePath }
    } catch (err) {
      dialog.showErrorBox(t('dialog.exportHtmlFailed'), String(err))
      return null
    }
  }
)

ipcMain.handle(
  IPC.FILE_EXPORT_PDF,
  async (_e, { html, fileName, documentPath }: { html: string; fileName?: string; documentPath?: string }) => {
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

    // 打印窗口加载的是 data: URL，相对图片没有基准目录，先内联成 data URI
    const printable = await inlineLocalImages(html, documentDirectory(documentPath) ?? imageBaseDir)

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
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printable)}`)
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

// 关闭窗口、新建、打开共用：脏内容先问一句，避免静默丢弃
ipcMain.handle(IPC.APP_CONFIRM_DISCARD, async (_e, documentName: unknown) => {
  const name = typeof documentName === 'string' && documentName ? documentName : ''
  const { response } = await dialog.showMessageBox(mainWindow!, {
    type: 'warning',
    buttons: [t('dialog.save'), t('dialog.discard'), t('dialog.cancel')],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    message: t('dialog.unsavedTitle'),
    detail: t('dialog.unsavedDetail', { name })
  })
  if (response === 0) return 'save'
  if (response === 1) return 'discard'
  return 'cancel'
})

ipcMain.on(IPC.WINDOW_SET_TITLE, (_e, title: string) => {
  mainWindow?.setTitle(title)
})

// 图片读取范围跟随当前文档所在目录；未保存的新文档没有目录，图片一律拒绝
ipcMain.on(IPC.DOCUMENT_SET_PATH, (_e, filePath: unknown) => {
  imageBaseDir = typeof filePath === 'string' && filePath ? dirname(filePath) : null
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
  registerImageProtocol()
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
