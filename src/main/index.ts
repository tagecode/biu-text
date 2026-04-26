import { app, shell, BrowserWindow, ipcMain, Menu, dialog, nativeTheme } from 'electron'
import { join, basename, extname } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc-channels'

let mainWindow: BrowserWindow | null = null
let isReadyToClose = false
let recentFiles: string[] = []
const RECENT_FILES_LIMIT = 10

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
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      recentFiles = data.filter((item): item is string => typeof item === 'string').slice(0, RECENT_FILES_LIMIT)
    } else {
      recentFiles = []
    }
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
  recentFiles = [normalized, ...recentFiles.filter((item) => item !== normalized)].slice(0, RECENT_FILES_LIMIT)
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

function buildMenu(): void {
  const isMac = process.platform === 'darwin'

  if (!isMac) {
    Menu.setApplicationMenu(null)
    return
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send(IPC.MENU_NEW_FILE)
        },
        {
          label: '打开…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send(IPC.MENU_OPEN_FILE)
        },
        {
          label: '最近文件',
          submenu:
            recentFiles.length > 0
              ? recentFiles.map((path) => ({
                  label: basename(path),
                  sublabel: path,
                  click: () => mainWindow?.webContents.send(IPC.MENU_OPEN_RECENT, path)
                }))
              : [{ label: '暂无最近文件', enabled: false }]
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send(IPC.MENU_SAVE)
        },
        {
          label: '另存为…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send(IPC.MENU_SAVE_AS)
        },
        { type: 'separator' },
        {
          label: '导出 HTML…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow?.webContents.send(IPC.MENU_EXPORT_HTML)
        },
        {
          label: '导出 PDF…',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => mainWindow?.webContents.send(IPC.MENU_EXPORT_PDF)
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' as const, label: '撤销' },
        { role: 'redo' as const, label: '重做' },
        { type: 'separator' },
        { role: 'cut' as const, label: '剪切' },
        { role: 'copy' as const, label: '复制' },
        { role: 'paste' as const, label: '粘贴' },
        { role: 'selectAll' as const, label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' as const, label: '重新加载' },
        { role: 'forceReload' as const, label: '强制重新加载' },
        { type: 'separator' },
        { role: 'resetZoom' as const, label: '重置缩放' },
        { role: 'zoomIn' as const, label: '放大' },
        { role: 'zoomOut' as const, label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen' as const, label: '切换全屏' },
        ...(is.dev ? [{ role: 'toggleDevTools' as const, label: '开发者工具' }] : [])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ─── IPC Handlers ───────────────────────────────────────────────

ipcMain.handle(IPC.FILE_OPEN_DIALOG, async () => {
  if (!mainWindow) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '打开文件',
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return null
  try {
    const content = await readFile(filePaths[0], 'utf-8')
    await recordRecentFile(filePaths[0])
    return { path: filePaths[0], content }
  } catch (err) {
    dialog.showErrorBox('打开失败', String(err))
    return null
  }
})

ipcMain.handle(IPC.FILE_OPEN_PATH, async (_e, { path }: { path: string }) => {
  try {
    const content = await readFile(path, 'utf-8')
    await recordRecentFile(path)
    return { path, content }
  } catch (err) {
    dialog.showErrorBox('打开失败', String(err))
    return null
  }
})

ipcMain.handle(IPC.FILE_SAVE, async (_e, { path, content }: { path: string; content: string }) => {
  try {
    await writeFile(path, content, 'utf-8')
    await recordRecentFile(path)
    return { success: true }
  } catch (err) {
    dialog.showErrorBox('保存失败', String(err))
    return { success: false }
  }
})

ipcMain.handle(IPC.FILE_SAVE_AS, async (_e, { content }: { content: string }) => {
  if (!mainWindow) return null
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '另存为',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (canceled || !filePath) return null
  try {
    await writeFile(filePath, content, 'utf-8')
    await recordRecentFile(filePath)
    return { path: filePath }
  } catch (err) {
    dialog.showErrorBox('保存失败', String(err))
    return null
  }
})

ipcMain.handle(
  IPC.FILE_EXPORT_HTML,
  async (_e, { html, fileName }: { html: string; fileName?: string }) => {
    if (!mainWindow) return null
    const defaultName = `${getExportBaseName(fileName)}.html`
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出 HTML',
      defaultPath: defaultName,
      filters: [
        { name: 'HTML 文件', extensions: ['html'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (canceled || !filePath) return null
    try {
      await writeFile(filePath, html, 'utf-8')
      return { path: filePath }
    } catch (err) {
      dialog.showErrorBox('导出 HTML 失败', String(err))
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
      title: '导出 PDF',
      defaultPath: defaultName,
      filters: [
        { name: 'PDF 文件', extensions: ['pdf'] },
        { name: '所有文件', extensions: ['*'] }
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
      dialog.showErrorBox('导出 PDF 失败', String(err))
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
