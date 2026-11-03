import { useCallback, useEffect, useState } from 'react'

export function useLoginItem() {
  const [openAtLogin, setOpenAtLogin] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.loginAPI.get().then((value) => {
      if (!cancelled) setOpenAtLogin(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const updateOpenAtLogin = useCallback(async (value: boolean) => {
    setOpenAtLogin(value)
    const next = await window.loginAPI.set(value)
    setOpenAtLogin(next)
  }, [])

  return { openAtLogin, setOpenAtLogin: updateOpenAtLogin }
}
