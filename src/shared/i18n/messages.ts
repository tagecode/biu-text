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
    unsavedClose: '文件有未保存的更改，确定要关闭吗？'
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
    settingsCurrent: '设置（当前：{{theme}}）',
    bold: '粗体',
    italic: '斜体',
    code: '行内代码',
    link: '插入链接',
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
    serif: '衬线'
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
    linkText: '链接文字'
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
    unsavedClose: 'This file has unsaved changes. Close it anyway?'
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
    settingsCurrent: 'Settings ({{theme}})',
    bold: 'Bold',
    italic: 'Italic',
    code: 'Inline Code',
    link: 'Insert Link',
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
    serif: 'Serif'
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
    linkText: 'link text'
  }
} satisfies typeof zhCN

export const messages: Record<AppLanguage, MessageTree> = {
  'zh-CN': zhCN,
  'en-US': enUS
}
