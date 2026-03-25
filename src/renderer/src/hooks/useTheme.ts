import { useEffect, useRef, useState } from 'react'

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
  const [theme, setTheme] = useState<Theme>('light')
  const themeModeRef = useRef<ThemeMode>(themeMode)

  useEffect(() => {
    themeModeRef.current = themeMode
  }, [themeMode])

  useEffect(() => {
    window.themeAPI.set(themeMode)
    try {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode)
    } catch {
      // ignore storage failures
    }

    if (themeMode === 'system') {
      window.themeAPI.get().then(setTheme)
      return
    }

    setTheme(themeMode)
  }, [themeMode])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const unsub = window.themeAPI.onChange((nextTheme) => {
      if (themeModeRef.current === 'system') {
        setTheme(nextTheme)
      }
    })
    return unsub
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
