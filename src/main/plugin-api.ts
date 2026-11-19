/**
 * 主进程插件接口（预研）。
 *
 * 自定义图床插件通过 `registerImageHostPlugin` 注册后，`uploadImage` /
 * `testImageHost` 会自动按配置的 `type` 分发，不需要改内置 switch。
 *
 * 和渲染进程插件一样，插件代码必须随应用构建、在主进程启动阶段注册。
 */
import type { ImageHostType } from '../shared/image-host'
import {
  registerImageHostProvider,
  type ImageHostProvider
} from './image-host-providers'

export type { ImageHostProvider, UploadInput, UploadResult, ProgressReporter } from './image-host-providers'

export interface ImageHostPlugin {
  name: string
  /** 覆盖或新增的图床类型（当前设置面板只提供 local/github/custom） */
  type: ImageHostType
  provider: ImageHostProvider
}

const registered: string[] = []

export function registerImageHostPlugin(plugin: ImageHostPlugin): void {
  if (registered.includes(plugin.name)) return
  registerImageHostProvider(plugin.type, plugin.provider)
  registered.push(plugin.name)
}

export function listImageHostPlugins(): string[] {
  return [...registered]
}
