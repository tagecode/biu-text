import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
export type ThemeMode = Theme | 'system'

const THEME_MODE_STORAGE_KEY = 'biu-text:theme-mode'

function readStoredThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readStoredThemeMode)
  // 仅当 themeMode 为 system 时参与派生，避免模式切换与系统推送相互覆盖
  const [systemTheme, setSystemTheme] = useState<Theme>('light')
  const theme: Theme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    window.themeAPI.set(themeMode)
    try {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode)
    } catch {
      // ignore storage failures
    }

    if (themeMode === 'system') {
      window.themeAPI.get().then(setSystemTheme)
    }
  }, [themeMode])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    return window.themeAPI.onChange(setSystemTheme)
  }, [])

  function setThemeMode(mode: ThemeMode) {
    setThemeModeState(mode)
  }

  function cycleThemeMode() {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = order.indexOf(themeMode)
    const next = order[(currentIndex + 1) % order.length]
    setThemeModeState(next)
  }

  return { theme, themeMode, setThemeMode, cycleThemeMode }
}
