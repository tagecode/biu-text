import { useSyncExternalStore } from 'react'
import { getUploads, subscribeUploads, type UploadState } from '@/lib/upload-store'

export function useUploads(): UploadState[] {
  return useSyncExternalStore(subscribeUploads, getUploads, getUploads)
}
