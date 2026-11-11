# BiuText 技术架构文档

> **文档版本**：v1.0
> **对应代码版本**：v0.6.0（`package.json`）
> **日期**：2026-11-11
> **状态**：现行架构说明 + v0.6–v1.1 演进设计
> **关联文档**：[产品需求文档（PRD）](./PRD.md)

---

## 1. 文档说明

### 1.1 目的

本文描述 BiuText 的**实际**技术架构：进程模型、模块边界、数据流、关键子系统、持久化与安全模型，以及未来版本（图表、图床、内联渲染、多标签页）需要在现有架构上落地的扩展点。

读者对象：参与本项目的开发、测试与设计人员。

### 1.2 事实来源与维护约定

- **以代码为唯一事实来源**。本文所有"现状"描述均对应 v0.3.1 的实际代码；与 PRD 冲突时以代码为准，并回写 PRD。
- 标注 `规划` 的内容为设计意图，尚未落地。
- 文件路径均相对于仓库根目录。
- 代码量为约 3.9k 行（`src/` 下 `.ts/.tsx`），单体应用规模，架构以**简洁、可测、可渐进扩展**为主，不引入超出需要的抽象。

### 1.3 术语

| 术语 | 含义 |
|------|------|
| 主进程 | Electron main process，负责窗口、菜单、文件系统、系统集成 |
| 渲染进程 | Electron renderer process，运行 React 应用 |
| 预加载 | preload script，通过 `contextBridge` 暴露受限 API |
| 共享层 | `src/shared/`，被主进程与渲染进程共同引用的**纯函数/常量**模块 |
| 防抖渲染 | 输入停止 80ms 后才执行 Markdown 渲染 |
| 脏标记 | 当前内容与最近一次保存内容不一致（`isDirty`） |

---

## 2. 架构总览

### 2.1 系统定位

BiuText 是一款 Electron 桌面端 Markdown 编辑器，采用**左源码 / 右预览**的分栏形态。当前定位为"轻量、离线优先、键盘友好"；演进方向为 Typora 风格内联渲染 + PicGo 风格图片管理 + 图表渲染。

### 2.2 设计原则

| 原则 | 落地方式 |
|------|----------|
| **进程隔离，最小暴露面** | 渲染进程无 Node 权限；所有文件/系统能力经 IPC 由主进程执行 |
| **纯逻辑与 UI 分离** | 可测试逻辑（语言解析、偏好归一化、最近文件、搜索文案）放在 `src/shared/`，不依赖 Electron/DOM |
| **单一数据源** | 三语文案集中在 `messages.ts`；IPC 名称集中在 `ipc-channels.ts` |
| **失败可降级** | 本地存储读取/写入失败不影响核心编辑与保存流程（多处 `try/catch` 静默降级） |
| **渐进扩展** | 新能力（图床、图表）以注册表 + 接口方式接入，不改动核心编辑器 |
| **无过度抽象** | 不引入 Redux/Zustand 等全局状态库，也不引入路由；状态由 hooks 与局部 state 承担 |

### 2.3 进程模型

```text
┌──────────────────────────────────────────────────────────────────────┐
│                            Electron 主进程                            │
│  src/main/index.ts                                                    │
│  ┌────────────────┬─────────────────┬──────────────┬───────────────┐ │
│  │ 窗口生命周期    │ 原生菜单(全平台) │ 文件 I/O      │ 系统集成       │ │
│  │ BrowserWindow  │ menu-template   │ fs/promises  │ nativeTheme   │ │
│  │ 关闭握手        │ 最近文件子菜单   │ 对话框         │ loginItem     │ │
│  └────────────────┴─────────────────┴──────────────┴───────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ 持久化：%userData%/language.json、recent-files.json           │    │
│  └──────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ IPC（invoke/handle、send/on、sendSync）
┌───────────────────────────────┴──────────────────────────────────────┐
│                       预加载 src/preload/index.ts                     │
│  contextBridge 暴露 6 个门面：fileAPI / themeAPI / windowAPI          │
│                       languageAPI / loginAPI / imageAPI               │
│  类型声明：src/preload/index.d.ts                                     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ 受限 API（无直接 fs / ipcRenderer）
┌───────────────────────────────┴──────────────────────────────────────┐
│                       渲染进程 src/renderer/src                       │
│  React 19（StrictMode）                                               │
│  ┌──────────┬──────────┬──────────────┬────────────────────────────┐ │
│  │ Toolbar  │ Editor   │ Preview      │ StatusBar / SettingsPanel  │ │
│  │          │ CodeMirror│ markdown-it + DOMPurify │                │ │
│  └──────────┴──────────┴──────────────┴────────────────────────────┘ │
│  hooks：useFile / useTheme / useAppearanceSettings / useLoginItem /   │
│         useWordCount / useDebounce / useAppLanguage                   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│              共享层 src/shared/（主/渲染进程共同引用）                  │
│  ipc-channels.ts   i18n/*   recent-files.ts                            │
│  editor-preferences.ts   search-phrases.ts                             │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.4 分层视图

| 层 | 位置 | 允许依赖 | 禁止依赖 |
|----|------|----------|----------|
| 主进程 | `src/main/` | Electron、Node、`src/shared/` | React、DOM、`src/renderer/` |
| 预加载 | `src/preload/` | Electron（contextBridge/ipcRenderer）、`src/shared/` | React、业务逻辑 |
| 渲染进程 | `src/renderer/src/` | React、CodeMirror、markdown-it、`src/shared/` | Node 内置模块、直接 `fs` |
| 共享层 | `src/shared/` | 仅标准 JS（无 Electron/DOM 依赖） | 任何进程专有 API |

该边界由两套 tsconfig 强制保障（见 §15.2）：Node 侧不加载 DOM lib，Web 侧不含 main 源码。

---

## 3. 技术栈与版本

### 3.1 运行时与框架

| 类别 | 选型 | 版本约束 | 说明 |
|------|------|----------|------|
| 桌面运行时 | Electron | `^36.9.5` | 主/渲染进程分离 |
| 构建 | electron-vite | `^3.1.0` | 三进程统一构建与 HMR |
| 前端框架 | React | `^19.2.0` | 函数组件 + StrictMode |
| 类型系统 | TypeScript | `~5.9.3` | 双 tsconfig，`strict: true` |
| 样式 | Tailwind CSS | `^4.1.6` | `@tailwindcss/vite`，无 `tailwind.config` |
| 组件库 | shadcn/ui（Radix UI） | Radix 多个 `^1.x/^2.x` | `components/ui` 现有 11 个组件；渲染层不再使用原生 `select` / `checkbox` / `range` / `title` 提示 |
| 图标 | lucide-react | `^0.511.0` | 工具栏、状态栏 |
| 编辑器 | CodeMirror 6（`@uiw/react-codemirror`） | `^4.25.8` | Markdown 语言包 + one-dark |
| Markdown | markdown-it | `^14.1.1` | 扩展插件见 §8.2 |
| 代码高亮 | highlight.js | `^11.11.1` | `highlight` 回调 |
| 图表 | mermaid | `^12.3.0` | 懒加载独立 chunk（约 1.1MB），仅首次遇到图表时拉取；见 §8.8 |
| 数学公式 | KaTeX（@traptitech 插件） | `^0.16.38` / `^3.6.0` | `$...$`、`$$...$$` |
| 消毒 | DOMPurify | `^3.3.2` | 预览与导出共用的信任边界 |
| 预览样式 | github-markdown-css | `^5.9.0` | 预置 GitHub 主题，Notion 为主题覆盖 |
| 国际化 | i18next + react-i18next | `^26.7.1` / `^17.1.12` | 渲染进程；主进程另用纯函数（§11） |
| 测试 | Vitest | `^5.1.0` | 只覆盖纯逻辑：`shared/`、`main/` 纯函数、`renderer/src/lib/` 纯模块 |
| 打包 | electron-builder | `^26.8.1` | dmg / nsis / AppImage / deb |

### 3.2 规划依赖（尚未引入）

| 能力 | 依赖 | 目标版本 | 引入时点 |
|------|------|----------|----------|
| 数据图表 | `chart.js` + `react-chartjs-2` | `^4` | v1.0 |
| Graphviz | `@viz-js/viz` | `^3` | v1.0 |
| 手绘图 | `@excalidraw/excalidraw` | — | v1.1 |
| 配置存储 | `electron-store` | — | v0.5（图床配置） |

> 注：当前仅 `@radix-ui/react-label`、`@radix-ui/react-slot`、`@radix-ui/react-separator` 被实际引用；`react-dialog`、`react-dropdown-menu`、`react-scroll-area`、`react-toast`、`react-tooltip` 已安装但尚未使用。

---

## 4. 进程与通信

### 4.1 主进程职责

`src/main/index.ts` 是唯一的主进程入口，承担：

1. **窗口生命周期**：创建主窗口（1280×800，最小 800×600，`ready-to-show` 后显示；macOS 使用 `hiddenInset` 标题栏）。
2. **原生菜单**：全平台构建应用菜单（Windows/Linux 用 `autoHideMenuBar` 收起）；菜单文案与最近文件由共享层 `createAppMenuTemplate()` 生成。
3. **文件系统**：打开/保存/另存为/导出 HTML/导出 PDF，全部使用 `fs/promises`。
4. **系统集成**：`nativeTheme`（主题）、`app.getLoginItemSettings/setLoginItemSettings`（开机自启）、`shell.openExternal`（外部链接）。
5. **持久化**：语言偏好与最近文件列表写入 `app.getPath('userData')`。
6. **进程内状态**：`mainWindow`、`isReadyToClose`、`recentFiles`、`currentLanguage`。
7. **轻量通知**：`notify(level, title, description)` 经 `APP_NOTIFY` 推给渲染进程的 Toast（§6.6）；打开/保存失败与未保存确认仍用系统对话框。

#### 启动序列

```text
app.whenReady()
  ├─ electronApp.setAppUserModelId('com.biu-text')
  ├─ app.on('browser-window-created') → optimizer.watchWindowShortcuts
  ├─ nativeTheme.on('updated') → 推送 IPC.THEME_CHANGED
  ├─ loadLanguage()      // 读 language.json → resolveLanguage(saved, app.getLocale())
  ├─ loadRecentFiles()   // 读 recent-files.json → readRecentFiles()
  ├─ buildMenu()         // 全平台 setApplicationMenu（Win/Linux 菜单栏自动隐藏）
  └─ createWindow()      // BrowserWindow + 关闭拦截 + setWindowOpenHandler
app.on('activate')       // macOS 无窗口时重建
app.on('window-all-closed') // 非 macOS 退出
```

### 4.2 预加载与 API 门面

`src/preload/index.ts` 通过 `contextBridge.exposeInMainWorld` 暴露 **6 个命名空间**，渲染进程只能看到这些方法，无法直接访问 `ipcRenderer`：

| 门面 | 方法 | 通道模式 |
|------|------|----------|
| `fileAPI` | `openDialog` / `openPath` / `save` / `saveAs` / `exportHtml` / `exportPdf` | `invoke` |
| `fileAPI` | `onMenuNew/Open/OpenRecent/Save/SaveAs/ExportHtml/ExportPdf/Find/Replace` | 主→渲染 `on`，返回退订函数 |
| `themeAPI` | `get` / `set` / `onChange` | `invoke` / `send` / 主→渲染 |
| `windowAPI` | `platform` / `confirmDiscardChanges` / `setTitle` / `onWillClose` / `onNotify` / `confirmClose` / `cancelClose` | 属性 / `invoke` / `send` / 主→渲染 |
| `languageAPI` | `getSync` / `set` | `sendSync` / `invoke` |
| `loginAPI` | `get` / `set` | `invoke` |
| `imageAPI` | `setDocumentPath` / `saveImages` / `pickImages` / `pickImageInputs` | `send` / `invoke` / `invoke` / `invoke` |
| `imageAPI` | `getHostConfig` / `setHostConfig` / `testHost` / `upload` | `invoke` |
| `imageAPI` | `onUploadProgress` | 主→渲染 `on`，返回退订函数 |

类型契约维护在 `src/preload/index.d.ts`，通过 `declare global { interface Window { ... } }` 供渲染进程使用，并由 `tsconfig.web.json` 的 `include` 纳入类型检查。

> 设计取舍：每个事件订阅都返回 `UnsubFn`，React `useEffect` 清理时显式退订，避免监听器泄漏。

### 4.3 渲染进程

单页应用，无路由。入口 `main.tsx` 依次导入 `./i18n`（同步初始化 i18next）与 `./index.css`，然后 `createRoot(...).render(<StrictMode><App /></StrictMode>)`。

### 4.4 IPC 通道清单

所有通道名集中在 `src/shared/ipc-channels.ts` 的 `IPC` 常量对象中，禁止字符串硬编码。

| 分组 | 通道 | 方向 | 模式 |
|------|------|------|------|
| 菜单触发 | `MENU_NEW_FILE`、`MENU_OPEN_FILE`、`MENU_OPEN_RECENT`、`MENU_SAVE`、`MENU_SAVE_AS`、`MENU_EXPORT_HTML`、`MENU_EXPORT_PDF`、`MENU_FIND`、`MENU_REPLACE` | 主 → 渲染 | `webContents.send` |
| 文件 | `FILE_OPEN_DIALOG`、`FILE_OPEN_PATH`、`FILE_SAVE`、`FILE_SAVE_AS`、`FILE_EXPORT_HTML`、`FILE_EXPORT_PDF` | 渲染 → 主 | `invoke/handle` |
| 关闭握手 | `APP_WILL_CLOSE`、`APP_CLOSE_CONFIRMED`、`APP_CLOSE_CANCELLED` | 双向 | `send`/`on` |
| 未保存确认 | `APP_CONFIRM_DISCARD` | 渲染 → 主 | `invoke/handle` |
| 窗口 | `WINDOW_SET_TITLE` | 渲染 → 主 | `send` |
| 轻量通知 | `APP_NOTIFY` | 主 → 渲染 | `webContents.send` |
| 图片目录 | `DOCUMENT_SET_PATH` | 渲染 → 主 | `send` |
| 图片写入 | `IMAGE_SAVE`、`IMAGE_PICK`、`IMAGE_PICK_INPUT` | 渲染 → 主 | `invoke/handle` |
| 云图床 | `IMAGE_HOST_GET`、`IMAGE_HOST_SET`、`IMAGE_HOST_TEST`、`IMAGE_UPLOAD` | 渲染 → 主 | `invoke/handle` |
| 上传进度 | `IMAGE_UPLOAD_PROGRESS` | 主 → 渲染 | `webContents.send` |
| 主题 | `THEME_GET`、`THEME_SET`、`THEME_CHANGED` | 双向 | `invoke` / `send` / `send` |
| 语言 | `LANGUAGE_GET`、`LANGUAGE_SET` | 渲染 → 主 | `sendSync` / `invoke` |
| 开机自启 | `LOGIN_GET`、`LOGIN_SET` | 渲染 → 主 | `invoke` |

`biu-image://` 不是 IPC 通道，而是主进程注册的自定义协议，见 §8.5。

### 4.5 关键时序

#### 4.5.1 打开文件

```text
渲染 useFile.openFile()
  └─ fileAPI.openDialog()                    [invoke FILE_OPEN_DIALOG]
       主进程 dialog.showOpenDialog(过滤器: md/markdown/txt, 所有文件)
       └─ readFile(utf-8)
       └─ recordRecentFile(path) → 写 recent-files.json → buildMenu()
       └─ 返回 { path, content }
  └─ applyOpenedFile(): setContent / setFilePath / setSavedContent
  └─ 标题更新：windowAPI.setTitle + document.title
```

#### 4.5.2 保存与自动保存

- `saveFile()`：无路径 → 走 `saveAs`；有路径 → `FILE_SAVE` 覆盖写，成功后更新 `savedContent`，脏标记自动清除。
- `autoSave()`：由 `App` 中的 `setInterval` 按 `autoSaveSeconds` 触发；**仅在有路径且内容脏时写入**，无路径的新文档不会被自动保存。
- 两者读取状态时使用 `stateRef`（而非闭包变量），确保定时器与 IPC 回调拿到最新值。

#### 4.5.3 关闭握手（防丢稿）

```text
用户关闭窗口
  └─ main: BrowserWindow 'close' 事件
       if (!isReadyToClose) { e.preventDefault(); send(APP_WILL_CLOSE) }
渲染 windowAPI.onWillClose → confirmLeaveCurrentDocument()
  └─ 不脏 → confirmClose() → 主进程 isReadyToClose = true → close() → 正常退出
  └─ 脏   → invoke APP_CONFIRM_DISCARD(文件名)
              └─ main: dialog.showMessageBox({ 保存 / 不保存 / 取消 })
                   ├─ 保存   → 渲染进程执行 saveFile()（无路径则先另存为）
                   │            ├─ 写盘成功 → confirmClose()
                   │            └─ 用户取消另存为 → cancelClose()（文档原样保留）
                   ├─ 不保存 → confirmClose()
                   └─ 取消   → cancelClose() → isReadyToClose = false
```

同一个 `confirmLeaveCurrentDocument()` 也被**新建**与**打开**（含最近文件）复用：脏内容时先弹同一个三态对话框，选"取消"或"另存为"被取消都直接中止操作，不再静默覆盖内存中的草稿（§17 R10/R12）。

#### 4.5.4 主题同步

```text
渲染 useTheme.setThemeMode(mode)
  ├─ themeAPI.set(mode) → 主进程 nativeTheme.themeSource = mode
  └─ 若 mode === 'system' → themeAPI.get() 取当前 shouldUseDarkColors
系统主题变化 → 主进程 nativeTheme 'updated' → THEME_CHANGED → 渲染仅在 system 模式下更新
```

---

## 5. 目录结构与模块职责

```text
biu-text/
├── electron.vite.config.ts        # main/preload/renderer 三端构建配置
├── .github/workflows/ci.yml       # 质量门禁（lint/typecheck/test/i18n/build），push 与 PR 触发
├── .github/workflows/release.yml  # 打 tag 自动构建与发布（先过 ci.yml 的 quality job）
├── scripts/check-i18n.mjs         # 三语 key 对齐校验
├── resources/                     # 应用图标（icns/ico/png）
├── build/                         # 打包中间产物
├── out/                           # electron-vite 构建输出
├── src/
│   ├── main/index.ts              # 主进程全部实现（约 490 行）
│   ├── main/image-path.ts         # 预览图片的路径解析与目录白名单
│   ├── main/image-save.ts         # 图片落盘：MIME/扩展名白名单、文件名清洗、重名递增
│   ├── main/export-image.ts       # 导出前把相对图片内联成 data URI
│   ├── main/image-host-store.ts   # 图床配置读写（image-host.json），token 走 safeStorage
│   ├── main/http-upload.ts        # 分块写入 + 背压的上传客户端（进度回调、超时）
│   ├── main/image-host-providers.ts # GitHub Contents / 自定义 multipart 上传与连接测试
│   ├── preload/
│   │   ├── index.ts               # contextBridge 门面
│   │   └── index.d.ts             # window.* 全局类型声明
│   ├── shared/
│   │   ├── ipc-channels.ts        # IPC 常量
│   │   ├── image-url.ts           # 相对路径 → biu-image:// 改写 + DOMPurify URI 白名单
│   │   ├── image-input.ts         # 渲染 → 主传递图片字节的类型契约
│   │   ├── image-host.ts          # 图床配置类型、脱敏、header 文本互转、序列化、HTTPS 校验
│   │   ├── notification.ts        # 主 → 渲染的轻量通知载荷类型（level/title/description）
│   │   ├── diagram.ts             # 图表块结构 + 缓存键
│   │   ├── editor-preferences.ts  # Tab/行高/行号/自动保存的归一化
│   │   ├── recent-files.ts        # 最近文件解析、去重、时间格式化
│   │   ├── search-phrases.ts      # CodeMirror 查找面板文案
│   │   └── i18n/
│   │       ├── types.ts           # AppLanguage / MessageTree / 语言名称
│   │       ├── messages.ts        # 三语全量文案（含欢迎文档）
│   │       ├── translate.ts       # 主进程用纯函数翻译 + 插值 + 回退
│   │       ├── resolve-language.ts# 偏好 / 系统语言 → AppLanguage
│   │       ├── read-language-preference.ts
│   │       ├── menu-template.ts   # 跨平台菜单模板（角色、快捷键、最近文件）
│   │       └── format-shortcut.ts # ⌘ / Ctrl 展示格式化
│   └── renderer/
│       ├── index.html             # 含 CSP meta
│       └── src/
│           ├── main.tsx           # 入口
│           ├── App.tsx            # 组合根：布局、状态装配、菜单事件路由
│           ├── i18n.ts            # i18next 初始化（同步）
│           ├── index.css          # Tailwind + 主题变量 + 预览主题样式
│           ├── components/
│           │   ├── Editor/        # CodeMirror 封装
│           │   ├── Preview/       # 渲染 + 消毒 + 链接处理
│           │   ├── Toolbar/       # 文件/导出/格式化/设置
│           │   ├── Splitter/      # Pointer Events 拖拽分隔条
│           │   ├── StatusBar/     # 光标、字数、编码、语言、字号、主题
│           │   ├── SettingsPanel/ # 设置弹层（外观/编辑器/图床；ImageHostSettings 为图床子表单）
│           │   ├── Toaster.tsx    # 右上角 Toast 列表（读 toast-store，支持动作按钮）
│           │   ├── UploadIndicator.tsx # 右下角上传进度卡（读 upload-store）
│           │   └── ui/            # shadcn 基础组件
│           ├── hooks/
│           │   ├── useFile.ts           # 文档状态与文件操作
│           │   ├── useTheme.ts          # 主题模式
│           │   ├── useAppearanceSettings.ts # 外观与编辑器偏好
│           │   ├── useAppLanguage.ts    # i18next 语言切换
│           │   ├── useLoginItem.ts      # 开机自启
│           │   ├── useWordCount.ts      # 中英分计
│           │   ├── useToast.ts          # useSyncExternalStore 订阅 toast-store
│           │   ├── useNotifications.ts  # 订阅 windowAPI.onNotify 并入队 Toast
│           │   ├── useImageHost.ts      # 图床配置加载与保存
│           │   ├── useImageUpload.ts    # 占位符上传编排、进度订阅、失败重试
│           │   ├── useUploads.ts        # useSyncExternalStore 订阅 upload-store
│           │   └── useDebounce.ts       # 通用防抖
│           ├── lib/
│           │   ├── markdown.ts          # markdown-it 单例与插件（含 mermaid 占位 fence 规则）
│           │   ├── diagram-hydrate.ts   # 图表异步水合：懒加载、串行队列、缓存、降级
│           │   ├── export-document.ts   # 独立 HTML 导出模板（导出前同步水合图表）
│           │   ├── image-insert.ts      # 在光标处插入 ![](assets/…)
│           │   ├── block-insert.ts      # 块级内容的插入位置计算（图片、Mermaid 围栏共用）
│           │   ├── search-panel.ts      # 打开替换面板并聚焦
│           │   ├── toast-store.ts       # 模块级 Toast 队列：3 秒、最多 3 条，可带动作
│           │   ├── upload-placeholder.ts# 上传占位符的插入/替换/移除与 Markdown 生成
│           │   ├── upload-store.ts      # 模块级上传进度表（按 uploadId）
│           │   └── utils.ts             # cn() 等
│           └── types/vendor.d.ts
└── tsconfig.json / tsconfig.node.json / tsconfig.web.json
```

**职责边界说明**

- `App.tsx` 是唯一组合根：装配 hooks、持有布局状态（分隔条比例、预览显隐、设置面板、光标）、路由主进程菜单事件到对应动作。
- 组件保持"展示 + 回调"形态，不直接调用 IPC（`StatusBar`/`SettingsPanel` 通过 props 接收动作）。
- `src/shared/` 内的模块必须保持纯函数，便于 Vitest 直接测试。

---

## 6. 渲染进程架构

### 6.1 组件树

```text
App
├── Toolbar                 // 新建/打开/保存/导出/格式化/预览开关/设置
├── flex 容器
│   ├── Editor (CodeMirror) // 宽度 = leftPercent 或 100%
│   ├── Splitter            // 仅预览可见时渲染
│   └── Preview (ref)       // 宽度 = 100 - leftPercent
├── StatusBar               // 行:列 · 词/字符/行 · UTF-8 · 语言 · 字号 · 预览主题 · 主题模式
└── SettingsPanel           // 条件挂载（open === false 时返回 null）
```

### 6.2 状态归属

| 状态 | 归属 | 持久化 | 说明 |
|------|------|--------|------|
| `content` / `filePath` / `savedContent` | `useFile` | 否（文件本身） | `isDirty = content !== savedContent` |
| 主题模式 | `useTheme` | `localStorage: biu-text:theme-mode` | 同时写入主进程 `nativeTheme` |
| 外观与编辑器偏好 | `useAppearanceSettings` | `localStorage: biu-text:appearance` | 字体、字号、预览主题、Tab、行高、行号、自动保存间隔 |
| 开机自启 | `useLoginItem` | OS 登录项 | 经 IPC |
| 界面语言 | i18next + `useAppLanguage` | `userData/language.json` | 主进程为权威源 |
| 布局比例 | `App` | `localStorage: biu-text:splitter-left-pct` | 20%–80% 夹取，默认 50% |
| 预览显隐 | `App` | `localStorage: biu-text:preview-visible` | 默认显示 |
| 光标行列 | `App` | 否 | 由 CodeMirror `onUpdate` 推送 |
| 字数统计 | `useWordCount` | 否 | `useMemo` 派生 |
| Toast 队列 | `lib/toast-store.ts`（模块级） | 否 | 主进程经 `APP_NOTIFY` 推送，3 秒自动消失 |

> 没有全局 store。跨组件共享的状态上提到 `App`，其余封装在各自的 hook 内；主进程权威状态（语言、主题源、最近文件）通过 IPC 同步。

### 6.3 数据流

```text
CodeMirror onChange
  └─ useFile.setContent → App 重渲染
       ├─ Preview: useDebounce(content, 80) → renderMarkdown → DOMPurify → dangerouslySetInnerHTML
       ├─ useWordCount: useMemo 重算
       ├─ StatusBar: 展示新统计
       └─ 标题：isDirty 变化 → windowAPI.setTitle + document.title
```

### 6.4 Hooks 清单

| Hook | 职责 | 外部依赖 |
|------|------|----------|
| `useFile` | 文档状态机、新建/打开/保存/另存、自动保存、导出、菜单事件、关闭确认、标题 | `window.fileAPI`、`window.windowAPI`、i18next |
| `useTheme` | `light/dark/system` 解析与同步；循环切换 | `window.themeAPI` |
| `useAppearanceSettings` | 外观状态读写与归一化 | `localStorage`、`editor-preferences.ts` |
| `useAppLanguage` | `language` / `setLanguage`，同步主进程 | i18next、`window.languageAPI` |
| `useLoginItem` | 读取/设置登录项，失败回退 | `window.loginAPI` |
| `useWordCount` | 中文字符逐字计数 + 英文按词计数 + 行数 | 无 |
| `useToast` | 用 `useSyncExternalStore` 订阅 Toast 队列 | `lib/toast-store.ts` |
| `useNotifications` | 订阅 `windowAPI.onNotify`，把主进程通知入队 | `window.windowAPI` |
| `useDebounce` | 通用值防抖 | 无 |

### 6.5 样式与主题

- **Tailwind v4** 通过 Vite 插件接入，`index.css` 只写 `@import "tailwindcss"` 与主题变量，不使用 `tailwind.config.js`。
- 设计令牌以 **CSS 变量（oklch）** 定义在 `:root` 与 `.dark`，经 `@theme inline` 映射为 Tailwind 颜色工具类（`bg-background`、`text-foreground` 等）。
- 深色模式通过 `document.documentElement.classList.add('dark')` 切换（`useTheme.applyTheme`），与 shadcn 约定一致。
- 预览区独立主题层：`.preview-surface-light/dark` 控制底色与代码块配色；`.preview-theme-github/notion` 控制排版；`.preview-font-sans/serif` 控制字体。三者以类名组合叠加在 Preview 容器上。
- 编辑器字体/字号/行高通过 CSS 自定义属性（`--editor-font-family`、`--editor-font-size`、`--editor-line-height`）注入，由 `index.css` 的 `.cm-editor` 规则消费。

### 6.6 轻量通知（Toast）

**分工**：反馈强度按「是否需要用户决策」分两层。

| 场景 | 形态 | 原因 |
|------|------|------|
| 打开失败、保存失败、未保存确认 | `dialog.showErrorBox` / `dialog.showMessageBox` | 可能丢数据，需要用户看清并决策 |
| 图片保存失败、导出 HTML/PDF 成功或失败 | 右上角 Toast | 结果性反馈，无需打断 |

**链路**：

```text
主进程 notify(level, title, description?)
  └─ mainWindow.webContents.send(IPC.APP_NOTIFY, payload)
       └─ preload windowAPI.onNotify(cb) → ipcRenderer.on('app:notify')
            └─ useNotifications（App 根部注册一次）→ toast-store.toast(payload)
                 └─ useState 之外的模块级队列 + useSyncExternalStore → <Toaster /> 重渲染
```

**实现要点**

- `src/shared/notification.ts` 定义 `NotificationLevel = 'info' | 'success' | 'error'` 与载荷类型，主进程与渲染进程共用。
- `src/renderer/src/lib/toast-store.ts` 是模块级队列（不引入全局状态库）：`toast()` 追加并 `slice(-3)` 丢最旧，`dismissToast()` 关闭，`getToasts()` 快照引用稳定以满足 `useSyncExternalStore` 的相等性要求；`TOAST_DURATION = 3000` 对应 PRD 5.1。
- `components/ui/toast.tsx` 包一层 Radix Toast（Arch R14 登记的已安装依赖），`toastVariants` 用 `cva` 区分 info / success / error 三档边框；`components/Toaster.tsx` 负责图标、标题、描述与关闭按钮，并按 level 取 lucide 图标。
- 文案统一走 i18n（`notify.exported`、`notify.close`，以及复用既有的 `image.saveFailed`、`dialog.exportHtmlFailed`、`dialog.exportPdfFailed`），主进程负责拼出最终文案。
- `Toaster` 挂在 `App` 的 `TooltipProvider` 内、布局容器末尾；viewport 定位 `fixed top-12 right-3 z-[60]`，避开工具栏。
- **动作按钮**（v0.5）：`ToastInput.action = { label, onClick }`，`Toaster` 渲染 `ToastAction`（Radix `altText` 取同一 label）。上传失败用它承载「重试」，并把该条 Toast 的时长放宽到 8 秒（`RETRY_TOAST_DURATION`）。

---

## 7. 编辑器子系统（CodeMirror 6）

### 7.1 扩展装配

`src/renderer/src/components/Editor/index.tsx` 每次渲染按当前偏好重建扩展数组：

```ts
const extensions = [
  markdown({ base: markdownLanguage }),   // Markdown 语法树 + 默认 keymap（列表/引用续写）
  EditorView.lineWrapping,
  indentUnit.of(' '.repeat(tabWidth)),
  placeholder(i18n.t('editor.placeholder')),
  EditorState.phrases.of(searchPhrases(language)),
  search({ top: true }),                  // 查找/替换，含正则、大小写、全词
  Prec.highest(keymap.of([
    { key: 'Mod-f', run: openSearchPanel },
    { key: 'Mod-h', run: openReplacePanel },
    { key: 'Mod-b', run: wrap('**') },
    { key: 'Mod-i', run: wrap('*') },
    { key: 'Mod-`', run: wrap('`') },
    { key: 'Mod-k', run: insertLink }
  ]))
]
```

### 7.2 basicSetup 覆盖

| 选项 | 值 | 说明 |
|------|----|------|
| `lineNumbers` | `showLineNumbers` | 设置面板开关 |
| `foldGutter` | `false` | 关闭折叠栏 |
| `highlightActiveLine` | `true` | 当前行高亮 |
| `bracketMatching` | `true` | 括号匹配 |
| `autocompletion` | `false` | 不使用自动补全（含 `[[` 等） |
| `indentOnInput` | `true` | 输入触发自动缩进 |
| `syntaxHighlighting` | `true` | Markdown 高亮 |
| `searchKeymap` | `true` | 保留 CM 默认查找键位 |
| `tabSize` | `tabWidth` | 2/4/8 |

`closeBrackets` 未显式关闭，沿用 `@uiw/react-codemirror` 默认开启，满足 PRD 的"括号/符号自动配对"。

### 7.3 快捷键分工

| 来源 | 生效范围 | 快捷键 |
|------|----------|--------|
| Electron 菜单（全平台） | 全局 | ⌘/Ctrl+N/O/S/⇧S/⇧E/⇧P/F/H、撤销重做、剪切复制粘贴、缩放、全屏 |
| CodeMirror keymap（`Prec.highest`） | 编辑器聚焦时 | ⌘F/⌘H/⌘B/⌘I/⌘`/⌘K |
| 工具栏按钮 | 鼠标 | 新建/打开/保存/导出/格式化/预览/设置 |

**平台差异**：

- 菜单模板由 `createAppMenuTemplate({ isMac, isDev })` 生成，**全平台**都 `Menu.setApplicationMenu(...)`，因此菜单级加速键在 Windows/Linux 同样生效（R1 已修复）。
- 只有 macOS 生成应用菜单（About/Services/Hide/Quit）；Windows/Linux 的"退出"放在文件菜单末尾。
- Windows/Linux 窗口使用 `autoHideMenuBar: true`：菜单栏默认收起，按 `Alt` 唤出——加速键不受影响。
- "重新加载 / 强制重新加载"仅 macOS 与开发模式可见，生产版 Win/Linux 不提供，避免误触丢失未保存内容。

### 7.4 光标与滚动同步

- **光标**：`onUpdate` 读取 `viewUpdate.state.selection.main.head`，换算为行列推给 `App`，再传给状态栏。
- **滚动同步**：在 `onCreateEditor` 时对 `view.scrollDOM` 注册 `scroll` 监听，按 `scrollTop / (scrollHeight - clientHeight)` 比例设置预览容器 `scrollTop`；用 `scrollSyncActive` 标志 + `requestAnimationFrame` 解除，防止回环。
- **方向**：仅"编辑器 → 预览"单向同步，预览滚动不会驱动编辑器。

### 7.5 已知约束

- 扩展数组在每次 React 渲染时重建，`@uiw/react-codemirror` 会做增量重配置；常规输入不会触发额外渲染，但偏好变更会造成一次完整 reconfigure。
- `placeholder` 与 `searchPhrases` 在模块作用域读取 `i18n.language`；语言切换后需一次重渲染才会更新（切换语言本身会触发重渲染，实际可用）。
- 编辑器内容是**受控**的（`value={content}`），超长文档下每次 `onChange` 都会走 React 状态更新；目前无虚拟化，5MB 级文档需实测（§17 R6）。

---

## 8. 预览渲染管线

### 8.1 管线

```text
content
  └─ useDebounce(80ms)
       └─ renderMarkdown(content, env)  [markdown-it 单例，同步、纯函数]
            ├─ highlightCode()  [highlight.js]
            ├─ 插件：footnote / emoji / katex / task-lists
            ├─ link_open 规则：http(s) 链接补 target=_blank rel=noopener
            ├─ image 规则：读取 env.resolveImageSrc，把相对路径改写成 biu-image://
            └─ fence 规则：```mermaid → 输出占位 <div class="biu-diagram" data-diagram-id>，
                            同时把 {id, lang, code} 收进 env.diagrams
       └─ DOMPurify.sanitize({ ADD_ATTR: ['target','rel'], ADD_TAGS: ['iframe'], ALLOWED_URI_REGEXP })
            └─ dangerouslySetInnerHTML → <article class="markdown-body">
                 └─ useEffect → hydrateDiagrams(container, env.diagrams, { theme, signal })
                      └─ 懒加载 mermaid → render() → DOMPurify(SVG) → 填充占位块
```

渲染被拆成两段：**同步段产出占位符，异步段（水合）填充图表**。`renderMarkdown` 始终保持同步与纯函数，图表不进入它的返回值，因此主线程不会被 mermaid 阻塞。详见 §8.8。

### 8.2 markdown-it 配置

```ts
new MarkdownIt({
  html: true,        // 允许内联 HTML（XSS 面由 DOMPurify 收敛）
  linkify: true,     // URL 自动链接
  typographer: true, // 智能标点
  breaks: false,     // 单换行不转 <br>
  highlight: highlightCode
})
```

插件：`markdown-it-footnote`、`markdown-it-emoji(full)`、`@traptitech/markdown-it-katex`（`throwOnError: false`，错误着色 `#cc0000`）、`markdown-it-task-lists`（`enabled/label`）。

### 8.3 链接处理

1. markdown-it 的 `link_open` 规则为 http/https 链接写入 `target="_blank"` 与 `rel="noopener noreferrer"`。
2. 渲染进程 `Preview` 中的点击监听只是兜底（阻止默认行为），真正的打开由主进程 `webContents.setWindowOpenHandler` 拦截并调用 `shell.openExternal`，同时 `return { action: 'deny' }` 阻止应用内开窗。
3. 相对链接目前不会在应用内跳转。

### 8.4 消毒策略

DOMPurify 是**唯一信任边界**：任何进入 `innerHTML` 的 HTML 都必须先过消毒。预览与导出复用同一份 `renderMarkdown` 与相同的消毒参数，保证"所见即导出"。

当前参数放宽了 `target/rel` 属性和 `iframe` 标签：前者为外链所需；后者当前白名单较宽，必要性待复核（见 §17 R3）。

### 8.5 本地图片协议（`biu-image://`）

预览区不能直接读 `file://`（CSP 阻断），相对路径必须走主进程。做法是一条自定义协议 + 目录白名单：

```text
![](assets/a.png)
  └─ image 规则 → toPreviewImageSrc()          [仅相对路径改写]
       → biu-image://local/?path=assets%2Fa.png
            └─ 主进程 protocol.handle
                 ├─ resolveImageRequest(imageBaseDir, path)  越界 / 绝对路径 → 403
                 ├─ imageContentType()                       非图片扩展名 → 403
                 ├─ realpath 双重校验                          软链接逃逸 → 403
                 └─ readFile → Response(content-type)
```

- **改写规则**（`src/shared/image-url.ts`）：只有相对路径会被改写；`http(s):`、`data:`、`file:` 等显式协议、协议相对地址与绝对路径一律原样返回，由 CSP 决定放行与否。导出用的是不带 `env` 的 `renderMarkdown`，因此导出的 HTML 保留原始相对引用。
- **目录来源**：`useFile` 在 `filePath` 变化时经 `document:set-path` 通知主进程；未保存的新文档没有目录，图片一律 403。
- **协议注册**：`protocol.registerSchemesAsPrivileged([{ scheme: 'biu-image', privileges: { standard, secure, stream } }])` 必须在 app ready 之前执行；handler 在 `whenReady` 中注册。
- **缓存隔离**：URL 追加 `&d=<当前文档路径>`。Chromium 的图片缓存按 URL 命中，若省掉这个参数，两个不同目录下同名的 `assets/pic.png` 会互相串图。主进程不读取该参数。
- **消毒兼容**：DOMPurify 默认 `ALLOWED_URI_REGEXP` 会剥掉未知协议，因此预览侧覆盖为 `PREVIEW_ALLOWED_URI_REGEXP`（默认榜单 + `biu-image`）。`data:` 图片走 DOMPurify 的独立分支，不受影响。

**已知边界**：相对图片在导出里靠内联 `data:` URI 落地（见 §8.9 与 §10.2），因此导出的文件不含 `assets/` 依赖；但若图片文件在导出后被删除或移动，预览会 403 而没有占位提示。HTML 导出同理——导出动作发生时已把图片烘焙进产物。

### 8.6 预览主题

- **GitHub**：`github-markdown-css` 作为基础排版。
- **Notion**：在 `.preview-theme-notion .markdown-body` 下覆盖标题、引用、代码、表格样式。
- **明暗**：`.preview-surface-light/dark` 与 `github-markdown-css` 的暗色规则、`hljs` 暗色令牌覆盖共同作用。
- 字号：容器 `fontSize` 内联样式驱动整体缩放。

### 8.7 生命周期与卸载

`Preview` 为 `forwardRef`，向外暴露滚动容器，供编辑器做滚动同步。`useDebounce` 的定时器在内容变化时清理，组件卸载时无残留订阅（点击监听在 `useEffect` 中注册并在清理函数中移除）。

### 8.8 图表水合（Mermaid）

**为什么要分两段**：`mermaid.render()` 返回 Promise，且需要真实 DOM 与布局；把它写进 fence 规则会让 `renderMarkdown` 变成异步，破坏"同步纯函数"这一被预览与导出共用的前提（ADR-005）。此外 mermaid 打包后约 1.1MB，不能进主 bundle。

**同步段（fence 规则）**

```ts
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const lang = tokens[idx].info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  const diagrams = env?.diagrams
  if (diagrams && lang === 'mermaid') {
    const id = `d${diagrams.length}`
    diagrams.push({ id, lang, code: tokens[idx].content })
    return `<div class="biu-diagram" data-diagram-id="${id}" data-diagram-lang="${lang}" data-diagram-state="pending"></div>`
  }
  return defaultFence(tokens, idx, options, env, self)
}
```

- 调用方必须传入 `env.diagrams` 数组才会接管；不传（如未来某些内部调用）则 mermaid 代码块走普通高亮，行为可预期。
- `id` 只在单次渲染内唯一即可：每次重渲染整块 `innerHTML` 都会重建，不存在跨轮次的旧节点。
- 占位块本身不含源码，源码留在 `env.diagrams` 里——它不经过 `innerHTML`，也就绕开了"源码里的 HTML 被当成标记解析"的问题。

**异步段（`lib/diagram-hydrate.ts`）**

| 关注点 | 做法 |
|--------|------|
| 加载 | `getMermaid()` 首次调用时 `import('mermaid')`，Vite 拆出独立 chunk，仅首次遇到图表才下载 |
| 初始化 | 只在主题变化时 `mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme, fontFamily: 'inherit', htmlLabels: false, flowchart: { htmlLabels: false } })` |
| 标签 | 必须关掉 `htmlLabels`：默认实现把文字放进 `<foreignObject>` 里的 XHTML，而 `USE_PROFILES: { svg: true }` 只放行 SVG 元素，消毒后节点会变成空框。改成纯 `<text>` 后标签能保住，代价是标签内不能再用 HTML（`<br>` 由 mermaid 转成 `tspan`，仍然可用） |
| 并发 | mermaid 内部有共享状态，`render()` 并发会互相污染 → 全局串行队列（`renderQueue` 链式 `.then`） |
| 缓存 | `Map<string, string>`，键为 `lang + theme + code`，上限 60 条、超出按插入顺序淘汰；主题不同即为不同键，天然满足"按主题分键" |
| 取消 | 每轮水合一个 `AbortController`；`rendered`/`theme`/`i18n.language` 任一变化即 abort，旧结果不再回填 |
| 安全 | ① `securityLevel: 'strict'`；② 输出再经 `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })` |
| 状态 | 写在宿主的 `data-diagram-state` 上：`pending → ready \| error`，便于用属性选择器调试与做样式 |

**降级路径**：命中占位块后**先**把源码块（`<pre class="biu-diagram-source">`）填进去，再尝试渲染——这样图表在排队或失败时不会是空白。渲染抛错时把状态置为 `error`，追加 `i18n.t('diagram.renderFailed')` 与原始错误信息，源码块保留。错误只影响当前块，循环继续处理下一个。

**导出**：`buildExportHtmlDocument` 为 async。它在离屏 `div` 内先完成水合，再取 `innerHTML` 拼进模板，因此 HTML/PDF 导出得到的是**内联 SVG** 而非占位块；导出模板的 `<style>` 里也带上 `.biu-diagram*` 规则以保持居中与横向滚动。导出不走缓存命中以外的优化——一次导出只发生一次渲染。

**已知边界**：图表占位块参与滚动同步的 DOM 高度计算，水合完成后高度会变化，滚动同步按比例重算，不会错位但可能有轻微跳动；超大图表（节点数百）会明显占用渲染时间，串行队列意味着它们会互相排队。

**工具栏入口**：工具栏「插入 Mermaid」把 `MERMAID_SNIPPET`（`src/shared/diagram.ts`）经 `insertBlock()` 插到光标处。脚手架是一段能直接渲染的最小流程图，用户在此基础上改，不必先记语法。

### 8.9 本地图片写入（粘贴 / 拖放 / 工具栏）

```text
Editor 的 paste 捕获 / drop / 工具栏「插入图片」
  └─ App.handleImageFiles(files) / handleInsertImage()
       ├─ useFile.saveDocument()              无路径先弹另存为，取消则返回 null，整条链路中止
       ├─ imageAPI.saveImages(path, files)    [invoke IMAGE_SAVE]  粘贴与拖放
       │  或 imageAPI.pickImages(path)        [invoke IMAGE_PICK]  弹出系统选图对话框
       └─ 主进程 saveImageAssets(documentPath, files)
            ├─ mkdir <docDir>/assets           递归创建
            ├─ readdir → 已用文件名集合
            ├─ imageFileName()                  MIME 优先，其次原扩展名；两者都须通过 imageContentType 白名单
            │   └─ 重名递增 a.png → a-2.png → a-3.png
            └─ writeFile(Buffer)
  └─ 返回 ["assets/a.png", …] → lib/image-insert.ts 在光标处插入 ![](assets/a.png)
```

- **目录来源**：`documentPath` 由渲染进程显式传入，而不是复用主进程里 `imageBaseDir` 的全局状态。若走全局，"另存为之后立刻插图"会有一帧窗口期把图片写进旧目录；显式传参让"路径"与"写入"是同一次调用，天然没有竞态。这与 `FILE_SAVE` 接受渲染进程传路径的信任模型一致。
- **粘贴**：在捕获阶段拦截（`onPasteCapture`）。CodeMirror 自己的 paste 处理会在冒泡阶段把剪贴板里的文本也插进去，冒泡阶段再拦已经晚了；捕获阶段 `preventDefault + stopPropagation` 才能保证只有图片被处理。
- **拖放**：`dragover` 必须 `preventDefault` 才允许 drop，同时置上高亮覆盖层；`dragleave` 用 `currentTarget.contains(relatedTarget)` 判断是否真的离开编辑区，避免子元素间移动时闪烁。`drop` 只要有文件就 `preventDefault`（否则 Electron 会导航到被拖入的文件），非图片文件静默丢弃；纯文本拖放不拦截，交还 CodeMirror。
- **文件名清洗**（`src/main/image-save.ts`）：取 basename → 去扩展名 → 去 `: * ? " < > |` 与控制字符 → 空白转 `-` → 去首尾点和空格 → 截断 60 字符 → 为空则回退 `image`。路径分隔符在 basename 阶段就已消除，`../../etc/passwd.png` 只会得到 `passwd`。
- **插入位置**（`src/renderer/src/lib/block-insert.ts`，图片与 Mermaid 共用）：当前行还有其他文字时前后补换行，避免块内容挤进段落；多张图片一次插入，整段只是一条撤销记录。`alt` 取文件名去扩展名。

> 云图床模式下这条链路整体让位：`App.handleImageFiles` 判断 `isCloud` 后直接走 `useImageUpload`，不调用 `saveDocument()`（云端不需要先给文档落盘），也不写 `assets/`。详见 §16.2。

---

## 9. 文档生命周期

### 9.1 状态机

```text
              newFile()                  openFile()/openRecentFile()
   ┌────────────────────────┐   ┌───────────────────────────────┐
   │ 空文档 (filePath=null)  │──▶│ 已打开文档 (filePath=path)     │
   └───────────┬────────────┘   └───────────────┬───────────────┘
               │ setContent                     │ setContent
               ▼                                ▼
        ┌─────────────┐                  ┌─────────────┐
        │ 未命名·脏    │                  │ 已打开·脏    │
        └──────┬──────┘                  └──────┬──────┘
               │ saveFile() → saveAs           │ saveFile() / autoSave()
               ▼                               ▼
        ┌─────────────┐                  ┌─────────────┐
        │ 已打开·干净  │                  │ 已打开·干净  │
        └─────────────┘                  └─────────────┘
```

- `isDirty` 由 `content !== savedContent` 派生，不单独存储。
- 标题规则：有文件 → `文件名 · BiuText`（脏）/ `文件名 - BiuText`（净）；无文件且脏 → `未命名 · BiuText`。
- 新建/打开/关闭共用同一道脏检查 `confirmLeaveCurrentDocument()`：脏内容时弹三态对话框（保存 / 不保存 / 取消），三条路径行为一致（§17 R10/R12 已修复）。选择"取消"或另存为被取消时，操作整体中止、文档保持原样。

### 9.2 欢迎文档

初始内容为本地化的 `welcome.document`。语言切换时，`useFile` 只在"无文件路径 + 未修改 + 内容仍等于上一版欢迎稿"时替换，避免覆盖用户输入。

### 9.3 最近文件

- 数据结构：`{ path: string; openedAt: number | null }`。
- 解析宽容：兼容旧版 `string[]`，非法项丢弃，最多 10 条。
- 写入：去重后置顶，`slice(0, 10)`。
- 展示：菜单子项 `sublabel` 为"时间 · 路径"；同日显示时刻，跨日显示"月 日 时:分"，使用 `Intl.DateTimeFormat(language)`。
- 记录时机：打开成功、保存成功、另存为成功。

---

## 10. 导出子系统

### 10.1 HTML 导出

`buildExportHtmlDocument()` 在渲染进程生成**自包含 HTML**：

- 复用 `renderMarkdown` + DOMPurify，保证与预览一致。
- 内联一份精简 CSS（含明暗配色、GitHub/Notion 宽度差异、字体栈、表格滚动、`@page` 边距）。
- 标题取自当前文件名（无文件时用本地化的"BiuText 文档"）。

主进程接收 HTML 字符串，先经 `inlineLocalImages()` 把 `<img src="assets/…">` 换成对应的 `data:` URI（见 §10.4），再弹保存对话框（默认名 `<原名>.html`）写入文件——导出的 HTML 不依赖 `assets/` 目录。写完（或失败）时经 `APP_NOTIFY` 推送一条 Toast（§6.6）。

### 10.2 PDF 导出

```text
渲染进程 buildExportHtmlDocument() → fileAPI.exportPdf(html, name, documentPath)
  └─ 主进程：保存对话框 → inlineLocalImages(html, 文档目录)  相对图片 → data: URI
       └─ 新建隐藏 BrowserWindow({ show:false, sandbox:true, contextIsolation:true, nodeIntegration:false })
       └─ loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
       └─ webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
       └─ writeFile(pdf) → notify('success', …) → finally: pdfWindow.destroy()
```

> 打印窗口不加载 preload，也不具备任何 IPC 能力，仅用于排版与打印，是当前隔离度最高的窗口。

### 10.3 限制

- PDF 不包含页眉页脚、目录、分页控制；依赖 CSS `@page`。
- 导出为一次性快照，不包含 TOC、引用跳转等交互能力。
- 大文档导出时渲染进程会完整渲染一次（与预览同成本）。
- 图片内联会把二进制塞进 HTML/PDF，文档图片多且大时导出体积与耗时同步上升。

### 10.4 相对图片内联（`src/main/export-image.ts`）

打印窗口加载的是 `data:text/html`，本身没有文档目录的概念，所以 `![](assets/a.png)` 这类相对引用在那里无处解析——这是 v0.4 之前"PDF 里图片全丢"的根因。做法是在 `loadURL` 之前把相对引用就地换成 `data:` URI：

| 关注点 | 做法 |
|--------|------|
| 命中范围 | 正则扫描 `<img src="…">`；只处理相对路径（排除任意 scheme、`//`、`#`），远程图与 `data:` 原样保留 |
| 越界防线 | 复用 `resolveImageRequest(baseDir, path)`，与预览走同一套目录白名单与 realpath 校验；读不到或越界就保留原样 |
| 类型校验 | `imageContentType()` 不认的扩展名不内联 |
| 去重 | 同一个 `src` 只读一次磁盘，多图引用同一文件不重复读 |
| 编码 | HTML 实体先解码（`&amp;`/`&quot;`/`&#39;`/`&lt;`/`&gt;`）再拼路径 |
| 失败策略 | 任何单张图失败都只是"这张不内联"，导出继续；整体不会抛错 |

HTML 导出与 PDF 导出共用这一函数，因此两者得到的是同一份"自包含"产物。

---

## 11. 国际化子系统

### 11.1 双轨架构

| 进程 | 方案 | 入口 |
|------|------|------|
| 渲染进程 | i18next + react-i18next，`useTranslation()` 提供 `t()` | `src/renderer/src/i18n.ts` |
| 主进程 | 自研纯函数 `translate(language, key, vars)` | `src/shared/i18n/translate.ts` |

两端**共享同一份 `messages.ts`**，回退语言均为 `en-US`，插值语法均为 `{{var}}`。这是刻意的混合方案：主进程不需要 React 上下文，纯函数可直接单测；渲染进程享受 hooks 的自动重渲染。

### 11.2 数据结构与类型约束

```ts
const zhCN = { menu: {...}, dialog: {...}, ... } satisfies MessageTree
const enUS = { ... } satisfies typeof zhCN   // 编译期保证 key 集合一致
const zhTW = { ... } satisfies typeof zhCN
export const messages: Record<AppLanguage, MessageTree> = { 'zh-CN': zhCN, 'zh-TW': zhTW, 'en-US': enUS }
```

- `MessageTree = { [key: string]: string | MessageTree }`，支持任意层级嵌套。
- 以 `zhCN` 为基准，其余语言用 `satisfies typeof zhCN` 在 **编译期**发现缺失/多余 key。
- 补充防线：`scripts/check-i18n.mjs` 在运行时递归比对 key 路径（`npm run check:i18n`）。

### 11.3 语言解析优先级

`resolveLanguage(saved, systemLocale)`：

1. `saved` 属于 `SUPPORTED_LANGUAGES` → 直接使用。
2. 系统语言归一化（下划线转连字符、小写）：
   - `zh-tw` / `zh-hk` / `zh-mo` / `zh-hant` / 含 `-hant` → `zh-TW`
   - 其他 `zh*` → `zh-CN`
3. 其余 → `en-US`。

主进程在启动时以 `app.getLocale()` 作为系统语言输入；渲染进程只认主进程给出的结果。

### 11.4 运行时切换链路

```text
SettingsPanel 语言下拉
  └─ useAppLanguage.setLanguage(next)
       ├─ i18n.changeLanguage(next)          // 渲染进程立即重渲染
       │    └─ document.documentElement.lang = next
       └─ languageAPI.set(next)              // invoke
            └─ 主进程：currentLanguage = next → 写 language.json → buildMenu()
```

- 渲染进程初始语言通过 `sendSync(LANGUAGE_GET)` **同步**获取，保证 i18next 以 `initAsync: false` 完成首帧前初始化（避免闪英文）。
- 菜单不依赖渲染进程：主进程持有 `currentLanguage`，语言变更后重建菜单，菜单文案立即切换。
- 欢迎文档在语言切换时按 §9.2 的条件替换。

### 11.5 CodeMirror 查找面板

CodeMirror 的面板文案不走 i18next，而是通过 `EditorState.phrases.of(searchPhrases(language))` 注入一组扁平键（`Find`、`Replace`、`next`、`match case`、`regexp`、`by word`、`replace all`、`close`），三语映射维护在 `src/shared/search-phrases.ts`。

### 11.6 时间与快捷键格式化

- 时间：`Intl.DateTimeFormat(language, options)`（`recent-files.ts`）。
- 快捷键展示：`formatShortcut(platform, key, shift)` 按平台输出 `⌘N` / `Ctrl+N`，用于工具栏 `title`。

### 11.7 校验与门禁

- 本地：`npm run check:i18n`（依赖 Node 的类型剥离能力，直接 import `.ts`）。
- CI：已接入 `ci.yml` 的 `quality` job，见 §15.6。

---

## 12. 持久化与配置

### 12.1 存储分布

| 存储位置 | 键 / 文件 | 内容 | 写入方 |
|----------|-----------|------|--------|
| `localStorage` | `biu-text:appearance` | 字体、字号、预览主题/字体、Tab、行高、行号、自动保存间隔 | 渲染进程 |
| `localStorage` | `biu-text:theme-mode` | `light` / `dark` / `system` | 渲染进程 |
| `localStorage` | `biu-text:splitter-left-pct` | 左侧宽度百分比 | 渲染进程 |
| `localStorage` | `biu-text:preview-visible` | 预览显隐 | 渲染进程 |
| `userData/language.json` | `{ language }` | 界面语言 | 主进程 |
| `userData/recent-files.json` | `RecentFileRecord[]` | 最近文件与打开时间 | 主进程 |
| OS 登录项 | — | 开机自启 | 主进程 |

**为什么分成两处？**

- 主进程拥有的状态（语言、最近文件）必须在主进程可读：菜单需要同步生成，且早于渲染进程启动。
- 纯界面偏好（外观、布局）留在渲染进程 `localStorage`，读写零 IPC 开销；代价是未来若要跨窗口/多标签共享需迁移。

### 12.2 防御性读取

所有持久化入口都做归一化与容错：

- `readEditorPreferences`：Tab 仅接受 2/4/8，行高限制 1.2–2.0 且步进 0.1，自动保存仅接受 0/30/60/300。
- `readStoredAppearance`：逐字段校验，非法值回落默认；整体解析失败返回默认。
- `readStoredLeftPct`：夹取 20–80。
- `readRecentFiles`：兼容旧格式、丢弃非法项。
- 写入失败（配额、权限）静默忽略，不阻断编辑。

---

## 13. 安全模型

### 13.1 信任边界

信任边界位于**渲染进程与主进程之间**、以及**Markdown 内容与 DOM 之间**：

```text
不可信输入：打开的 .md 文件内容、剪贴板、未来粘贴的图片
        │
        ▼
   markdown-it (html:true)
        │
        ▼
   DOMPurify  ←─ 信任边界（唯一）
        │
        ▼
   预览 DOM / 导出 HTML

渲染进程 ←─ contextBridge 白名单 ─→ 预加载 ←─ IPC ─→ 主进程（文件系统、shell、对话框）
```

### 13.2 现有措施

| 措施 | 实现位置 | 说明 |
|------|----------|------|
| `contextIsolation: true` | 主窗口 webPreferences | 隔离预加载上下文 |
| `nodeIntegration: false` | 主窗口 / 打印窗口 | 渲染进程无 Node |
| preload 白名单 | `src/preload/index.ts` | 仅暴露 6 个门面，不暴露 `ipcRenderer` |
| CSP | `src/renderer/index.html` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data: blob: https: http://127.0.0.1:* http://localhost:* biu-image:` |
| HTML 消毒 | `Preview`、`export-document` | DOMPurify，允许 `target/rel` 属性；预览侧另放行 `biu-image:` 协议 |
| 图片读取白名单 | `src/main/image-path.ts` | 仅限当前文档目录内的相对路径，扩展名必须为图片，`realpath` 兜底防软链接逃逸 |
| 图片写入白名单 | `src/main/image-save.ts` | 只写 `<文档目录>/assets/`；文件名取 basename 后清洗，MIME 与扩展名都须命中图片类型，不合法直接拒绝 |
| 图床凭证加密 | `src/main/image-host-store.ts` | token 经 `safeStorage.encryptString` 后以 base64 落盘到 `image-host.json`；密钥环不可用时退化为明文并在 JSON 中标记 `enc: false` |
| 凭证不出主进程 | `shared/image-host.ts`（`toImageView`）/ preload | 渲染进程只拿 `tokenMasked`（`••••1234`）与 `tokenSaved`；回传脱敏值或空值视为"不修改" |
| 上传端点约束 | `shared/image-host.ts`（`isSecureEndpoint`） | 只放行 `https:`，`http:` 仅限 `127.0.0.1`/`localhost`/`::1`，防止明文外发凭证 |
| 上传请求在主进程 | `main/image-host-providers.ts` | `connect-src` 保持 `'self'`，渲染进程无法自行发请求；自定义图床的 `content-type` 由主进程强制覆盖为 multipart，用户 header 无法改写包体边界 |
| 上传体积上限 | `src/main/index.ts`（`MAX_UPLOAD_BYTES`） | 单张 10 MB，超出直接拒绝并回传本地化错误 |
| 外部链接 | `setWindowOpenHandler` → `shell.openExternal`，`action: 'deny'` | 阻断应用内开窗 |
| 打印窗口隔离 | `sandbox: true` + 无 preload | 仅用于 `printToPDF` |
| 文件操作集中于主进程 | 所有 fs 在 `src/main/index.ts` | 渲染进程无路径直通写权限 |

### 13.3 现存缺口与建议

1. **主窗口 `sandbox: false`**：预加载仍可访问部分 Node 能力；后续应评估开启 `sandbox: true`（需确认预加载只用 `electron` 白名单模块）。
2. **`html: true` + `ADD_TAGS: ['iframe']`**：允许嵌入 iframe，扩大了钓鱼/内容注入面；建议移除 `iframe` 或在消毒后过滤非白名单域名。
3. **`connect-src` 仍继承 `default-src 'self'`**：`fetch` / WebSocket 全部被阻断，渲染进程无法直连网络——这是刻意的，图床上传走主进程（§16.2）。`img-src` 已显式声明（见 §8.5），不再继承 `default-src`。
4. **HTTPS 图片无来源限制**：`img-src` 中的 `https:` 允许文档引用任意远端图片，会向第三方泄露 IP 与阅读行为；若后续需要收紧，可改为用户可配置的域名白名单。
5. **`sendSync` 启动调用**：同步 IPC 在主进程繁忙时会阻塞渲染进程启动；当前仅一次、成本可接受，但不应扩散。
6. **无进程级异常上报**：错误仅通过 `dialog.showErrorBox` 呈现，缺少结构化日志（§17 R11）。
7. **`safeStorage` 不可用时 token 明文落盘**：部分 Linux 桌面没有密钥环，`isEncryptionAvailable()` 为 false，此时 `image-host.json` 中的 token 以明文保存并标记 `enc: false`；当前设置面板只展示脱敏值，界面没有提示这一降级，后续应在保存时告知用户。

---

## 14. 性能设计

### 14.1 延迟预算与实现

| 环节 | 预算 | 现状实现 |
|------|------|----------|
| 输入 → 预览更新 | ≤ 100ms | `useDebounce(80)` + 同步渲染，通常满足 |
| 光标/字数更新 | 即时 | React 状态更新 + `useMemo` |
| 滚动同步 | 即时 | 原生 `scroll` 监听 + `rAF` 解除回环 |
| 打开/保存 | 受 I/O 限制 | 主进程 `fs/promises`，无额外拷贝 |
| PDF 导出 | 秒级 | 隐藏窗口完整渲染一次 |

### 14.2 热路径

1. **每次按键**：`onChange` → `setContent` → `App` 重渲染 → 子组件 diff。Preview 的 `useDebounce` 使渲染被推迟，但 `useWordCount` 每次内容变化都会 O(n) 扫描。
2. **防抖到点**：整篇 Markdown 全量解析 + 高亮 + DOMPurify 解析 + `innerHTML` 替换。这是最主要的性能成本，随文档长度线性增长。
3. **滚动**：仅一次比例计算与一次 `scrollTop` 赋值，成本低。
4. **图表水合**：每次防抖渲染都会重跑 `hydrateDiagrams`，但命中 SVG 缓存时只做 DOM 填充，不调用 mermaid；未命中时排进串行队列。真正昂贵的是编辑器连续输入且图表不断变化的场景——此时旧任务被 abort，队列中最多残留一次进行中的渲染。

mermaid 的 1.1MB 分块是**懒加载**的：不含图表的文档从不下载它，因此不影响首次启动与冷打开。

### 14.3 大数据量风险

- 5MB 文档下，每次防抖渲染都重建整个 DOM，可能造成明显卡顿；`innerHTML` 全量替换也会丢失滚动锚点。
- 优化方向（未实施）：增量渲染、按块 diff、`requestIdleCallback` 分片、预览虚拟化、字数统计防抖。

---

## 15. 构建、质量与发布

### 15.1 electron-vite 三端构建

```ts
main:     externalizeDepsPlugin(), input: src/main/index.ts
preload:  externalizeDepsPlugin(), input: src/preload/index.ts
renderer: root: src/renderer, input: index.html,
          resolve.alias: { '@renderer', '@', '@shared' },
          plugins: [react(), tailwindcss()]
```

输出到 `out/{main,preload,renderer}`，`package.json` 的 `main` 指向 `./out/main/index.js`。

### 15.2 双 tsconfig

| 配置 | 包含 | lib | 特点 |
|------|------|-----|------|
| `tsconfig.node.json` | main、preload、shared、electron.vite.config.ts | ESNext（无 DOM） | `@main/*`、`@preload/*` 路径别名 |
| `tsconfig.web.json` | renderer、shared、preload/index.d.ts | ESNext + DOM | `@renderer/*`、`@*`、`@shared/*` 别名 |

两份配置均排除 `*.test.ts`，`strict: true`，`noEmit: true`。`npm run typecheck` 依次执行两份检查。

### 15.3 代码质量工具

| 工具 | 命令 | 覆盖 |
|------|------|------|
| ESLint（flat config） | `npm run lint` | `**/*.{ts,tsx}`，js/ts recommended + react-hooks + react-refresh |
| TypeScript | `npm run typecheck` | 主/渲染两套 |
| Vitest | `npm test` | 纯函数与纯模块：i18n、editor-preferences、recent-files、search-phrases、diagram、image-url、image-path、image-save、export-image、toast-store |
| i18n 校验 | `npm run check:i18n` | 三语 key 对齐 |

**测试策略**：只测纯逻辑（`shared/`、主进程的纯函数、渲染层的纯模块），不测 UI 与 Electron 集成；无 E2E。这与"逻辑下沉到 shared"的架构原则互为因果——把可测逻辑挤出组件，降低测试成本。`vitest.config.ts` 因此配置了 `@` / `@shared` / `@renderer` 别名，让渲染层纯模块也能直接引入。

### 15.4 持续集成与发布

**`.github/workflows/ci.yml`（质量门禁）**：

- 触发：任意分支 `push`、`pull_request`，以及被 `release.yml` 通过 `workflow_call` 复用。
- 单 job（`ubuntu-latest`，Node 24）顺序执行：`npm ci` → `lint` → `typecheck` → `test` → `check:i18n` → `build`。
- 用固定 registry 与 Electron 镜像地址，避免 runner 地域差异导致的下载失败。
- `permissions: contents: read`，最小权限。

**`.github/workflows/release.yml`（构建与发布）**：

- 触发：推送 `v*` 标签或手动触发。
- `quality` job 复用 `ci.yml`；三平台矩阵 `build` job 声明 `needs: quality`，**门禁不过则不打包**。
- 矩阵：`macos-latest` / `windows-latest` / `ubuntu-latest`，Node 24，`npm ci`。
- 步骤：`npm run build:<platform>`（electron-vite 构建 + electron-builder 打包）。
- 产物：`*.dmg`、`*.exe`、`*.AppImage`、`*.deb` 上传为 artifact。
- 发布：tag 触发时由 `softprops/action-gh-release` 创建 GitHub Release 并附上产物。

### 15.5 打包配置

| 平台 | 目标 | 架构 | 图标 |
|------|------|------|------|
| macOS | dmg | arm64 + x64 | `resources/icons/icon.icns` |
| Windows | nsis（可选安装目录、非一键、非全机器） | x64 | `resources/icons/icon.ico` |
| Linux | AppImage + deb | 默认 | `resources/icons/` |

`appId: com.biu-text.desktop`，`artifactName: ${productName}-v${version}-${os}-${arch}.${ext}`。

### 15.6 质量门禁

四项检查已全部接入 CI，`quality` job 全绿才允许打包发布：

| 检查 | 命令 | CI 中的位置 |
|------|------|-------------|
| Lint | `npm run lint` | `ci.yml` 第 2 步 |
| 类型 | `npm run typecheck` | 第 3 步 |
| 单测 | `npm test` | 第 4 步 |
| i18n | `npm run check:i18n` | 第 5 步 |
| 构建 | `npm run build` | 最后一步，确保产物可生成 |

几个约束：

- ESLint 的 `globalIgnores` 必须包含 `out` 与 `dist`，否则会 lint 到打包产物里的第三方代码（曾经的"rule not found"报错即源于此）。
- `components/ui/**` 遵循 shadcn 上游写法，变体常量不从组件文件导出；如需外部复用，拆到独立文件，而不是关闭 `react-refresh/only-export-components`。
- 本地提交前应至少跑一遍 `npm run lint && npm run typecheck`，CI 只做复核，不替代本地反馈。

---

## 16. 演进架构（v0.4–v1.1）

以下为在现有架构上的最小侵入式扩展方案。§16.1 的 Mermaid 部分已落地（实现细节见 §8.8），其余仍为**设计意图**，未实现。

### 16.1 图表渲染子系统（Mermaid 已落地）

**核心矛盾**：`markdown-it.render()` 是**同步**的，而 `mermaid.render()` 返回 Promise。直接把异步渲染塞进 fence 规则会破坏现有同步管线。

**采用的方案：占位符 + 副作用水合**（已实现）

```text
renderMarkdown(content, { diagrams })        // 保持同步、纯函数
  └─ fence 规则命中 mermaid
       └─ diagrams.push({ id, lang, code })
       └─ 输出 <div class="biu-diagram" data-diagram-id data-diagram-state="pending">
       └─ DOMPurify 消毒（保持现有边界）
       └─ Preview 的 useEffect → hydrateDiagrams(container, diagrams, { theme, signal })
            └─ 先填源码块 → 查缓存 → 未命中则串行排队调 mermaid.render()
            └─ 成功后挂载（DOMPurify 二次消毒的）SVG，失败显示错误态并保留源码
```

**实际模块**（非原设计的注册表）

| 文件 | 职责 |
|------|------|
| `src/shared/diagram.ts` | `DiagramBlock` 结构与 `diagramCacheKey(block, theme)` |
| `src/renderer/src/lib/diagram-hydrate.ts` | 懒加载 mermaid、初始化、串行队列、SVG 缓存、取消、降级 |

原设计里的 `DiagramRenderer` 注册表（`registerDiagramRenderer` / `getDiagramRenderer`）**未实现**：当前只有一种图表语言，注册表属于"为一种实现写抽象"。等 ChartJS / Graphviz 真正进来时再抽，那时才有第二个消费者来决定接口形状。

**约束与要点（均已满足）**

- 渲染结果缓存以 `lang + theme + code` 为键，命中直接复用 SVG（LRU 上限 60）。
- 渲染失败回退为源码块 + 错误信息，不中断后续块。
- Mermaid 固定 `securityLevel: 'strict'`；SVG 输出再经 `DOMPurify.sanitize(..., { USE_PROFILES: { svg: true, svgFilters: true } })`。
- 导出 HTML/PDF 前完成水合，以**内联 SVG** 形式进入导出文件。
- 主题切换按主题分键，天然不会串色。

**后续（v1.0）**：ChartJS 与 Graphviz 需要先落地"第二个渲染器"，届时再引入注册表，并把 `diagram-hydrate.ts` 里的 mermaid 专用逻辑降级为其中一个实现。

### 16.2 图片上传子系统

**职责划分**：渲染进程负责捕获（粘贴/拖拽）与 Markdown 插入；**主进程负责上传与凭证**，渲染进程永不接触密钥。

**现状（v0.5）**：捕获、本地落盘（`<文档目录>/assets/`，§8.9）与云图床均已落地。云图床支持 **GitHub 仓库**与**自定义 HTTP 接口**两类，其余厂商（OSS/COS/七牛/又拍）按同一 provider 形态后续补齐。

```text
设置面板（SettingsPanel/ImageHostSettings）
  └─ imageAPI.setHostConfig(view)             [invoke IMAGE_HOST_SET]
        └─ 主进程 mergeImageView → safeStorage 加密 token → image-host.json
  └─ imageAPI.testHost(draft)                 [invoke IMAGE_HOST_TEST]
        └─ 只测当前草稿、不落盘（主进程用 mergeImageView 补上未改动的令牌）
        └─ GitHub: GET /repos/{repo}；自定义: 真传一张 1×1 PNG

Editor DOM 事件（paste / drop）或工具栏「插入图片」
  └─ 取得 ImageFileInput[]（name/mime/bytes）
  └─ 渲染进程先插入占位符 ![...](uploading:{id})   // lib/upload-placeholder.ts
      预览区把 `uploading:` 地址渲染成脉冲占位块，不显示裂图
  └─ 逐张 invoke IMAGE_UPLOAD { uploadId, name, mime, bytes }
        └─ 主进程 uploadImage(config, input, onProgress)
             ├─ github: PUT api.github.com/repos/{repo}/contents/{dir}/{name}
             └─ custom: POST {url}（multipart/form-data）
             ├─ 进度通过 IMAGE_UPLOAD_PROGRESS 按 uploadId 回推
             └─ 返回 { ok, url } 或 { ok:false, error }
  └─ 成功：把占位符整段替换成 ![alt](url)
     失败：保留占位符 + 8 秒失败 Toast（带「重试」动作）
```

**实现形态**

| 文件 | 职责 |
|------|------|
| `shared/image-host.ts` | 配置类型、默认值、归一化、脱敏、header 文本互转、JSON 点路径、`isSecureEndpoint`、序列化（`toStoredConfig`/`fromStoredConfig`） |
| `main/image-host-store.ts` | `image-host.json` 读写；token 走 `safeStorage.encryptString`，密钥环不可用时退化为明文（`enc: false`） |
| `main/http-upload.ts` | `node:https`/`node:http` 分块写入（64 KiB + `drain` 背压）产生进度，60 s 超时 |
| `main/image-host-providers.ts` | `uploadToGithub` / `uploadToCustom` / `uploadImage` 分派 / `testImageHost` |
| `renderer/lib/upload-placeholder.ts`、`upload-store.ts`、`hooks/useImageUpload.ts` | 占位符增删、进度表、上传编排与失败重试 |
| `renderer/components/UploadIndicator.tsx` | 右下角进度卡（`role="progressbar"`） |

**关键架构约束**

1. **CSP**：已显式声明 `img-src data: blob: https: http://127.0.0.1:* http://localhost:* biu-image:`，远程图片在预览区可加载；`connect-src` 仍保持 `'self'`，即上传请求必须由主进程发起。
2. **本地图片**：读写两侧都已落地——读走 `biu-image://`（§8.5），写走 `IMAGE_SAVE` 直接落盘（§8.9）；云端模式不落盘，`IMAGE_PICK_INPUT` 直接把字节交回渲染进程。
3. **凭证存储**：`safeStorage.encryptString` + `image-host.json`；渲染进程只拿 `ImageHostConfigView`（`tokenMasked: '••••1234'`、`tokenSaved`），脱敏值或空值回传时视为"不修改"。
4. **端点约束**：`isSecureEndpoint` 只放行 `https:`，`http:` 仅限回环地址（本地联调）。自定义图床的 `content-type` 由主进程强制覆盖为带 boundary 的 multipart，避免用户 header 破坏包体。
5. **错误语义**：按 PRD Q10，上传失败**不降级**到本地 `assets/`，保留占位符与重试。
6. **进度通道**：一次请求 + 多次 `IMAGE_UPLOAD_PROGRESS`，`uploadId` 关联，失败重试沿用同一 `uploadId`，避免与其它并发上传串扰。
7. **云端文件名**：`时间戳-清洗后的原名`；剪贴板图片的文件名都是 `image.png`，同秒批量上传时按运行内已用名追加 `-2`、`-3` 后缀，避免 GitHub Contents API 因同名覆盖返回 422。

**后续**：OSS/COS/七牛/又拍没有独立抽象层，只需在 `uploadImage` 分派中新增分支；若分支继续增多，再抽 `ImageHostProvider` 注册表。

### 16.3 编辑器内联渲染（Typora 风格）

**扩展点**：CodeMirror `ViewPlugin` + `Decoration` + `syntaxTree()`。

```ts
const inlinePreview = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(view: EditorView) { this.decorations = this.build(view) }
  update(u: ViewUpdate) {
    if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = this.build(u.view)
  }
  build(view: EditorView) {
    // 遍历 viewport 内的 syntaxTree，识别 Image / FencedCode(mermaid)
    // 光标所在行不装饰（保持可编辑）；其余用 Decoration.replace({ widget }) 替换
  }
}, { decorations: v => v.decorations })
```

**要点**

- 只在 `view.viewport` 范围内构建装饰，避免长文档全量扫描。
- 光标进入被替换区间时立即撤销装饰（依赖 `selectionSet` 触发重建）。
- 图片用 `Decoration.widget` 插入 `<img>`，配合 `IntersectionObserver` 懒加载；图表用 `Decoration.replace`。
- 图表渲染结果缓存与 §16.1 共用。
- 必须提供开关（设置项"编辑器内联渲染"），关闭后回到纯文本；实现中要防止与撤销/重做、IME 组合输入冲突。

### 16.4 多标签页（v1.1）

当前 `useFile` 是**单文档状态**，`App` 直接消费。多标签需要：

1. 新增 `useDocuments()`：持有 `documents: DocumentState[]`、`activeId`；每个文档维护 `{ id, content, filePath, savedContent, cursor, scrollTop }`。
2. `useFile` 的职责拆分为"单文档操作"（open/save/saveAs）与"文档集合管理"。
3. 标题、脏标记、菜单事件（保存/另存为/导出）需路由到**当前活动文档**。
4. 关闭标签时复用现有"脏检查"逻辑（改为 `dialog.showMessageBox` 三态）。
5. 编辑器实例：每标签一个 CodeMirror 或单实例切换 state；前者隔离好、内存高，后者需重建 `EditorState`。

### 16.5 版本影响矩阵

| 版本 | 能力 | 主要改动点 | 架构风险 |
|------|------|-----------|----------|
| v0.4 | Mermaid（✅ 已落地）、本地图片粘贴/拖放/工具栏插入（✅ 已落地）、工具栏「插入 Mermaid」（✅ 已落地）、图床设置 UI（仅本地项可用，云端为占位） | `markdown.ts`（fence 规则）、`diagram.ts`（`MERMAID_SNIPPET`）+ `diagram-hydrate.ts`（水合）、`Preview`、`Editor`（paste/drop）、`block-insert.ts`（块插入）、`image-save.ts` / `export-image.ts`（主进程）、`ipc-channels`、CSP | 同步/异步管线（已解决，§8.8）、CSP 阻断（已解决，§8.5）、导出水合（已解决）、PDF 相对图片（已解决，§10.4）、资产生命周期（见 §17 R15） |
| v0.5 | 云图床（✅ GitHub + 自定义 HTTP 已落地）、上传占位符与重试（✅）、进度条（✅）、测试连接（✅）、批量上传（✅ 多选/多文件粘贴）、其余厂商图床（未做） | `shared/image-host.ts`、`main/image-host-store.ts`、`main/http-upload.ts`、`main/image-host-providers.ts`、`IMAGE_HOST_*` / `IMAGE_UPLOAD` / `IMAGE_UPLOAD_PROGRESS` 通道、`useImageHost` / `useImageUpload` / `upload-placeholder` / `upload-store`、`SettingsPanel/ImageHostSettings`、`UploadIndicator`、Toast 动作按钮 | 凭证安全（已用 `safeStorage`，明文降级见 §13.3）、网络失败语义（已定：保留占位符 + 重试）、进度串扰（已用 `uploadId` 隔离） |
| v1.0 | 内联渲染、ChartJS、Graphviz、导出增强 | CodeMirror ViewPlugin、渲染器注册表、导出管线 | 编辑体验回归、性能、缓存一致性 |
| v1.1 | 多标签、文件树、Excalidraw | 文档模型重构、侧边栏布局、独立编辑窗口 | 单文档假设、状态迁移 |

---

## 17. 技术债与风险登记

| # | 风险 | 影响 | 建议 |
|---|------|------|------|
| R1 | ~~非 macOS 不创建应用菜单，菜单级快捷键失效~~ **已修复** | Windows/Linux 用户无法使用 Ctrl+N/O/S 等 | 已改为全平台 `Menu.buildFromTemplate` + `setApplicationMenu`，Win/Linux 靠 `autoHideMenuBar` 收起菜单栏；生产版不注入 reload 项。剩余动作：Win/Linux 实机回归 §7.3 列出的加速键 |
| R2 | 主窗口 `sandbox: false` | 预加载具备额外能力，攻击面略大 | 评估开启 sandbox 并验证预加载兼容性 |
| R3 | `html: true` + DOMPurify 允许 `iframe` | 可嵌入外部页面，有钓鱼/隐私风险 | 移除 `iframe` 白名单或按域过滤 |
| R4 | ~~CSP `default-src 'self'` 阻断远程图片与网络请求~~ **已修复** | 远程图片不显示；v0.4 图片功能受阻 | `img-src` 显式声明 `data: blob: https: http://127.0.0.1:* http://localhost:* biu-image:`；本地图片走自定义协议并按文档目录白名单读取（§8.5）；`connect-src` 维持关闭，上传仍由主进程发起。剩余：`https:` 任意来源的风险见 §13.3 |
| R5 | ~~markdown-it 同步渲染 vs 图表异步渲染~~ **已修复** | 直接影响 v0.4 实现路径 | `renderMarkdown` 保持同步，fence 输出占位块并把源码收进 `env.diagrams`；`hydrateDiagrams` 在提交后异步填充，具备取消、串行队列、按 `lang+theme+code` 缓存与失败降级（§8.8）。导出路径改为 async 并预水合为内联 SVG |
| R6 | 全量重渲染预览 + O(n) 字数统计 | 大文档卡顿、滚动跳变 | 分块渲染/空闲调度/字数防抖；先用基准文档量化 |
| R7 | 启动用 `sendSync` 取语言 | 主进程繁忙时阻塞首帧 | 可接受；若启动变慢改为预加载注入 + 异步切换 |
| R8 | ~~CI 未跑 lint/typecheck/test/check:i18n~~ **已修复** | 回归风险靠人工 | 新增 `ci.yml` 的 `quality` job，`release.yml` 通过 `workflow_call` 复用并设 `needs: quality`；同时修复了 13 处既有 lint 报错。剩余动作：观察首次 CI 运行，必要时调 Node 版本或缓存策略 |
| R9 | 单文档状态假设 | 多标签需要重构 `useFile`/`App` | 在 v1.1 前引入文档集合模型（§16.4） |
| R10 | ~~关闭确认使用 `window.confirm`，无"保存"选项~~ **已修复** | 用户只能丢弃或取消；样式不统一 | 改为主进程 `dialog.showMessageBox` 三态按钮（保存 / 不保存 / 取消，`cancelId` 指向取消），经 `APP_CONFIRM_DISCARD` 由渲染进程 invoke；文案三语对齐 |
| R11 | 无结构化日志/崩溃上报 | 线上问题难定位 | 主进程统一日志（分级 + 落盘），渲染进程 `window.onerror` 上报主进程 |
| R12 | ~~新建/打开不提示保存脏内容~~ **已修复** | 可能丢失未保存修改 | `useFile` 抽出 `confirmLeaveCurrentDocument()`，新建/打开/打开最近文件/关闭四条路径共用；选"保存"时执行真实写盘，写盘失败或另存为被取消则中止操作 |
| R13 | 预览外链点击处理为兜底空操作，依赖主进程拦截 | 行为耦合、可读性差 | 明确由 `setWindowOpenHandler` 负责，移除或注释化渲染层监听 |
| R14 | 5 个 Radix 包（dialog、dropdown-menu、scroll-area、toast、tooltip）已装未用 | 增大依赖体积与安装时间 | toast 已在 v0.4 用于轻量通知（§6.6），tooltip 用于工具栏提示；剩余包按需移除，或在引入对应能力时复用 |
| R15 | 图片资产无生命周期管理（仅本地模式） | 移动/重命名文档后 `assets/` 里的图片与 Markdown 断链；删除图片行不会回收文件；导出把图片内联成 `data:` 会让大图文档的 HTML/PDF 明显变大 | v0.5 的云图床模式已不再写本地 `assets/`，断链与回收问题因此只影响本地模式；仍需补"文档 → 资产"归属与孤儿清理。导出侧可加"内联/外链"开关 |

---

## 18. 架构决策记录（ADR）

### ADR-001 选择 Electron + electron-vite，而非 Tauri

- **决策**：使用 Electron 36 + electron-vite。
- **理由**：桌面 Markdown 编辑器重度依赖 DOM 渲染生态（CodeMirror、markdown-it、Mermaid、Chart.js）；Electron 可直接复用 Web 生态，且 `printToPDF` 提供开箱即用的 PDF 导出。
- **代价**：安装包与内存占用高于原生方案；需自行把握安全配置。

### ADR-002 国际化采用双轨方案

- **决策**：渲染进程用 i18next，主进程用自研 `translate()` 纯函数，共享 `messages.ts`。
- **理由**：主进程无 React 运行时，引入 i18next 不划算；纯函数零依赖、易测。
- **代价**：新增插值特性（复数、日期格式）需两端同时支持，否则表现不一致。

### ADR-003 不引入全局状态管理

- **决策**：仅用 hooks + 局部 state，跨组件状态上提到 `App`。
- **理由**：应用只有单文档、单窗口、少量设置，状态规模小；避免过早抽象。
- **代价**：`App.tsx` props 较多；多标签/多窗口到来时需要重构（R9）。

### ADR-004 语言与最近文件由主进程持有

- **决策**：`language.json`、`recent-files.json` 存 `userData`，主进程为权威源。
- **理由**：应用菜单在渲染进程就绪前构建，必须能同步读取；最近文件变更后需立即重建菜单。
- **代价**：与渲染进程 `localStorage` 形成两套存储，需要文档明确归属（§12.1）。

### ADR-005 Markdown 选用 markdown-it

- **决策**：`markdown-it` + 官方/社区插件。
- **理由**：同步 API 简单直接、插件生态成熟（脚注、emoji、KaTeX、任务列表）、性能可预期。
- **代价**：同步模型与异步图表渲染不匹配（R5），需额外水合层。

### ADR-006 DOMPurify 作为唯一 HTML 信任边界

- **决策**：所有渲染 HTML 在进入 DOM 前统一消毒；预览与导出共用同一配置。
- **理由**：`html: true` 是 Markdown 用户的高频需求，必须收敛风险。
- **代价**：消毒白名单需要随功能演进审计（如 `iframe` 的放宽）。

### ADR-007 主窗口 `sandbox: false`

- **决策**：主窗口不启用 sandbox；打印窗口启用。
- **理由**：当前预加载实现依赖非 sandbox 环境（`process.contextIsolated` 分支与本地类型声明）。
- **代价**：安全边界弱于理想状态，列为 R2 待整改。

### ADR-008 文件与导出能力全部沉淀在主进程

- **决策**：所有 fs、对话框、shell 调用只在主进程。
- **理由**：渲染进程无 Node 权限是安全基线；同时便于统一错误提示与未来审计。
- **代价**：每次文件操作的参数需可序列化，大文件需注意结构化克隆开销。

---

## 附录

### A. 主进程 IPC 处理一览

| 通道 | 入参 | 返回 | 失败行为 |
|------|------|------|----------|
| `FILE_OPEN_DIALOG` | — | `{ path, content } \| null` | `showErrorBox` + `null` |
| `FILE_OPEN_PATH` | `{ path }` | `{ path, content } \| null` | 同上 |
| `FILE_SAVE` | `{ path, content }` | `{ success }` | 同上 |
| `FILE_SAVE_AS` | `{ content }` | `{ path } \| null` | 同上 |
| `FILE_EXPORT_HTML` | `{ html, fileName? }` | `{ path } \| null` | 同上 |
| `FILE_EXPORT_PDF` | `{ html, fileName? }` | `{ path } \| null` | 打印窗口异常 → `showErrorBox` + `null`，窗口必定销毁 |
| `THEME_GET` | — | `'light' \| 'dark'` | — |
| `LOGIN_GET` / `LOGIN_SET` | `boolean` | `boolean` | 异常时返回当前/`false` |
| `LANGUAGE_SET` | `string` | `AppLanguage` | 写盘失败仍保留会话内选择 |
| `LANGUAGE_GET` | — | `AppLanguage` | `sendSync`，通过 `event.returnValue` 返回 |
| `APP_CONFIRM_DISCARD` | `string`（文档名） | `'save' \| 'discard' \| 'cancel'` | 关闭对话框等同于取消 |

### B. 本地存储键清单

| 键 | 类型 | 默认值 | 归属 |
|----|------|--------|------|
| `biu-text:appearance` | JSON | 见 §12.2 | 渲染进程 |
| `biu-text:theme-mode` | string | `system` | 渲染进程 |
| `biu-text:splitter-left-pct` | number（字符串） | `50` | 渲染进程 |
| `biu-text:preview-visible` | boolean（字符串） | `true` | 渲染进程 |

### C. 关键文件索引

| 关注点 | 文件 |
|--------|------|
| 进程与 IPC 全貌 | `src/main/index.ts`、`src/preload/index.ts`、`src/shared/ipc-channels.ts` |
| 组合根与布局 | `src/renderer/src/App.tsx` |
| 文档状态 | `src/renderer/src/hooks/useFile.ts` |
| 编辑器 | `src/renderer/src/components/Editor/index.tsx` |
| 渲染与消毒 | `src/renderer/src/components/Preview/index.tsx`、`lib/markdown.ts` |
| 导出 | `src/renderer/src/lib/export-document.ts`、`src/main/index.ts`（`FILE_EXPORT_*`） |
| 国际化 | `src/shared/i18n/*`、`src/renderer/src/i18n.ts` |
| 持久化 | `src/shared/editor-preferences.ts`、`src/shared/recent-files.ts`、`useAppearanceSettings.ts` |
| 构建 | `electron.vite.config.ts`、`tsconfig.node.json`、`tsconfig.web.json` |
| 发布 | `.github/workflows/release.yml`、`package.json`（`build` 字段） |

### D. 演进检查清单（每个版本上线前）

- [ ] 新增文案已加入三语 `messages.ts`，`check:i18n` 通过
- [ ] 新增 IPC 通道已登记到 `ipc-channels.ts`，并在 preload 门面与 `index.d.ts` 同步
- [ ] 新增持久化字段具备归一化与容错，键名使用 `biu-text:` 前缀
- [ ] 任何进入 `innerHTML` 的内容都经过 DOMPurify
- [ ] 主导航路径（新建→编辑→保存→导出→关闭）在 macOS / Windows / Linux 三平台手工验证
- [ ] 新增依赖已评估体积、许可证与是否可与现有 CSP 共存

---

*本文档随代码演进更新；与实现冲突时以代码为准，并回写 PRD 与本文。*
