/** 所有 IPC channel 名称，集中管理避免字符串硬编码 */
export const IPC = {
  // 主进程 → 渲染进程（菜单触发）
  MENU_NEW_FILE: 'menu:new-file',
  MENU_OPEN_FILE: 'menu:open-file',
  MENU_SAVE: 'menu:save',
  MENU_SAVE_AS: 'menu:save-as',

  // 渲染进程 → 主进程（invoke / handle）
  FILE_OPEN_DIALOG: 'file:open-dialog',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',

  // 窗口关闭握手
  APP_WILL_CLOSE: 'app:will-close',
  APP_CLOSE_CONFIRMED: 'app:close-confirmed',
  APP_CLOSE_CANCELLED: 'app:close-cancelled',

  // 窗口标题
  WINDOW_SET_TITLE: 'window:set-title',

  // 主题
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
  THEME_CHANGED: 'theme:changed',
} as const
