# BiuText · 产品需求文档（PRD）

> **版本**：v0.4.0　**日期**：2026-11-06　**状态**：规划扩展版

---

## 〇、当前实现状态（与文档同步更新）

| 模块 | 状态 | 说明 |
|------|------|------|
| 分栏布局 + 拖拽分隔条 | ✅ 已实现 | 比例持久化 localStorage |
| 编辑区 CodeMirror 6 | ✅ 已实现 | 语法高亮、行号、当前行高亮、Tab 可配置 |
| 预览区 markdown-it | ✅ 已实现 | 防抖 80ms，DOMPurify 消毒 |
| 滚动联动 | ✅ 已实现 | 编辑区→预览区比例同步 |
| 文件新建/打开/保存/另存为 | ✅ 已实现 | 菜单 + 快捷键 |
| 未保存标记与三态确认 | ✅ 已实现 | 标题栏 ·；新建/打开/关闭统一弹「保存 / 不保存 / 取消」原生对话框 |
| Markdown 扩展（GFM/表格/任务列表/删除线/代码高亮/KaTeX/脚注/Emoji/自动链接） | ✅ 已实现 | 见 F-03 |
| 格式化快捷键 B/I/Code/Link | ✅ 已实现 | ⌘B ⌘I ⌘` ⌘K |
| 查找 + 替换 | ✅ 已实现 | ⌘F / ⌘H，支持正则/大小写/全词匹配 |
| 字数统计 + 状态栏 | ✅ 已实现 | 词/字符/行、行:列、UTF-8 |
| 主题（亮/暗/跟随系统） | ✅ 已实现 | 状态栏可循环切换 |
| 编辑器字体 / 预览字体 / 字号 / 预览主题 | ✅ 已实现 | 设置面板选择器 + localStorage |
| 多语言支持（简体中文/繁体中文/英文） | ✅ 已实现 | react-i18next，跟随系统或手动切换 |
| 最近文件（含打开时间） | ✅ 已实现 | 菜单最近 10 个文件 + 时间戳 |
| 导出 HTML/PDF | ✅ 已实现 | ⌘⇧E / ⌘⇧P，printToPDF |
| 预览区通过图标按钮打开/隐藏 | ✅ 已实现 | 工具栏图标操作，状态持久化 |
| 独立设置面板 | ✅ 已实现 | 语言、开机自启、自动保存、Tab 宽度、行高、行号、图片存储方式 |
| 图片粘贴/上传（PicGo 风格） | 🟡 本地已实现 | 粘贴/拖放/工具栏插入写入文档同目录 `assets/`，导出内联图片；云图床见 F-09 与 v0.5 |
| 图表支持（Mermaid / ChartJS / Graphviz） | 🟡 Mermaid 已实现 | 预览与导出均为内联 SVG，失败降级为源码 + 错误提示；ChartJS/Graphviz 计划 v1.0，见 F-10 |
| 编辑器内图表可视化（Typora 风格） | ❌ 未实现 | 规划见 F-11 |
| 多标签页 | ❌ 未实现 | 规划见 v1.1 |

---

## 一、产品概述

### 1.1 产品定位

BiuText 是一款面向开发者和写作者的**现代跨平台桌面端 Markdown 编辑器**，融合了 **Typora 的所见即所得体验** + **PicGo 的图片管理能力** + **Mermaid/图表的可视化支持**。

**核心特色**：
- **经典分栏布局**：左侧源码编辑区（CodeMirror 6）+ 右侧实时预览区（markdown-it），预览区可隐藏以专注书写
- **编辑器内可视化增强**（Typora 风格）：图片内联显示、图表（Mermaid/ChartJS）即时渲染、所见即所得的即时反馈
- **图片管理**（PicGo 集成）：粘贴/拖拽自动上传、支持本地/云存储（阿里云 OSS、腾讯云 COS、七牛云、自定义图床）
- **图表生态**：Mermaid 流程图/时序图、ChartJS 数据图表、Graphviz、Excalidraw 手绘图

让用户在享受源码控制的同时，获得富文本编辑器般的直观体验。

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
| **图表渲染** | **Mermaid（✅ 已引入）+ react-chartjs-2、Excalidraw（规划）** | **Mermaid 流程图/时序图已支持；数据图表与手绘图规划 v1.0+** |
| **图片管理** | **PicGo Core / 自研上传模块** | **本地/云存储自动上传、CDN 集成（规划 v0.4+，尚未引入依赖）** |
| **编辑器增强** | **CodeMirror 6 Widget / Decoration API** | **图片/图表内联可视化显示（规划 v1.0）** |

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
  - 显示/隐藏状态已持久化至 localStorage，下次启动时恢复用户上次选择

#### F-02 文件管理

| 功能 | 快捷键 | 说明 |
|------|--------|------|
| 新建文件 | `⌘N` / `Ctrl+N` | 创建空白 Markdown 文档 |
| 打开文件 | `⌘O` / `Ctrl+O` | 打开本地 `.md` / `.markdown` / `.txt` 文件 |
| 保存文件 | `⌘S` / `Ctrl+S` | 覆盖保存当前文件 |
| 另存为 | `⌘⇧S` / `Ctrl+Shift+S` | 另存为新路径 |
| 最近文件 | — | 菜单中显示最近打开的 10 个文件（含打开时间） |

- 文件未保存时，标题栏显示 `·` 标记（如 `README.md ·`）
- 新建、打开（含最近文件）或关闭窗口前，若有未保存内容弹出「保存 / 不保存 / 取消」三态对话框；选择「保存」会先写盘，写盘失败或取消另存为则中止操作

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

- **撤销 / 重做**：`⌘Z` / `⌘⇧Z`（Ctrl+Z / Ctrl+Y），多级撤销历史，深度可配置（CodeMirror 6 history）
- **查找 + 替换**：
  - `⌘F` 查找、`⌘H` 替换（已支持）
  - 支持正则表达式、区分大小写、全词匹配（CodeMirror 内置选项）
  - 查找/替换面板跟随语言切换（见 `search-phrases.ts`）
- **文字统计**：实时显示字数（中文/英文分别统计）、行数、字符数
- **格式化快捷键**：
  - 粗体：`⌘B` 在选中文字两侧插入 `**`
  - 斜体：`⌘I` 插入 `*`
  - 行内代码：`` ⌘` `` 插入 `` ` ``
  - 链接：`⌘K` 插入 `[]()`
- **Tab 行为**：Tab 键插入可配置空格数（2/4/8，默认 2）
- **自动缩进**：回车后保持当前列表/引用的缩进级别
- **行高可调**：设置面板调节 1.2～2.0（步长 0.1）
- **行号显示**：设置面板开关

#### F-05 主题与外观

- **颜色主题**：
  - 亮色（Light）、暗色（Dark）、跟随系统（System）— 工具栏与状态栏可切换，偏好持久化
- **字体设置**（设置面板选择器 + localStorage）：
  - 编辑区等宽字体：JetBrains Mono、Fira Code、Menlo
  - 预览区：无衬线（sans）/ 衬线（serif）
  - 字号：12px～24px 滑块调节
- **预览主题**：GitHub、Notion 两套 CSS 主题，与亮/暗表面联动

#### F-06 导出功能

**当前已实现（v0.3.1）。**

| 格式 | 快捷键 | 说明 |
|------|--------|------|
| `.md` | — | 导出 Markdown 源文件（另存为已支持） |
| `.html` | `⌘⇧E` | 导出独立 HTML 文件（内联 CSS） |
| PDF | `⌘⇧P` | 通过 Electron 的 `webContents.printToPDF` 导出 |

**未来增强（v1.0）**：
- 导出前预览：显示渲染后效果预览，可调整样式参数
- 自定义模板：支持用户自定义 HTML/PDF 导出模板
- 批量导出：选择多个文件批量转换

#### F-07 应用设置

- **当前已实现**（v0.3.1 独立设置面板 + localStorage）：
  - **通用**：语言选择（简体中文/繁体中文/英文）、开机自启、自动保存间隔（关闭/30秒/1分钟/5分钟）
  - **外观**：颜色主题（亮/暗/跟随系统）、预览主题（GitHub/Notion）
  - **字体**：编辑器字体（JetBrains Mono/Fira Code/Menlo）、预览字体（无衬线/衬线）、字号（12px～24px）
  - **编辑器**：Tab 宽度（2/4/8）、行高（1.2～2.0）、显示行号（开关）
- **规划中**（v1.0）：
  - 快捷键列表查看（暂不支持自定义绑定）
  - 插件管理面板（预研中）

#### F-08 国际化（i18n）多语言支持

**当前已实现（v0.3.1）。**

**支持语言**：
- 简体中文（zh-CN）- 非中文系统默认英文
- 繁体中文（zh-TW）
- 英文（en-US）

**实现方案**：
1. **技术选型**：
   - 使用 `react-i18next` + `i18next` 实现前端国际化
   - 语言文件采用 TypeScript 对象形式存储于 `src/shared/i18n/messages.ts`
   - 主进程菜单通过 `menu-template.ts` 动态生成

2. **翻译范围**：
   - **应用界面**：菜单、工具栏、按钮、对话框、状态栏所有文本 ✅
   - **快捷键提示**：Tooltip 中的操作说明 ✅
   - **错误提示**：主进程原生错误对话框（`dialog.showErrorBox`）与关闭确认对话框的消息 ✅
   - **占位符文本**：空状态提示、输入框占位符 ✅
   - **查找/替换面板**：通过 `search-phrases.ts` 跟随语言切换 ✅

3. **语言切换**：
   - 在独立设置面板中提供语言选择下拉菜单 ✅
   - 切换后立即生效，无需重启应用 ✅
   - 语言偏好由主进程持久化至 `userData/language.json`，渲染进程经 IPC 读写 ✅
   - 支持跟随系统语言（首次启动时由主进程 `app.getLocale()` 检测） ✅

4. **翻译文件结构**：
```typescript
// src/shared/i18n/messages.ts
const zhCN = {
  menu: { file: '文件', new: '新建', ... },
  dialog: { openFile: '打开文件', ... },
  toolbar: { bold: '粗体', italic: '斜体', ... },
  settings: { title: '设置', language: '语言', ... },
  // ...
} satisfies MessageTree

export const messages = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en-US': enUS
}
```

5. **日期时间本地化**：
   - 最近文件列表的时间显示遵循各语言习惯 ✅
   - 使用 `Intl.DateTimeFormat` API 实现（见 `recent-files.ts`）

6. **字体优化**：
   - 中文界面默认使用系统 UI 字体（苹方、微软雅黑）
   - 英文界面使用 -apple-system / Segoe UI
   - 编辑器等宽字体跨语言保持一致

7. **测试完整性**：
   - 提供 `npm run check:i18n` 脚本检查翻译完整性
   - 确保每种语言的 UI 布局不出现文本溢出或截断
   - RTL（从右到左）语言暂不支持，但保留扩展性

#### F-09 图片功能（PicGo 集成）

**目标**：对标 PicGo 的图片管理能力，让用户粘贴/拖拽图片后自动上传到图床并插入 Markdown 链接。

**当前进度**：本地存储模式已落地（v0.4）——粘贴/拖放/工具栏插入都会写入文档同目录的 `assets/` 并插入相对路径，导出时内联为 `data:` URI；下文的云图床、压缩、重命名规则与上传历史属于 v0.5 及以后。

**核心功能**：

1. **粘贴上传**：
   - `⌘V` 粘贴剪贴板图片，自动触发上传流程
   - 上传中显示占位符（如 `![uploading...]()`），上传成功后替换为实际 URL
   - 上传失败显示错误提示，保留本地 base64 或路径作为降级方案

2. **拖拽上传**：
   - 编辑区支持拖拽图片文件（`.png`、`.jpg`、`.gif`、`.webp`、`.svg`）
   - 拖拽时显示高亮提示区域
   - 松开后自动上传并插入链接

3. **图床支持**（可扩展）：
   | 图床类型 | 说明 |
   |---------|------|
   | 本地存储 | 保存到当前文档目录的 `assets/` 文件夹，使用相对路径 |
   | 阿里云 OSS | AccessKey + Bucket 配置 |
   | 腾讯云 COS | SecretId + Bucket 配置 |
   | 七牛云 Kodo | AccessKey + Bucket 配置 |
   | 又拍云 USS | Operator + Password 配置 |
   | GitHub | Token + 仓库路径（通过 GitHub API 上传到 repo） |
   | 自定义图床 | 用户配置 POST 接口 URL + 请求头/参数 |

4. **图床配置面板**（设置面板新增"图床"标签页）：
   - 选择默认图床类型（下拉菜单）
   - 各图床的凭证输入框（加密存储）
   - 测试连接按钮（验证配置是否正确）
   - 图片压缩选项：上传前自动压缩（开关 + 质量滑块 60%～100%）
   - 图片重命名规则：时间戳 / UUID / 原文件名

5. **上传历史**（v1.1 增强）：
   - 菜单 → 图片历史，显示最近 50 张上传记录
   - 列表显示：缩略图、文件名、上传时间、URL
   - 右键菜单：复制 URL、复制 Markdown、删除记录

6. **安全性**：
   - 图床凭证使用 Electron `safeStorage` 加密存储
   - 上传前检查文件大小（默认限制 10MB，可配置）
   - HTTPS 上传，防止中间人攻击

**技术实现方案**：
- **方案一（推荐）**：集成 PicGo Core（`picgo`），复用其成熟的图床插件生态
- **方案二**：自研轻量上传模块，仅支持主流图床（减少依赖体积）

---

#### F-10 图表支持（Mermaid + ChartJS + Graphviz + Excalidraw）

**目标**：支持主流图表语法，在预览区实时渲染，提升技术文档写作体验。

**支持的图表类型**：

1. **Mermaid 流程图/时序图**（优先级 P0）：
   ````markdown
   ```mermaid
   graph TD
       A[开始] --> B{判断}
       B -->|是| C[执行]
       B -->|否| D[结束]
   ```
   ````
   - 支持流程图（`graph`）、时序图（`sequenceDiagram`）、甘特图（`gantt`）、类图（`classDiagram`）、状态图（`stateDiagram`）
   - 预览区使用 `mermaid.js` 实时渲染 SVG
   - 导出 HTML/PDF 时保留 SVG 图表

2. **ChartJS 数据图表**（优先级 P1）：
   ````markdown
   ```chartjs
   {
     "type": "bar",
     "data": {
       "labels": ["一月", "二月", "三月"],
       "datasets": [{
         "label": "销售额",
         "data": [12, 19, 3]
       }]
     }
   }
   ```
   ````
   - 支持柱状图、折线图、饼图、雷达图等
   - 预览区使用 Canvas 渲染，可交互（悬停显示数值）

3. **Graphviz DOT 语法**（优先级 P2）：
   ````markdown
   ```dot
   digraph G {
     A -> B -> C;
     B -> D;
   }
   ```
   ````
   - 使用 `viz.js` 或 `@viz-js/viz` 渲染复杂网络图
   - 适用于数据结构、网络拓扑图

4. **Excalidraw 手绘图**（优先级 P2，v1.1）：
   - 工具栏新增"插入手绘图"按钮，打开 Excalidraw 编辑器
   - 编辑完成后导出为 SVG + JSON（保留可编辑性）
   - Markdown 中插入自定义代码块：
     ````markdown
     ```excalidraw
     {"elements":[...], "appState":{...}}
     ```
     ````

**渲染流程**：
1. 编辑区输入图表代码块（`` ```mermaid ``）
2. `markdown-it` 解析时识别代码块类型，输出占位块（同步）
3. 预览提交后由水合层调用对应图表库渲染（异步）
4. 渲染失败时显示原始代码块 + 错误提示

**技术依赖**：
- `mermaid@^12.3.0`（✅ 已引入，懒加载）
- `chart.js@^4.0.0` + `react-chartjs-2`
- `@viz-js/viz@^3.0.0`（Graphviz）
- `@excalidraw/excalidraw`（v1.1）

---

#### F-11 编辑器内可视化增强（Typora 风格）

**目标**：在编辑区内直接显示图片缩略图、图表预览，提供类似 Typora 的"所见即所得"即时反馈。

**核心特性**：

1. **图片内联显示**：
   - 当光标不在图片行时，将 `![alt](url)` 替换为实际图片缩略图（100px 高度）
   - 悬停显示完整尺寸预览（Tooltip）
   - 点击图片进入编辑模式（显示原始 Markdown 语法）
   - 实现：CodeMirror 6 的 **Decoration API**（`WidgetType` 插入 DOM 元素）

2. **图表即时预览**（Mermaid 优先）：
   - 当光标不在图表代码块时，将 `` ```mermaid `` 代码块替换为渲染后的 SVG
   - 代码块左上角显示"源码 ↔ 预览"切换按钮
   - 点击代码块进入编辑模式（显示原始代码）
   - 实现：CodeMirror 6 的 **Block Decoration**（替换整个代码块）

3. **链接预览**（v1.1 增强）：
   - 悬停在 `[text](url)` 时显示 URL 预览卡片（Open Graph 元数据）
   - 支持内部链接跳转（`[section](#heading)`）

4. **表格实时渲染**（v1.1 增强）：
   - GFM 表格在编辑区以半透明的表格样式覆盖显示
   - 点击表格单元格进入编辑模式

**实现技术**：
- **CodeMirror 6 ViewPlugin**：
  - `ViewUpdate` 监听文档变化
  - `syntaxTree()` 解析 Markdown AST，识别图片/图表节点
  - `Decoration.replace()` 或 `Decoration.widget()` 插入可视化元素
- **图片懒加载**：使用 `IntersectionObserver` 仅渲染可见区域
- **缓存机制**：图表渲染结果缓存到内存，避免重复计算

**用户体验优化**：
- 提供设置选项"编辑器可视化增强"（开关），关闭后恢复纯文本模式
- 图片显示失败时显示 🖼️ 占位符 + 错误提示
- 图表渲染失败时显示原始代码 + 红色边框警告

---

### 3.2 导航与布局

```
┌─────────────────────────────────────────────────────────────┐
│  标题栏：[AppIcon] [文件名] [· 未保存标记]    [— □ ✕]       │
├──────────────────────────────────────────────────────────────┤
│  菜单栏：[文件][编辑][查看][图片][帮助]  （支持多语言切换）  │
├──────────────────────────────────────────────────────────────┤
│  工具栏：[新建][打开][保存] [导出HTML][导出PDF] [B][I][Code][Link] [插入图片] [插入图表] [预览区开关] [设置] [字数统计] │
├───────────────────────┬──────────────────────────────────────┤
│                       │                                      │
│   左侧编辑区          │      右侧预览区                       │
│   (CodeMirror 6)      │ ┆  (markdown-it 渲染)                │
│                       │                                      │
│   # Hello BiuText     │  <h1>Hello BiuText</h1>              │
│                       │                                      │
│   ![图片](url)        │  [实际渲染的图片]                     │
│   ↑ 编辑区显示缩略图   │                                      │
│                       │                                      │
│   ```mermaid          │  [Mermaid 渲染的流程图]               │
│   graph TD            │                                      │
│   A --> B             │                                      │
│   ```                 │                                      │
│   ↑ 光标移开时显示图表 │                                      │
│                       │                                      │
├───────────────────────┴──────────────────────────────────────┤
│  状态栏：[行:列] [词] [字符] [行] [UTF-8] [字号] [预览主题] [主题模式] [语言] │
└──────────────────────────────────────────────────────────────┘
```

> 上图为 v1.0 目标布局。当前状态栏实际为 `[行:列] [词] [字符] [行]` 与右侧 `[UTF-8] [语言] [字号] [预览主题] [主题模式]`；其中语言、字号、预览主题在状态栏仅作展示，修改入口位于设置面板。
>
> 菜单栏为全平台共有：macOS 显示在系统菜单栏，Windows/Linux 默认收起（`autoHideMenuBar`），按 `Alt` 唤出；菜单加速键在两个平台都生效。

**多语言 UI 适配说明**：
- 菜单栏、工具栏、状态栏所有文本根据选定语言动态切换
- 对话框（如未保存提示）、Toast 通知全部支持多语言
- 占位符文本（如"开始书写..."）根据语言显示
- 快捷键提示保持跨平台一致（⌘ 对应 macOS，Ctrl 对应 Windows/Linux）
- 图片上传/图表渲染的错误提示多语言化

---

## 四、非功能需求

### 4.1 性能指标

| 指标 | 目标值 |
|------|--------|
| 冷启动时间 | ≤ 3 秒（SSD 环境） |
| 编辑到预览渲染延迟 | ≤ 100ms（防抖后） |
| **Mermaid / 图表渲染** | 单图首次 ≤ 500ms，命中缓存 ≤ 50ms；渲染不阻塞输入 |
| **图片粘贴（本地模式）** | 写入 `assets/` 并插入链接 ≤ 300ms |
| **图片上传（云图床）** | 5MB 以内单图 ≤ 3s（取决于网络），全程显示进度 |
| 可流畅编辑的文件大小 | ≤ 5MB Markdown 文件无卡顿 |
| 大文档图表 | 含 50 个 Mermaid 块的文档滚动无明显掉帧（懒渲染） |
| 内存占用 | 空窗口 ≤ 150MB；含大量图表时 ≤ 300MB |

### 4.2 兼容性

| 平台 | 版本要求 |
|------|----------|
| macOS | 12 Monterey 及以上 |
| Windows | 10 / 11（x64） |
| Linux | Ubuntu 20.04+ / Debian 11+（x64） |

### 4.3 安全性

- 渲染进程启用 `contextIsolation: true`，禁用 `nodeIntegration`；主窗口当前为 `sandbox: false`（打印/导出子窗口为 `sandbox: true`），开启 sandbox 列为后续评估项
- 预览区 HTML 在渲染前经 **DOMPurify** 消毒，防止 XSS
- 文件读写仅通过 IPC 经由主进程完成，渲染进程无直接 fs 权限
- 外部链接通过 `shell.openExternal` 在系统浏览器打开，不在应用内渲染
- **图床凭证**：AccessKey / Token 等敏感字段使用 Electron `safeStorage` 加密后落盘，渲染进程只能读取脱敏值（如 `AKID****9f2c`），上传请求由主进程发起
- **网络请求**：仅允许 HTTPS 图床端点；自定义图床需用户显式填写 URL，不做任何默认上报
- **Mermaid**：初始化时设置 `securityLevel: 'strict'`，禁用图表内 HTML 标签与点击回调
- **SVG 消毒**：图表输出的 SVG 经 DOMPurify（`USE_PROFILES: { svg: true, svgFilters: true }`）消毒后再插入 DOM
- **本地图片**：预览区只允许加载当前文档目录及其子目录下的相对路径图片，阻止 `file://` 任意路径读取（已实现：相对路径经 `biu-image://` 自定义协议由主进程解析，绝对路径、越级路径、软链接逃逸与非图片扩展名一律拒绝）

### 4.4 可维护性

- 三进程代码（main / preload / renderer）清晰分离
- 所有 IPC channel 名称在 `src/shared/ipc-channels.ts` 中统一管理
- 组件遵循单一职责原则，UI 组件与业务逻辑分离
- **国际化资源管理**：
  - 文案集中在 `src/shared/i18n/messages.ts`，以 `zhCN` 为基准，`enUS` / `zhTW` 通过 `satisfies typeof zhCN` 在编译期保证 key 对齐
  - key 按模块分组：`menu`、`dialog`、`toolbar`、`settings`、`status`、`editor` 等；新增功能（图片、图表）新增 `image`、`diagram` 分组
  - `npm run check:i18n` 已提供本地校验脚本，并已接入 CI（`.github/workflows/ci.yml` 的 `quality` job）；打包发布前必须通过 lint / typecheck / test / check:i18n / build 五项检查
- **图表/图床扩展性**：图表渲染器、图床上传器均以统一接口注册（见附录 B、C），新增类型无需改动核心编辑器

---

## 五、用户体验要求

### 5.1 交互规范

- 所有操作响应时间 ≤ 200ms，超出则显示 Loading 状态
- 提示分两层：可能丢数据或需要用户决策的场景（打开失败、保存失败、未保存确认）用系统原生对话框（`dialog.showErrorBox` / `dialog.showMessageBox`）；轻量反馈（图片保存失败、导出成功/失败）用右上角 Toast，3 秒自动消失，可手动关闭，同一时刻最多保留 3 条
- 危险操作（删除、关闭未保存文件）必须二次确认
- 空状态：新建文档时编辑区显示占位提示文字
- **图片上传反馈**：
  - 本地粘贴：立即插入链接，无 Loading（≤ 300ms）
  - 云图床：插入占位符 `![上传中...](uploading)`，显示进度条，完成后替换为真实 URL；失败时显示 ❌ + 重试按钮
- **拖放高亮**：拖拽图片进入编辑区时显示蓝色虚线边框提示投放区域
- **图表错误状态**：
  - 渲染失败时预览区显示红色边框 + 原始代码 + 错误原因（如 `Syntax error: unexpected token`）
  - 编辑区内光标在图表块内时显示实时语法错误提示（如 Mermaid 语法检查）

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

| 阶段 | 版本 | 目标功能 | 优先级 | 状态 |
|------|------|----------|-------|------|
| MVP | v0.1 | 分栏布局、基础编辑与预览、文件打开/保存 | - | ✅ 已完成 |
| Beta | v0.2 | 代码高亮、数学公式、脚注/Emoji/任务列表、查找、主题与外观 | - | ✅ 已完成 |
| GA | v0.3 | **多语言**（简中/繁中/英文）、导出 HTML/PDF、最近文件、替换、设置面板 | - | ✅ 已完成（v0.3.1） |
| 图表 | **v0.4** | Mermaid 渲染、本地图片粘贴/拖放（`assets/`）、图床设置 UI、Toast 通知 | **P0** | ✅ 已完成 |
| 图床 | **v0.5** | 云图床上传（阿里云 OSS / 腾讯云 COS / 七牛 / 又拍 / GitHub / 自定义）、批量上传 | **P1** | 📅 计划中 |
| 可视化 | **v1.0** | Typora 风格内联渲染、ChartJS、Graphviz DOT、导出预览模式 | **P1-P2** | 📅 计划中 |
| 增强 | **v1.1** | 多标签页、文件树侧边栏、Excalidraw、插件机制（预研） | **P2** | 📅 计划中 |

### 各版本详细规划

#### v0.3.1（已完成 ✅）
- 三语言切换（zh-CN / zh-TW / en-US）
- 最近文件显示打开时间
- 查找/替换多语言化
- 设置面板（通用、外观、编辑器、字体）
- 开机自启、自动保存、Tab 宽度、行高、行号

#### v0.4（图表基础，P0）
**核心目标**：Mermaid + 本地图片流程跑通
- [x] **Mermaid 渲染**（已完成）：`mermaid@^12.3` 懒加载，markdown-it fence 规则输出占位块，提交后异步水合（见附录 B）；导出 HTML/PDF 时预水合为内联 SVG
- [x] **图片粘贴**（本地模式，已完成）：自动保存到 `<文档目录>/assets/`，插入相对路径链接；未保存的文档会先触发另存为
- [x] **图片拖放**（本地，已完成）：拖入时显示虚线高亮区，松开后落盘并插入；非图片文件忽略
- [x] **图床设置 UI**（已完成）：「本地」模式可选，云图床选项置灰占位
- [x] 多语言新增 `diagram.*` 与 `image.*` 分组（已完成）
- [x] **工具栏新增「插入图片」按钮**（已完成，走系统选图对话框）
- [x] **工具栏新增「插入 Mermaid」按钮**（已完成，插入最小流程图脚手架，光标落在围栏之后）
- [x] **轻量 Toast 通知**（已完成，见 5.1）：图片保存失败、导出成功/失败走右上角 Toast，3 秒自动消失

**交付标准**：粘贴图片立即可在预览区显示，导出 HTML/PDF 时图片一并内联（✅ 已达成）；输入 `mermaid` 代码块后预览区渲染流程图，语法错误时显示错误提示（✅ 已达成，源码保留 + 错误说明）；导出与图片保存的结果以 Toast 反馈（✅ 已达成）

#### v0.5（云图床，P1）
**核心目标**：图片上传云端
- [ ] 图床后端：F-09 列出的全部云图床 + 自定义 HTTP 图床
- [ ] 上传进度条与重试机制
- [ ] 凭证管理：`safeStorage` 加密存储 AK/SK
- [ ] 批量上传（选中多张本地图片，Ctrl+V 批量粘贴）
- [ ] 测试连接功能

**交付标准**：粘贴图片自动上传到云图床并返回 URL；断网/失败时可重试

#### v1.0（可视化增强，P1-P2）
**核心目标**：Typora 风格 + 更多图表类型
- [ ] **Typora 内联渲染**（P1）：
  - 编辑区图片显示缩略图（ViewPlugin + WidgetType）
  - Mermaid 块光标移开时原位渲染小图（Decoration）
  - 点击图表块切换源码/预览模式
- [ ] **ChartJS**（P1）：复用附录 B 的渲染器注册机制 + `chart.js`，支持柱状图/折线图/饼图
- [ ] **Graphviz DOT**（P2）：`@viz-js/viz` WASM 渲染
- [ ] **导出增强**：HTML 导出内联 SVG；PDF 保留图表清晰度
- [ ] 设置面板新增：「启用内联渲染」开关（默认开启）

**交付标准**：编辑区内看到图片缩略图和 Mermaid 实时预览；ChartJS 配置块渲染为图表

#### v1.1（工作区增强，P2）
**核心目标**：多文档管理 + 手绘风格图表
- [ ] 多标签页（类似 VSCode），Cmd/Ctrl+1-9 快速切换
- [ ] 文件树侧边栏（打开文件夹，树形展示，点击打开）
- [ ] Excalidraw 手绘图表（独立弹窗编辑，导出为 SVG 嵌入 Markdown）
- [ ] 插件机制预研：自定义图床插件、自定义渲染器接口
- [ ] 上传历史面板（侧边栏，支持复制链接/删除记录）

**交付标准**：可同时打开 5 个标签页无卡顿；文件树支持右键重命名/删除

---

## 七、开放问题（待讨论）

| # | 问题 | 优先级 | 倾向方案 |
|---|------|--------|---------|
| Q1 | 是否直接依赖 PicGo Core，还是自研轻量上传模块？ | 高 | **自研**，减少依赖体积，按需支持主流图床 |
| Q2 | 是否支持全 WYSIWYG 编辑模式（完全隐藏 Markdown 源码）？ | 中 | v1.0 提供「内联渲染」折中方案，源码模式随时可见 |
| Q3 | ChartJS / Excalidraw 是否支持实时预览（编辑 JSON 时动态更新）？ | 中 | v1.0 支持 ChartJS 实时预览；Excalidraw 在独立窗口编辑 |
| Q4 | 是否支持 Vim / Emacs 键位模式？ | 低 | v1.1 后考虑，CodeMirror 6 支持 keymap 扩展 |
| Q5 | 云同步（iCloud / Dropbox）是否纳入规划？ | 低 | 暂不内置，用户自行使用系统云盘同步文件夹 |
| Q6 | 是否支持更多语言（如日文、韩文、德文、法文）？ | 中 | v1.1 后由社区贡献，提供翻译模板 |
| Q7 | 繁体中文是否需要区分台湾、香港地区的用词差异？ | 低 | 当前 `zh-TW` 使用台湾用词，暂不区分香港粤语 |
| Q8 | 多标签页是否需要支持拖拽排序 / 拆分为新窗口？ | 中 | v1.1 支持标签拖拽排序，拆分窗口 v2.0 考虑 |
| Q9 | 图表语法冲突（如 Mermaid vs Graphviz 都用 `graph`）时如何处理？ | 高 | 使用不同代码块标识符（`mermaid` / `dot` / `chartjs`），避免冲突 |
| Q10 | 图床上传失败时是否自动降级到本地 `assets/`？ | 高 | **否**，保留占位符 + 重试按钮，避免意外本地化云端文档 |

---

## 八、附录

### A. 实际 i18n 实现架构（双轨方案）

BiuText 采用**混合 i18n 方案**，核心代码在 `src/shared/i18n/`：

- **渲染进程**：使用 `react-i18next`（React hooks + 组件化）
- **主进程**：使用自研 `translate(language, key, vars)` 纯函数（供菜单模板同步调用）

两者**共享同一份 `messages.ts` 文案**，通过 `satisfies typeof zhCN` 保证编译期 key 对齐。

#### A.1 技术栈
- **类型定义**：`types.ts` 定义 `AppLanguage` = `'zh-CN' | 'zh-TW' | 'en-US'` 和 `MessageTree` 递归类型
- **翻译文件**：`messages.ts` 导出 `messages: Record<AppLanguage, MessageTree>`，三语文案以 `zhCN` 为基准，`enUS` / `zhTW` 通过 `satisfies typeof zhCN` 实现编译期 key 对齐
- **主进程翻译函数**：`translate.ts` 实现 `translate(language, key, vars)` 函数，支持 `{{var}}` 插值，供主进程菜单同步调用
- **渲染进程 hooks**：`hooks/useAppLanguage.ts` 封装 `react-i18next` 的 `useTranslation()`，提供 `language` 和 `setLanguage()`
- **菜单模板**：`menu-template.ts` 为 Electron 主进程菜单提供多语言模板，直接调用 `translate()`
- **语言解析**：`resolve-language.ts` 的 `resolveLanguage(saved, systemLocale)` 优先使用已保存偏好，否则按系统语言匹配，最终回退 `en-US`
- **渲染进程初始化**：`src/renderer/src/i18n.ts` 以 `messages` 作为 i18next `resources`，通过 `window.languageAPI.getSync()` 同步获取初始语言（`initAsync: false`）
- **校验脚本**：`scripts/check-i18n.mjs` 检查三语 key 完整性，命令 `npm run check:i18n`

#### A.2 目录结构
```
src/shared/i18n/
├── types.ts                  # AppLanguage、MessageTree 类型定义
├── messages.ts               # 三语翻译表（zhCN / enUS / zhTW）
├── translate.ts              # t() 翻译函数
├── menu-template.ts          # Electron 菜单多语言模板
├── resolve-language.ts       # 语言检测与回退逻辑
├── read-language-preference.ts  # 从存储读取用户偏好
├── format-shortcut.ts        # 快捷键格式化（macOS ⌘ / Windows Ctrl）
└── i18n.test.ts              # 单元测试

scripts/
└── check-i18n.mjs            # 翻译完整性检查脚本
```

#### A.3 messages.ts 结构示例
```typescript
const zhCN = {
  menu: { file: '文件', new: '新建', open: '打开…', ... },
  dialog: { openFile: '打开文件', saveFailed: '保存失败', ... },
  toolbar: { new: '新建文件', save: '保存文件', ... },
  settings: { title: '设置', language: '语言', ... },
  // v0.4+ 新增分组
  image: { uploading: '上传中…', uploadFailed: '上传失败', ... },
  diagram: { renderError: '渲染失败', syntaxError: '语法错误', ... }
} satisfies MessageTree

const enUS = { ... } satisfies typeof zhCN
const zhTW = { ... } satisfies typeof zhCN

export const messages: Record<AppLanguage, MessageTree> = {
  'zh-CN': zhCN, 'zh-TW': zhTW, 'en-US': enUS
}
```

#### A.4 翻译调用示例

**渲染进程（使用 react-i18next）**：
```typescript
// hooks/useAppLanguage.ts
import { useTranslation } from 'react-i18next'

export function useAppLanguage() {
  const { i18n } = useTranslation()
  const language = toAppLanguage(i18n.resolvedLanguage ?? i18n.language)
  
  const setLanguage = async (next: AppLanguage) => {
    await i18n.changeLanguage(next)
    await window.languageAPI.set(next)  // 同步到主进程
  }
  
  return { language, setLanguage }
}

// 组件内调用
import { useTranslation } from 'react-i18next'

function Toolbar() {
  const { t } = useTranslation()
  return <button title={t('toolbar.save')}>💾</button>
}
```

**主进程（使用自研 translate）**：
```typescript
// menu-template.ts
import { translate } from './translate'

export function createAppMenuTemplate(options: AppMenuTemplateOptions) {
  const { language, appName, recentFiles, actions } = options
  const t = (key: string, vars?: Record<string, string | number>) => 
    translate(language, key, vars)

  return [
    {
      label: t('menu.file'),
      submenu: [
        { label: t('menu.new'), accelerator: 'CmdOrCtrl+N', click: actions.newFile },
        { label: t('menu.open'), accelerator: 'CmdOrCtrl+O', click: actions.openFile }
      ]
    }
  ]
}
```

#### A.5 为什么主进程不用 i18next？
1. **无 React 上下文**：主进程不需要 hooks，只需「按语言取字符串」，一个约 40 行的纯函数即可满足
2. **纯函数易测试**：`translate()` / `createAppMenuTemplate()` 无全局状态，语言作为参数传入，可直接单测（见 `i18n.test.ts`）
3. **行为一致**：两者共享 `messages.ts`，回退语言均为 `en-US`，插值语法均为 `{{var}}`
4. **约束**：新增插值语法（如复数、格式化）时需同时兼容 i18next 与 `translate()`，否则主进程菜单与渲染进程表现不一致

---

### B. Mermaid 渲染器实现方案（已实现）

**目标**：在 markdown-it 渲染流程中识别 ` ```mermaid ` 代码块，调用 `mermaid` 渲染为 SVG。

**关键约束**：`markdown-it` 的 `render()` 是同步的，`mermaid.render()` 返回 Promise，且 mermaid 打包体积约 1.1MB。因此采用**占位符 + 提交后水合**：同步段只输出占位块，异步段在 DOM 提交后填充 SVG。

#### B.1 同步段：fence 规则输出占位块

```typescript
// src/renderer/src/lib/markdown.ts
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const lang = tokens[idx].info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  const diagrams = env?.diagrams as DiagramBlock[] | undefined
  if (diagrams && lang === 'mermaid') {
    const id = `d${diagrams.length}`
    diagrams.push({ id, lang, code: tokens[idx].content })
    return `<div class="biu-diagram" data-diagram-id="${id}" data-diagram-lang="${lang}" data-diagram-state="pending"></div>`
  }
  return defaultFence(tokens, idx, options, env, self)
}
```

不传 `env.diagrams` 时 mermaid 代码块退回普通高亮，`renderMarkdown` 保持纯函数（导出等内部调用按需决定是否水合）。

#### B.2 异步段：水合

```typescript
// src/renderer/src/lib/diagram-hydrate.ts
export async function hydrateDiagrams(root, blocks, { theme, signal }): Promise<void> {
  for (const block of blocks) {
    if (signal.aborted) return
    const host = root.querySelector(`[data-diagram-id="${block.id}"]`)
    if (!host) continue
    showSource(host, block)                        // 先给源码，避免空白
    const key = diagramCacheKey(block, theme)
    const cached = svgCache.get(key)
    if (cached) { mountSvg(host, cached); continue }
    try {
      const svg = await enqueue(async () => {
        const mermaid = await getMermaid(theme)     // 懒加载 + 按主题 initialize
        const result = await mermaid.render(`biu-diagram-${++renderSeq}`, block.code)
        return sanitizeSvg(result.svg)
      })
      if (signal.aborted) return
      rememberSvg(key, svg); mountSvg(host, svg)
    } catch (error) {
      if (signal.aborted) return
      mountError(host, error)                      // 保留源码 + 错误提示
    }
  }
}
```

| 关注点 | 实现 |
|--------|------|
| 加载 | 首次 `getMermaid()` 时 `import('mermaid')`，独立 chunk，无图表的文档不下载 |
| 初始化 | `{ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', fontFamily: 'inherit' }`，仅在主题变化时重跑 |
| 并发 | mermaid 内部共享状态，并发 `render()` 会互相污染 → 全局串行队列 |
| 缓存 | 键 `lang + theme + code`，上限 60 条 FIFO |
| 取消 | 内容/主题/语言变化时 `AbortController.abort()`，旧结果不回填 |
| 状态 | `host.dataset.diagramState`（即 `data-diagram-state`）= `pending` / `ready` / `error`，与占位块上的初始值同名 |

#### B.3 安全性

- `securityLevel: 'strict'` 禁用 HTML 标签与 JavaScript 回调
- SVG 输出再经 DOMPurify 二次消毒：

  ```typescript
  DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
  ```

- 图表源码只存在于 `env.diagrams` 与文本节点中，不参与 HTML 解析

#### B.4 导出

`buildExportHtmlDocument` 为 async：在离屏 `div` 中先完成水合，再取 `innerHTML` 拼进导出模板。因此 HTML/PDF 里是**内联 SVG**，不是占位块。导出模板的 `<style>` 同步带上 `.biu-diagram*` 规则。

#### B.5 后续扩展

原计划中的渲染器注册表（`registerDiagramRenderer` / `getDiagramRenderer`）**未实现**——当前只有一种图表语言，注册表属于"为一种实现写抽象"。v1.0 引入 ChartJS / Graphviz 时，先落地第二个实现，再据此抽象注册表。

---

### C. 图片上传 IPC 接口设计

**目标**：渲染进程粘贴图片后，通过 IPC 请求主进程上传到图床，返回 URL。

#### C.1 IPC Channel 定义（`src/shared/ipc-channels.ts`）
```typescript
export const IPC = {
  // ...现有常量
  IMAGE_UPLOAD: 'image:upload', // 请求上传
  IMAGE_UPLOAD_PROGRESS: 'image:upload-progress', // 上传进度
  IMAGE_CONFIG_TEST: 'image:config-test' // 测试图床连接
} as const
```

#### C.2 主进程上传逻辑
```typescript
// src/main/image-uploader.ts
import { safeStorage } from 'electron'
import type { ImageHostConfig } from '@shared/types'

async function uploadToOSS(buffer: Buffer, config: ImageHostConfig) {
  const { accessKeyId, accessKeySecret, bucket, region } = decryptConfig(config)
  // 调用阿里云 OSS SDK
  const client = new OSS({ accessKeyId, accessKeySecret, bucket, region })
  const filename = `${Date.now()}-${nanoid()}.png`
  const result = await client.put(`images/${filename}`, buffer)
  return result.url
}

ipcMain.handle(IPC.IMAGE_UPLOAD, async (event, { buffer, hostType, config }) => {
  try {
    event.sender.send(IPC.IMAGE_UPLOAD_PROGRESS, { percent: 0 })
    const url = await uploadHandlers[hostType](buffer, config)
    event.sender.send(IPC.IMAGE_UPLOAD_PROGRESS, { percent: 100 })
    return { success: true, url }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
```

#### C.3 渲染进程调用
```typescript
// src/renderer/src/hooks/useImageUpload.ts
export function useImageUpload() {
  const upload = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const config = await window.api.getImageHostConfig()
    
    const result = await window.api.invoke('image:upload', {
      buffer: new Uint8Array(buffer),
      hostType: config.type,
      config
    })
    
    if (result.success) {
      return result.url
    } else {
      throw new Error(result.error)
    }
  }
  
  return { upload }
}
```

#### C.4 凭证加密存储

> 说明：下述 `store` 指 `electron-store`，当前项目尚未引入该依赖，v0.5 实现时需新增。

```typescript
// 保存配置时加密
const encrypted = safeStorage.encryptString(JSON.stringify({
  accessKeyId: 'LTAI***',
  accessKeySecret: 'secret***'
}))
store.set('imageHost.oss.credentials', encrypted.toString('base64'))

// 读取配置时解密
const base64 = store.get('imageHost.oss.credentials')
const decrypted = safeStorage.decryptString(Buffer.from(base64, 'base64'))
return JSON.parse(decrypted)
```

---

### D. 功能对比表

| 特性 | Typora | PicGo | BiuText v1.0 目标 |
|------|--------|-------|------------------|
| 分栏编辑 | ❌ 单栏 WYSIWYG | N/A | ✅ 双栏源码+预览 |
| 内联图片预览 | ✅ 完全所见即所得 | N/A | ✅ 编辑区缩略图 |
| 图片上传 | ⚠️ 需手动配置 | ✅ 核心功能 | ✅ 内置多图床 |
| Mermaid | ✅ 内置支持 | N/A | ✅ 实时渲染 |
| ChartJS | ❌ | N/A | ✅ v1.0 |
| Excalidraw | ❌ | N/A | ✅ v1.1 |
| 多标签页 | ❌ | N/A | ✅ v1.1 |
| 导出 PDF | ✅ | N/A | ✅ 已实现 |
| 跨平台 | ✅ Mac/Win/Linux | ✅ | ✅ Electron |
| 开源 | ❌ 闭源 | ✅ MIT | ✅ 规划开源 |

---

*本文档由产品团队维护，如有更新请同步通知开发和设计团队。*
