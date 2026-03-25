# BiuText

一款跨平台桌面端 Markdown 编辑器，采用**经典分栏布局**：左侧源码编辑、右侧实时预览。

## 特性

- **分栏编辑**：CodeMirror 6 编辑区 + markdown-it 预览区，拖拽分隔条调整比例
- **实时预览**：输入防抖 80ms，编辑区与预览区滚动联动
- **文件操作**：新建 / 打开 / 保存 / 另存为（⌘N / ⌘O / ⌘S / ⌘⇧S），未保存提示与关闭确认
- **Markdown 扩展**：GFM 表格、任务列表、删除线、代码高亮（highlight.js）、数学公式（KaTeX）、脚注、Emoji、自动链接
- **快捷键**：粗体 ⌘B、斜体 ⌘I、行内代码 ⌘`、链接 ⌘K、查找 ⌘F
- **主题与外观**：亮 / 暗 / 跟随系统，编辑器字体（JetBrains Mono / Fira Code / Menlo）、预览字体与字号、GitHub / Notion 预览主题
- **状态栏**：行:列、字数 / 字符 / 行数、UTF-8

## 技术栈

Electron · Vite (electron-vite) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · CodeMirror 6 · markdown-it · DOMPurify · highlight.js · KaTeX

## 环境要求

- Node.js 18+
- npm 或 pnpm

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包（按平台）
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

国内网络可配合项目根目录 `.npmrc` 中的 Electron 镜像使用。

## 项目结构

```
src/
├── main/          # Electron 主进程（窗口、菜单、文件 IPC）
├── preload/       # 预加载脚本（暴露 fileAPI / themeAPI / windowAPI）
├── renderer/      # React 渲染进程
│   └── src/
│       ├── components/   # Editor、Preview、Toolbar、Splitter、StatusBar
│       ├── hooks/        # useFile、useTheme、useWordCount、useAppearanceSettings
│       └── lib/          # markdown 渲染、utils
└── shared/        # IPC channel 常量
```

## 文档

详细需求与实现状态见 [PRD.md](./PRD.md)。

## 许可证

[MIT](./LICENSE)
