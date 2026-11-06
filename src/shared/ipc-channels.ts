/** 所有 IPC channel 名称，集中管理避免字符串硬编码 */
export const IPC = {
  // 主进程 → 渲染进程（菜单触发）
  MENU_NEW_FILE: 'menu:new-file',
  MENU_OPEN_FILE: 'menu:open-file',
  MENU_OPEN_RECENT: 'menu:open-recent',
  MENU_SAVE: 'menu:save',
  MENU_SAVE_AS: 'menu:save-as',
  MENU_EXPORT_HTML: 'menu:export-html',
  MENU_EXPORT_PDF: 'menu:export-pdf',
  MENU_FIND: 'menu:find',
  MENU_REPLACE: 'menu:replace',

  // 渲染进程 → 主进程（invoke / handle）
  FILE_OPEN_DIALOG: 'file:open-dialog',
  FILE_OPEN_PATH: 'file:open-path',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  FILE_EXPORT_HTML: 'file:export-html',
  FILE_EXPORT_PDF: 'file:export-pdf',

  // 窗口关闭握手
  APP_WILL_CLOSE: 'app:will-close',
  APP_CLOSE_CONFIRMED: 'app:close-confirmed',
  APP_CLOSE_CANCELLED: 'app:close-cancelled',

  // 窗口标题
  WINDOW_SET_TITLE: 'window:set-title',

  // 当前文档路径（主进程据此限制预览图片的读取范围）
  DOCUMENT_SET_PATH: 'document:set-path',

  // 主题
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
  THEME_CHANGED: 'theme:changed',

  // 界面语言
  LANGUAGE_GET: 'language:get',
  LANGUAGE_SET: 'language:set',

  // 开机自启
  LOGIN_GET: 'login:get',
  LOGIN_SET: 'login:set'
} as const
