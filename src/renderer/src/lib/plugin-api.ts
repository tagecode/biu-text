/**
 * 渲染进程插件接口（预研）。
 *
 * 当前只开放「图表渲染器」这一类扩展点：插件登记语言与渲染函数后，
 * 预览区/导出会像内置图表一样收集并水合对应 fenced code。
 *
 * 插件必须随应用一起构建（不在运行时从网络加载第三方脚本），
 * 这样渲染进程的沙箱与 CSP 约束不会被绕过。
 */
import { registerDiagramLanguage } from '@shared/diagram'
import { registerDiagramRenderer, type DiagramRenderer } from '@/lib/diagram-hydrate'

export interface DiagramRendererPlugin {
  /** 唯一名字，重复注册会被忽略 */
  name: string
  /** fenced code 的语言标记，例如 `plantuml`；大小写不敏感 */
  languages: string[]
  render: DiagramRenderer
}

const registered = new Set<string>()

export function registerRendererPlugin(plugin: DiagramRendererPlugin): void {
  if (registered.has(plugin.name)) return
  for (const language of plugin.languages) {
    registerDiagramLanguage(language)
    registerDiagramRenderer(language, plugin.render)
  }
  registered.add(plugin.name)
}

export function listRendererPlugins(): string[] {
  return Array.from(registered)
}
