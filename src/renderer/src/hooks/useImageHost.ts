import { useCallback, useEffect, useState } from 'react'
import type { ImageHostConfigView } from '@shared/image-host'

/** 图床配置由主进程持有，渲染进程只拿脱敏视图 */
export function useImageHost() {
  const [config, setConfig] = useState<ImageHostConfigView | null>(null)

  useEffect(() => {
    let active = true
    void window.imageAPI.getHostConfig().then((next) => {
      if (active) setConfig(next)
    })
    return () => {
      active = false
    }
  }, [])

  const saveConfig = useCallback(async (next: ImageHostConfigView) => {
    setConfig(await window.imageAPI.setHostConfig(next))
  }, [])

  return { config, saveConfig }
}
