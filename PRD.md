# BiuText · 产品需求文档（PRD）

> **版本**：v0.2.0　**日期**：2026-03-09　**状态**：与当前实现同步

---

## 〇、当前实现状态（与文档同步更新）

| 模块 | 状态 | 说明 |
|------|------|------|
| 分栏布局 + 拖拽分隔条 | ✅ 已实现 | 比例持久化 localStorage |
| 编辑区 CodeMirror 6 | ✅ 已实现 | 语法高亮、行号、当前行高亮、Tab 2 空格 |
| 预览区 markdown-it | ✅ 已实现 | 防抖 80ms，DOMPurify 消毒 |
| 滚动联动 | ✅ 已实现 | 编辑区→预览区比例同步 |
| 文件新建/打开/保存/另存为 | ✅ 已实现 | 菜单 + 快捷键 |
| 未保存标记与关闭确认 | ✅ 已实现 | 标题栏 ·、关闭前 confirm |
| Markdown 扩展（GFM/表格/任务列表/删除线/代码高亮/KaTeX/脚注/Emoji/自动链接） | ✅ 已实现 | 见 F-03 |
| 格式化快捷键 B/I/Code/Link | ✅ 已实现 | ⌘B ⌘I ⌘` ⌘K |
| 查找 | ✅ 已实现 | CodeMirror searchKeymap（⌘F） |
| 字数统计 + 状态栏 | ✅ 已实现 | 词/字符/行、行:列、UTF-8 |
| 主题（亮/暗/跟随系统） | ✅ 已实现 | 状态栏可循环切换 |
| 编辑器字体 / 预览字体 / 字号 / 预览主题 | ✅ 已实现 | 工具栏选择器 + localStorage |
| 多语言支持（i18n） | ❌ 未实现 | 计划支持简体中文、繁体中文、英文 |
| 最近文件 | ❌ 未实现 | 菜单中预留 |
| 导出 HTML/PDF | ❌ 未实现 | 规划见 F-06 |
| 预览区通过图标按钮打开/隐藏 | ❌ 未实现 | 工具栏图标操作，隐藏时仅显示编辑区 |
| 独立设置面板（语言、开机自启等） | ❌ 未实现 | 当前仅外观类设置 |

---

## 一、产品概述

### 1.1 产品定位

BiuText 是一款面向开发者和写作者的跨平台桌面端 Markdown 编辑器。与 Typora 的"所见即所得"模式不同，BiuText 采用**经典分栏布局**——左侧为原始 Markdown 源码编辑区，右侧为实时渲染预览区；预览区可通过**工具栏图标按钮**打开或隐藏，隐藏时仅显示编辑区以专注书写，再次点击即可恢复预览。让用户在专注源码书写的同时，随时看到最终排版效果。

### 1.2 目标用户

| 用户群体 | 使用场景 |
|----------|----------|
| 开发者 | 编写技术文档、README、API 文档 |
| 技术写作者 | 博客写作、知识沉淀 |
| 学生 / 研究者 | 笔记整理、论文提纲 |

### 1.3 核心价值主张

- **所写即所见**：左侧 Markdown 源码实时同步到右侧渲染预览，零延迟反馈
- **轻量原生**：基于 Electron 构建，启动快、性能好，无浏览器额外开销
- **键盘友好**：完整快捷键体系，高效操作无需鼠标
- **开箱即用**：安装后无需配置，支持主流 Markdown 扩展语法

---

## 二、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面壳 | Electron | 跨平台桌面运行时，主/渲染进程分离 |
| 构建工具 | Vite + electron-vite | 极速 HMR，三进程统一构建 |
| 前端框架 | React 19 + TypeScript | 组件化 UI，类型安全 |
| 样式 | Tailwind CSS v4 | 原子化 CSS，CSS 变量主题系统 |
| UI 组件库 | shadcn/ui | 基于 Radix UI 的无障碍组件 |
| 代码编辑器 | CodeMirror 6（@uiw/react-codemirror） | 高性能编辑器内核，Markdown 语法高亮 |
| Markdown 解析 | markdown-it | 高扩展性渲染引擎，配合扩展插件 |
| 扩展插件 | highlight.js、KaTeX、markdown-it-emoji/footnote/task-lists 等 | 代码高亮、数学公式、脚注、任务列表、Emoji |
| 预览安全 | DOMPurify | 渲染前对 HTML 消毒，防 XSS |
| IPC 通信 | Electron contextBridge | 安全隔离的主/渲染进程通信 |
| 国际化 | react-i18next + i18next | 多语言支持（简体中文、繁体中文、英文） |

---

## 三、功能需求

### 3.1 核心功能

#### F-01 分栏编辑器布局

- **左侧编辑区**：基于 CodeMirror 6 的 Markdown 源码编辑器
  - Markdown 语法高亮（标题、粗体、斜体、代码块、链接、列表等）
  - 行号显示
  - 当前行高亮
  - 括号/符号自动配对（`**`、`` ` ``、`[`、`(`）
  - 支持中文输入法（IME）
- **右侧预览区**：基于 markdown-it 的实时 HTML 渲染区
  - 与编辑区内容实时同步（输入防抖 80ms，满足 ≤100ms 指标）
  - 滚动位置联动（编辑区滚动，预览区按比例同步）
  - 代码块语法高亮（集成 highlight.js）
  - 渲染前经 DOMPurify 消毒，防止 XSS
- **分隔条（Splitter）**：
  - 可拖拽调整左右面板宽度比例
  - 双击分隔条恢复默认 50:50 比例
  - 记忆用户上次调整的比例
- **预览区显示控制**：
  - 工具栏提供**图标按钮**，用于打开或隐藏右侧预览区
  - 隐藏后仅显示编辑区，便于专注书写；再次点击图标可恢复预览
  - 显示/隐藏状态建议持久化（如 localStorage），下次启动时恢复用户上次选择

#### F-02 文件管理

| 功能 | 快捷键 | 说明 |
|------|--------|------|
| 新建文件 | `⌘N` / `Ctrl+N` | 创建空白 Markdown 文档 |
| 打开文件 | `⌘O` / `Ctrl+O` | 打开本地 `.md` / `.markdown` 文件 |
| 保存文件 | `⌘S` / `Ctrl+S` | 覆盖保存当前文件 |
| 另存为 | `⌘⇧S` / `Ctrl+Shift+S` | 另存为新路径 |
| 最近文件 | — | 规划中：菜单中显示最近打开的 10 个文件 |

- 文件未保存时，标题栏显示 `·` 标记（如 `README.md ·`）
- 关闭窗口前，若有未保存内容弹出确认对话框

#### F-03 Markdown 扩展语法支持

**当前版本已支持下表所列扩展。**

| 扩展 | 描述 |
|------|------|
| 标准 CommonMark | 标题、段落、列表、引用、代码、链接、图片 |
| GFM 表格 | `\| 列1 \| 列2 \|` 格式的表格 |
| 任务列表 | `- [x]` / `- [ ]` 可勾选列表（markdown-it-task-lists） |
| 删除线 | `~~文字~~` |
| 代码块高亮 | 围栏代码块 ` ```lang `，highlight.js 渲染 |
| 数学公式 | `$...$`（行内）/ `$$...$$`（块级）KaTeX 渲染 |
| 脚注 | `[^1]` 脚注语法（markdown-it-footnote） |
| Emoji | `:smile:` 转义为对应 emoji（markdown-it-emoji） |
| 自动链接 | URL 自动识别为超链接（linkify） |

#### F-04 编辑器增强功能

- **撤销 / 重做**：`⌘Z` / `⌘⇧Z`（Ctrl+Z / Ctrl+Y），无限层级（CodeMirror 内置）
- **查找**：`⌘F` 已支持（CodeMirror searchKeymap）；**替换**（`⌘H`）及正则/区分大小写/全词匹配为后续增强
- **文字统计**：实时显示字数（中文/英文分别统计）、行数、字符数
- **格式化快捷键**：
  - 粗体：`⌘B` 在选中文字两侧插入 `**`
  - 斜体：`⌘I` 插入 `*`
  - 行内代码：`` ⌘` `` 插入 `` ` ``
  - 链接：`⌘K` 插入 `[]()`
- **Tab 行为**：Tab 键插入 2 个空格（而非制表符）
- **自动缩进**：回车后保持当前列表/引用的缩进级别

#### F-05 主题与外观

- **颜色主题**：
  - 亮色（Light）、暗色（Dark）、跟随系统（System）— 工具栏与状态栏可切换，偏好持久化
- **字体设置**（工具栏选择器 + localStorage）：
  - 编辑区等宽字体：JetBrains Mono、Fira Code、Menlo
  - 预览区：无衬线（sans）/ 衬线（serif）
  - 字号：12px～24px 滑块调节
- **预览主题**：GitHub、Notion 两套 CSS 主题，与亮/暗表面联动

#### F-06 导出功能

**当前未实现，规划于 v0.3。**

| 格式 | 说明 |
|------|------|
| `.md` | 导出 Markdown 源文件（另存为已支持） |
| `.html` | 导出独立 HTML 文件（内联 CSS） |
| PDF | 通过 Electron 的 `webContents.printToPDF` 导出 |

#### F-07 应用设置

- **当前已实现**（工具栏 + localStorage）：颜色主题（亮/暗/跟随系统）、编辑器字体、预览字体、字号、预览主题（GitHub/Notion）
- **规划中**（独立设置面板，v0.3）：通用（语言、开机自启、保存间隔）、编辑器（Tab 宽度、行高、是否显示行号）、快捷键列表查看（v1.0 暂不支持自定义）

#### F-08 国际化（i18n）多语言支持

**当前未实现，规划于 v0.3。**

**支持语言**：
- 简体中文（zh-CN）- 默认
- 繁体中文（zh-TW）
- 英文（en-US）

**实现方案**：
1. **技术选型**：
   - 使用 `react-i18next` + `i18next` 实现前端国际化
   - 语言文件采用 JSON 格式存储于 `src/locales/` 目录
   - 支持命名空间（namespace）分离不同模块的翻译

2. **翻译范围**：
   - **应用界面**：菜单、工具栏、按钮、对话框、状态栏所有文本
   - **快捷键提示**：Tooltip 中的操作说明
   - **错误提示**：Toast 通知、确认对话框的消息
   - **占位符文本**：空状态提示、输入框占位符
   - **系统通知**：原生系统通知的文本内容

3. **语言切换**：
   - 在独立设置面板中提供语言选择下拉菜单
   - 切换后立即生效，无需重启应用
   - 语言偏好持久化存储至 localStorage
   - 支持跟随系统语言（首次启动时自动检测 `navigator.language`）

4. **翻译文件结构示例**：
```json
// src/locales/zh-CN/common.json
{
  "app": {
    "name": "BiuText",
    "untitled": "未命名文档"
  },
  "menu": {
    "file": "文件",
    "new": "新建",
    "open": "打开",
    "save": "保存",
    "saveAs": "另存为",
    "recentFiles": "最近文件"
  },
  "toolbar": {
    "bold": "粗体",
    "italic": "斜体",
    "code": "代码",
    "link": "插入链接",
    "togglePreview": "显示/隐藏预览区"
  },
  "statusBar": {
    "line": "行",
    "column": "列",
    "words": "词",
    "characters": "字符",
    "lines": "行数"
  },
  "dialog": {
    "unsavedChanges": {
      "title": "未保存的更改",
      "message": "您有未保存的更改，是否保存？",
      "save": "保存",
      "dontSave": "不保存",
      "cancel": "取消"
    }
  }
}
```

5. **日期时间本地化**：
   - 最近文件列表的时间显示遵循各语言习惯
   - 使用 `Intl.DateTimeFormat` API 实现

6. **字体优化**：
   - 中文界面默认使用系统 UI 字体（苹方、微软雅黑）
   - 英文界面使用 -apple-system / Segoe UI
   - 编辑器等宽字体跨语言保持一致

7. **测试策略**：
   - 确保每种语言的 UI 布局不出现文本溢出或截断
   - 验证长文本场景（如德语的复合词）下的响应式适配
   - RTL（从右到左）语言暂不支持，但保留扩展性

---

### 3.2 导航与布局

```
┌─────────────────────────────────────────────────────────────┐
│  标题栏：[AppIcon] [文件名] [· 未保存标记]    [— □ ✕]       │
├──────────────────────────────────────────────────────────────┤
│  菜单栏：[文件][编辑][查看][帮助]  （支持多语言切换）        │
├──────────────────────────────────────────────────────────────┤
│  工具栏：[新建][打开][保存] [B][I][Code][Link] [预览区开关图标] [主题/字体/字号] [字数统计] │
├───────────────────────┬──────────────────────────────────────┤
│                       │                                      │
│   左侧编辑区          │      右侧预览区                       │
│   (CodeMirror 6)      │ ┆  (markdown-it 渲染)                │
│                       │                                      │
│   # Hello BiuText     │  <h1>Hello BiuText</h1>              │
│                       │                                      │
│   这是一段 **粗体**   │  这是一段 <strong>粗体</strong>      │
│   文字。              │  文字。                              │
│                       │                                      │
├───────────────────────┴──────────────────────────────────────┤
│  状态栏：[行:列] [词] [字符] [行] [UTF-8] [字号] [预览主题] [主题模式] [语言] │
└──────────────────────────────────────────────────────────────┘
```

**多语言 UI 适配说明**：
- 菜单栏、工具栏、状态栏所有文本根据选定语言动态切换
- 对话框（如未保存提示）、Toast 通知全部支持多语言
- 占位符文本（如"开始书写..."）根据语言显示
- 快捷键提示保持跨平台一致（⌘ 对应 macOS，Ctrl 对应 Windows/Linux）

---

## 四、非功能需求

### 4.1 性能指标

| 指标 | 目标值 |
|------|--------|
| 冷启动时间 | ≤ 3 秒（SSD 环境） |
| 编辑到预览渲染延迟 | ≤ 100ms（防抖后） |
| 可流畅编辑的文件大小 | ≤ 5MB Markdown 文件无卡顿 |
| 内存占用 | 空窗口 ≤ 150MB |

### 4.2 兼容性

| 平台 | 版本要求 |
|------|----------|
| macOS | 12 Monterey 及以上 |
| Windows | 10 / 11（x64） |
| Linux | Ubuntu 20.04+ / Debian 11+（x64） |

### 4.3 安全性

- 渲染进程启用 `contextIsolation: true`，禁用 `nodeIntegration`
- 预览区 HTML 在渲染前经 **DOMPurify** 消毒，防止 XSS
- 文件读写仅通过 IPC 经由主进程完成，渲染进程无直接 fs 权限
- 外部链接通过 `shell.openExternal` 在系统浏览器打开，不在应用内渲染

### 4.4 可维护性

- 三进程代码（main / preload / renderer）清晰分离
- 所有 IPC channel 名称在 `src/shared/ipc-channels.ts` 中统一管理
- 组件遵循单一职责原则，UI 组件与业务逻辑分离
- **国际化资源管理**：
  - 翻译文件按命名空间（namespace）组织：`common`、`menu`、`dialog`、`settings` 等
  - 使用统一的翻译 key 命名规范：`模块.类别.具体项`（如 `menu.file.new`）
  - 缺失翻译时显示 key 名称（开发环境）或回退到英文（生产环境）
  - 提供翻译完整性检查脚本，确保所有语言文件的 key 保持同步

---

## 五、用户体验要求

### 5.1 交互规范

- 所有操作响应时间 ≤ 200ms，超出则显示 Loading 状态
- 错误提示使用 Toast 通知（右上角，自动消失 3 秒）
- 危险操作（删除、关闭未保存文件）必须二次确认
- 空状态：新建文档时编辑区显示占位提示文字

### 5.2 无障碍（Accessibility）

- 所有交互元素支持键盘焦点导航
- 工具栏按钮添加 `aria-label`（根据当前语言动态设置）
- 支持系统级别的高对比度模式
- **多语言无障碍**：
  - 屏幕阅读器公告（ARIA live regions）支持多语言
  - `lang` 属性随语言切换动态更新（如 `<html lang="zh-CN">`）
  - 确保不同语言下的键盘导航顺序符合阅读习惯

---

## 六、里程碑规划

| 阶段 | 版本 | 目标功能 | 状态 |
|------|------|----------|------|
| MVP | v0.1 | 分栏布局、基础 Markdown 编辑与预览、文件打开/保存、未保存提示与关闭确认 | ✅ 已完成 |
| Beta | v0.2 | 代码高亮、数学公式、脚注/Emoji/任务列表、查找（⌘F）、主题与外观（亮/暗/系统、字体、字号、预览主题） | ✅ 已完成 |
| GA | v0.3 | **多语言支持（简体中文、繁体中文、英文）**、导出 HTML/PDF、最近文件、替换（⌘H）与查找选项、独立设置面板（语言选择等） | 🚧 进行中 |
| 增强 | v1.0 | 多标签页、预览区通过图标按钮打开/隐藏、文件树侧边栏、插件机制（预研） | 规划中 |

**v0.3 多语言支持的优先级**：
- 🔥 **P0**（必须完成）：UI 文本翻译（菜单、工具栏、对话框）、语言切换功能、简体中文 + 英文支持
- ⭐ **P1**（强烈推荐）：繁体中文支持、错误提示国际化、占位符文本翻译
- 💡 **P2**（可选）：日期时间本地化、翻译完整性检查脚本

---

## 七、开放问题（待讨论）

| # | 问题 | 优先级 |
|---|------|--------|
| Q1 | 是否支持多标签页（类似 VSCode）？ | 中 |
| Q2 | 是否需要内置文件树/文件夹管理功能？ | 中 |
| Q3 | 图片粘贴后是否自动保存到本地 `assets/` 目录？ | 高 |
| Q4 | 是否支持 Vim / Emacs 键位模式？ | 低 |
| Q5 | 云同步（iCloud / Dropbox）是否纳入规划？ | 低 |
| Q6 | 是否支持更多语言（如日文、韩文、德文、法文）？ | 中 |
| Q7 | 繁体中文是否需要区分台湾、香港地区的用词差异？ | 低 |
| Q8 | 是否支持用户自定义翻译或贡献翻译？ | 低 |

---

## 八、附录：多语言实现技术细节

### A.1 依赖库安装

```json
// package.json 需新增的依赖
{
  "dependencies": {
    "i18next": "^23.17.0",
    "react-i18next": "^15.3.0"
  }
}
```

### A.2 目录结构

```
src/
├── locales/
│   ├── zh-CN/           # 简体中文
│   │   ├── common.json  # 通用文本
│   │   ├── menu.json    # 菜单
│   │   ├── dialog.json  # 对话框
│   │   └── settings.json # 设置面板
│   ├── zh-TW/           # 繁体中文
│   │   └── ...
│   ├── en-US/           # 英文
│   │   └── ...
│   └── index.ts         # i18n 配置入口
├── hooks/
│   └── useI18n.ts       # 自定义国际化 Hook
└── components/
    └── LanguageSwitcher.tsx # 语言切换组件
```

### A.3 核心配置示例

```typescript
// src/locales/index.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './zh-CN'
import zhTW from './zh-TW'
import enUS from './en-US'

// 从 localStorage 读取用户偏好，或检测系统语言
const savedLanguage = localStorage.getItem('app-language')
const systemLanguage = navigator.language // 如 "zh-CN", "en-US"
const defaultLanguage = savedLanguage || systemLanguage || 'zh-CN'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': zhCN,
      'zh-TW': zhTW,
      'en-US': enUS
    },
    lng: defaultLanguage,
    fallbackLng: 'en-US',
    interpolation: {
      escapeValue: false // React 已转义
    }
  })

export default i18n
```

### A.4 组件使用示例

```tsx
// 工具栏按钮示例
import { useTranslation } from 'react-i18next'

function ToolbarButton() {
  const { t } = useTranslation('common')
  
  return (
    <button aria-label={t('toolbar.bold')} title={t('toolbar.bold')}>
      <BoldIcon />
    </button>
  )
}
```

### A.5 语言切换逻辑

```typescript
// 切换语言并持久化
function changeLanguage(lang: 'zh-CN' | 'zh-TW' | 'en-US') {
  i18n.changeLanguage(lang)
  localStorage.setItem('app-language', lang)
  document.documentElement.lang = lang // 更新 HTML lang 属性
}
```

### A.6 翻译完整性检查脚本

```javascript
// scripts/check-i18n.js
// 检查所有语言文件的 key 是否完整对齐
const fs = require('fs')
const path = require('path')

const languages = ['zh-CN', 'zh-TW', 'en-US']
const namespaces = ['common', 'menu', 'dialog', 'settings']

// ... 实现 key 对比逻辑，输出缺失的翻译
```

---

*本文档由产品团队维护，如有更新请同步通知开发和设计团队。*
