import { useSyncExternalStore } from 'react'
import { getToasts, subscribeToasts } from '@/lib/toast-store'

export function useToasts() {
  return useSyncExternalStore(subscribeToasts, getToasts, getToasts)
}
