import type { AppLanguage, MessageTree } from './types'

const zhCN = {
  menu: {
    about: '关于 {{appName}}',
    services: '服务',
    hide: '隐藏 {{appName}}',
    hideOthers: '隐藏其他',
    showAll: '全部显示',
    quit: '退出 {{appName}}',
    file: '文件',
    new: '新建',
    open: '打开…',
    recentFiles: '最近文件',
    noRecentFiles: '暂无最近文件',
    save: '保存',
    saveAs: '另存为…',
    exportHtml: '导出 HTML…',
    exportPdf: '导出 PDF…',
    close: '关闭',
    edit: '编辑',
    find: '查找',
    replace: '替换',
    undo: '撤销',
    redo: '重做',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    selectAll: '全选',
    view: '视图',
    reload: '重新加载',
    forceReload: '强制重新加载',
    resetZoom: '重置缩放',
    zoomIn: '放大',
    zoomOut: '缩小',
    toggleFullscreen: '切换全屏',
    devTools: '开发者工具'
  },
  dialog: {
    openFile: '打开文件',
    openFailed: '打开失败',
    saveFailed: '保存失败',
    saveAs: '另存为',
    exportHtml: '导出 HTML',
    exportHtmlFailed: '导出 HTML 失败',
    exportPdf: '导出 PDF',
    exportPdfFailed: '导出 PDF 失败',
    markdown: 'Markdown',
    allFiles: '所有文件',
    htmlFiles: 'HTML 文件',
    pdfFiles: 'PDF 文件',
    imageFiles: '图片',
    unsavedTitle: '有未保存的更改',
    unsavedDetail: '「{{name}}」有未保存的更改，要保存吗？',
    save: '保存',
    discard: '不保存',
    cancel: '取消'
  },
  toolbar: {
    new: '新建文件',
    open: '打开文件',
    save: '保存文件',
    exportHtml: '导出 HTML',
    exportPdf: '导出 PDF',
    hidePreview: '隐藏预览区',
    showPreview: '显示预览区',
    openSettings: '打开设置面板',
    bold: '粗体',
    italic: '斜体',
    code: '行内代码',
    link: '插入链接',
    insertImage: '插入图片',
    insertDiagram: '插入 Mermaid',
    wordSummary: '{{words}} 词 · {{chars}} 字符'
  },
  settings: {
    title: '设置',
    close: '关闭',
    closePanel: '关闭设置面板',
    language: '语言',
    themeMode: '主题模式',
    editorFont: '编辑器字体',
    previewFont: '预览字体',
    previewTheme: '预览主题',
    fontSize: '字号',
    adjustFontSize: '调整字号',
    sans: '无衬线',
    serif: '衬线',
    generalSection: '通用',
    editorSection: '编辑器',
    imageSection: '图片',
    openAtLogin: '开机自启',
    autoSave: '自动保存',
    autoSaveOff: '关闭',
    autoSave30: '30 秒',
    autoSave60: '1 分钟',
    autoSave300: '5 分钟',
    tabWidth: 'Tab 宽度',
    lineHeight: '行高',
    showLineNumbers: '显示行号'
  },
  appearance: {
    light: '亮色',
    dark: '暗色',
    system: '跟随系统'
  },
  status: {
    lineCol: '行 {{line}}, 列 {{col}}',
    words: '{{count}} 词',
    characters: '{{count}} 字符',
    lines: '{{count}} 行',
    cycleTheme: '切换主题模式',
    currentTheme: '当前: {{theme}}'
  },
  splitter: {
    resize: '拖拽调整面板宽度，双击恢复 50:50'
  },
  app: {
    untitled: '未命名',
    document: 'BiuText 文档'
  },
  editor: {
    linkText: '链接文字',
    placeholder: '开始书写…'
  },
  diagram: {
    renderFailed: '图表渲染失败'
  },
  image: {
    insert: '插入图片',
    saveFailed: '图片保存失败',
    storage: '存储方式',
    storageLocal: '本地（文档同目录 assets/）',
    storageCloudSoon: '云图床（即将支持）'
  },
  welcome: {
    document: `# 欢迎使用 BiuText

BiuText 是一款轻量级的跨平台 Markdown 编辑器，采用经典的**分栏布局**。

## 快速开始

- **左侧**为 Markdown 源码编辑区（基于 CodeMirror 6）
- **右侧**为实时渲染预览区（基于 markdown-it）
- 拖动中间**分隔条**可自由调整面板宽度

## 格式快捷键

| 操作 | 快捷键 |
|------|--------|
| 粗体 | \`Cmd/Ctrl + B\` |
| 斜体 | \`Cmd/Ctrl + I\` |
| 行内代码 | \`Cmd/Ctrl + \`\` |
| 链接 | \`Cmd/Ctrl + K\` |
| 保存 | \`Cmd/Ctrl + S\` |

## 支持的语法

**粗体**、*斜体*、~~删除线~~、\`行内代码\`

> 引用块：用于引用重要内容

\`\`\`typescript
// 代码块支持语法高亮
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

- [x] 任务列表（已完成）
- [ ] 任务列表（未完成）

---

*开始编辑此文件，或通过菜单打开一个 .md 文件*
`
  }
} satisfies MessageTree

const enUS = {
  menu: {
    about: 'About {{appName}}',
    services: 'Services',
    hide: 'Hide {{appName}}',
    hideOthers: 'Hide Others',
    showAll: 'Show All',
    quit: 'Quit {{appName}}',
    file: 'File',
    new: 'New',
    open: 'Open…',
    recentFiles: 'Recent Files',
    noRecentFiles: 'No Recent Files',
    save: 'Save',
    saveAs: 'Save As…',
    exportHtml: 'Export HTML…',
    exportPdf: 'Export PDF…',
    close: 'Close',
    edit: 'Edit',
    find: 'Find',
    replace: 'Replace',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: 'View',
    reload: 'Reload',
    forceReload: 'Force Reload',
    resetZoom: 'Reset Zoom',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    toggleFullscreen: 'Toggle Full Screen',
    devTools: 'Developer Tools'
  },
  dialog: {
    openFile: 'Open File',
    openFailed: "Couldn't Open",
    saveFailed: "Couldn't Save",
    saveAs: 'Save As',
    exportHtml: 'Export HTML',
    exportHtmlFailed: "Couldn't Export HTML",
    exportPdf: 'Export PDF',
    exportPdfFailed: "Couldn't Export PDF",
    markdown: 'Markdown',
    allFiles: 'All Files',
    htmlFiles: 'HTML Files',
    pdfFiles: 'PDF Files',
    imageFiles: 'Images',
    unsavedTitle: 'Unsaved Changes',
    unsavedDetail: '“{{name}}” has unsaved changes. Do you want to save them?',
    save: 'Save',
    discard: "Don't Save",
    cancel: 'Cancel'
  },
  toolbar: {
    new: 'New File',
    open: 'Open File',
    save: 'Save File',
    exportHtml: 'Export HTML',
    exportPdf: 'Export PDF',
    hidePreview: 'Hide Preview',
    showPreview: 'Show Preview',
    openSettings: 'Open Settings',
    bold: 'Bold',
    italic: 'Italic',
    code: 'Inline Code',
    link: 'Insert Link',
    insertImage: 'Insert Image',
    insertDiagram: 'Insert Mermaid Diagram',
    wordSummary: '{{words}} words · {{chars}} characters'
  },
  settings: {
    title: 'Settings',
    close: 'Close',
    closePanel: 'Close Settings',
    language: 'Language',
    themeMode: 'Theme',
    editorFont: 'Editor Font',
    previewFont: 'Preview Font',
    previewTheme: 'Preview Theme',
    fontSize: 'Font Size',
    adjustFontSize: 'Adjust Font Size',
    sans: 'Sans',
    serif: 'Serif',
    generalSection: 'General',
    editorSection: 'Editor',
    imageSection: 'Images',
    openAtLogin: 'Launch at login',
    autoSave: 'Auto Save',
    autoSaveOff: 'Off',
    autoSave30: '30 seconds',
    autoSave60: '1 minute',
    autoSave300: '5 minutes',
    tabWidth: 'Tab Width',
    lineHeight: 'Line Height',
    showLineNumbers: 'Show line numbers'
  },
  appearance: {
    light: 'Light',
    dark: 'Dark',
    system: 'System'
  },
  status: {
    lineCol: 'Ln {{line}}, Col {{col}}',
    words: '{{count}} words',
    characters: '{{count}} characters',
    lines: '{{count}} lines',
    cycleTheme: 'Cycle Theme',
    currentTheme: 'Current: {{theme}}'
  },
  splitter: {
    resize: 'Drag to resize the panels. Double-click to restore 50:50'
  },
  app: {
    untitled: 'Untitled',
    document: 'BiuText Document'
  },
  editor: {
    linkText: 'link text',
    placeholder: 'Start writing…'
  },
  diagram: {
    renderFailed: 'Diagram failed to render'
  },
  image: {
    insert: 'Insert Image',
    saveFailed: "Couldn't Save Image",
    storage: 'Storage',
    storageLocal: 'Local (assets/ next to the document)',
    storageCloudSoon: 'Cloud storage (coming soon)'
  },
  welcome: {
    document: `# Welcome to BiuText

BiuText is a lightweight cross-platform Markdown editor with a classic **split view**.

## Get started

- The **left** side is the Markdown source editor (CodeMirror 6)
- The **right** side is the live preview (markdown-it)
- Drag the **divider** to resize the panels

## Formatting shortcuts

| Action | Shortcut |
|------|--------|
| Bold | \`Cmd/Ctrl + B\` |
| Italic | \`Cmd/Ctrl + I\` |
| Inline code | \`Cmd/Ctrl + \`\` |
| Link | \`Cmd/Ctrl + K\` |
| Save | \`Cmd/Ctrl + S\` |

## Supported syntax

**Bold**, *italic*, ~~strikethrough~~, \`inline code\`

> Block quote for important notes

\`\`\`typescript
// Fenced code blocks are highlighted
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

- [x] Task list (done)
- [ ] Task list (open)

---

*Edit this file, or open a .md file from the menu*
`
  }
} satisfies typeof zhCN

const zhTW = {
  menu: {
    about: '關於 {{appName}}',
    services: '服務',
    hide: '隱藏 {{appName}}',
    hideOthers: '隱藏其他',
    showAll: '全部顯示',
    quit: '結束 {{appName}}',
    file: '檔案',
    new: '新增',
    open: '開啟…',
    recentFiles: '最近使用的檔案',
    noRecentFiles: '沒有最近使用的檔案',
    save: '儲存',
    saveAs: '另存新檔…',
    exportHtml: '匯出 HTML…',
    exportPdf: '匯出 PDF…',
    close: '關閉',
    edit: '編輯',
    find: '尋找',
    replace: '取代',
    undo: '復原',
    redo: '重做',
    cut: '剪下',
    copy: '複製',
    paste: '貼上',
    selectAll: '全選',
    view: '檢視',
    reload: '重新載入',
    forceReload: '強制重新載入',
    resetZoom: '重設縮放',
    zoomIn: '放大',
    zoomOut: '縮小',
    toggleFullscreen: '切換全螢幕',
    devTools: '開發者工具'
  },
  dialog: {
    openFile: '開啟檔案',
    openFailed: '開啟失敗',
    saveFailed: '儲存失敗',
    saveAs: '另存新檔',
    exportHtml: '匯出 HTML',
    exportHtmlFailed: '匯出 HTML 失敗',
    exportPdf: '匯出 PDF',
    exportPdfFailed: '匯出 PDF 失敗',
    markdown: 'Markdown',
    allFiles: '所有檔案',
    htmlFiles: 'HTML 檔案',
    pdfFiles: 'PDF 檔案',
    imageFiles: '圖片',
    unsavedTitle: '有尚未儲存的變更',
    unsavedDetail: '「{{name}}」有尚未儲存的變更，要儲存嗎？',
    save: '儲存',
    discard: '不儲存',
    cancel: '取消'
  },
  toolbar: {
    new: '新增檔案',
    open: '開啟檔案',
    save: '儲存檔案',
    exportHtml: '匯出 HTML',
    exportPdf: '匯出 PDF',
    hidePreview: '隱藏預覽區',
    showPreview: '顯示預覽區',
    openSettings: '開啟設定面板',
    bold: '粗體',
    italic: '斜體',
    code: '行內程式碼',
    link: '插入連結',
    insertImage: '插入圖片',
    insertDiagram: '插入 Mermaid',
    wordSummary: '{{words}} 個詞 · {{chars}} 個字元'
  },
  settings: {
    title: '設定',
    close: '關閉',
    closePanel: '關閉設定面板',
    language: '語言',
    themeMode: '主題模式',
    editorFont: '編輯器字型',
    previewFont: '預覽字型',
    previewTheme: '預覽主題',
    fontSize: '字級',
    adjustFontSize: '調整字級',
    sans: '無襯線',
    serif: '襯線',
    generalSection: '一般',
    editorSection: '編輯器',
    imageSection: '圖片',
    openAtLogin: '開機時啟動',
    autoSave: '自動儲存',
    autoSaveOff: '關閉',
    autoSave30: '30 秒',
    autoSave60: '1 分鐘',
    autoSave300: '5 分鐘',
    tabWidth: 'Tab 寬度',
    lineHeight: '行高',
    showLineNumbers: '顯示行號'
  },
  appearance: {
    light: '淺色',
    dark: '深色',
    system: '跟隨系統'
  },
  status: {
    lineCol: '行 {{line}}, 列 {{col}}',
    words: '{{count}} 個詞',
    characters: '{{count}} 個字元',
    lines: '{{count}} 行',
    cycleTheme: '切換主題模式',
    currentTheme: '目前: {{theme}}'
  },
  splitter: {
    resize: '拖曳調整面板寬度，按兩下還原 50:50'
  },
  app: {
    untitled: '未命名',
    document: 'BiuText 文件'
  },
  editor: {
    linkText: '連結文字',
    placeholder: '開始書寫…'
  },
  diagram: {
    renderFailed: '圖表渲染失敗'
  },
  image: {
    insert: '插入圖片',
    saveFailed: '圖片儲存失敗',
    storage: '儲存方式',
    storageLocal: '本機（文件同目錄 assets/）',
    storageCloudSoon: '雲端圖床（即將支援）'
  },
  welcome: {
    document: `# 歡迎使用 BiuText

BiuText 是一款輕量的跨平台 Markdown 編輯器，採用經典的**分欄版面**。

## 快速開始

- **左側**是 Markdown 原始碼編輯區（基於 CodeMirror 6）
- **右側**是即時預覽區（基於 markdown-it）
- 拖曳中間的**分隔條**可調整面板寬度

## 格式快速鍵

| 操作 | 快速鍵 |
|------|--------|
| 粗體 | \`Cmd/Ctrl + B\` |
| 斜體 | \`Cmd/Ctrl + I\` |
| 行內程式碼 | \`Cmd/Ctrl + \`\` |
| 連結 | \`Cmd/Ctrl + K\` |
| 儲存 | \`Cmd/Ctrl + S\` |

## 支援的語法

**粗體**、*斜體*、~~刪除線~~、\`行內程式碼\`

> 引用區塊：用來引用重要內容

\`\`\`typescript
// 程式碼區塊支援語法突顯
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

- [x] 工作清單（已完成）
- [ ] 工作清單（未完成）

---

*開始編輯此檔案，或從選單開啟一個 .md 檔案*
`
  }
} satisfies typeof zhCN

export const messages: Record<AppLanguage, MessageTree> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en-US': enUS
}
