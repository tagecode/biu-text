import { translate } from './translate'
import { recentFileSublabel } from '../recent-files'
import type { AppLanguage } from './types'

export interface AppMenuItem {
  label?: string
  role?: string
  type?: 'separator' | 'normal' | 'submenu' | 'checkbox' | 'radio'
  accelerator?: string
  enabled?: boolean
  sublabel?: string
  submenu?: AppMenuItem[]
  click?: () => void
}

export interface AppMenuActions {
  newFile: () => void
  openFile: () => void
  openRecent: (path: string) => void
  save: () => void
  saveAs: () => void
  exportHtml: () => void
  exportPdf: () => void
  find: () => void
  replace: () => void
}

export interface AppMenuTemplateOptions {
  language: AppLanguage
  isMac: boolean
  isDev: boolean
  appName: string
  now?: number
  recentFiles: { path: string; label: string; openedAt?: number | null }[]
  actions: AppMenuActions
}

export function createAppMenuTemplate(options: AppMenuTemplateOptions): AppMenuItem[] {
  const { language, isMac, isDev, appName, recentFiles, actions, now = Date.now() } = options
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars)

  const recentSubmenu: AppMenuItem[] =
    recentFiles.length > 0
      ? recentFiles.map((file) => ({
          label: file.label,
          sublabel: recentFileSublabel(file.path, file.openedAt, language, now),
          click: () => actions.openRecent(file.path)
        }))
      : [{ label: t('menu.noRecentFiles'), enabled: false }]

  const template: AppMenuItem[] = []

  if (isMac) {
    template.push({
      label: appName,
      submenu: [
        { role: 'about', label: t('menu.about', { appName }) },
        { type: 'separator' },
        { role: 'services', label: t('menu.services') },
        { type: 'separator' },
        { role: 'hide', label: t('menu.hide', { appName }) },
        { role: 'hideOthers', label: t('menu.hideOthers') },
        { role: 'unhide', label: t('menu.showAll') },
        { type: 'separator' },
        { role: 'quit', label: t('menu.quit', { appName }) }
      ]
    })
  }

  // 生产环境的 Windows/Linux 不提供重新加载入口，避免用户误触丢失未保存内容
  const reloadItems: AppMenuItem[] =
    isMac || isDev
      ? [
          { role: 'reload', label: t('menu.reload') },
          { role: 'forceReload', label: t('menu.forceReload') },
          { type: 'separator' }
        ]
      : []

  template.push(
    {
      label: t('menu.file'),
      submenu: [
        { label: t('menu.new'), accelerator: 'CmdOrCtrl+N', click: actions.newFile },
        { label: t('menu.open'), accelerator: 'CmdOrCtrl+O', click: actions.openFile },
        { label: t('menu.recentFiles'), submenu: recentSubmenu },
        { type: 'separator' },
        { label: t('menu.save'), accelerator: 'CmdOrCtrl+S', click: actions.save },
        { label: t('menu.saveAs'), accelerator: 'CmdOrCtrl+Shift+S', click: actions.saveAs },
        { type: 'separator' },
        { label: t('menu.exportHtml'), accelerator: 'CmdOrCtrl+Shift+E', click: actions.exportHtml },
        { label: t('menu.exportPdf'), accelerator: 'CmdOrCtrl+Shift+P', click: actions.exportPdf },
        { type: 'separator' },
        isMac ? { role: 'close', label: t('menu.close') } : { role: 'quit', label: t('menu.quit', { appName }) }
      ]
    },
    {
      label: t('menu.edit'),
      submenu: [
        { label: t('menu.find'), accelerator: 'CmdOrCtrl+F', click: actions.find },
        { label: t('menu.replace'), accelerator: 'CmdOrCtrl+H', click: actions.replace },
        { type: 'separator' },
        { role: 'undo', label: t('menu.undo') },
        { role: 'redo', label: t('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: t('menu.cut') },
        { role: 'copy', label: t('menu.copy') },
        { role: 'paste', label: t('menu.paste') },
        { role: 'selectAll', label: t('menu.selectAll') }
      ]
    },
    {
      label: t('menu.view'),
      submenu: [
        ...reloadItems,
        { role: 'resetZoom', label: t('menu.resetZoom') },
        { role: 'zoomIn', label: t('menu.zoomIn') },
        { role: 'zoomOut', label: t('menu.zoomOut') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('menu.toggleFullscreen') },
        ...(isDev ? [{ role: 'toggleDevTools', label: t('menu.devTools') }] : [])
      ]
    }
  )

  return template
}
