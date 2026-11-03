export function formatShortcut(platform: string, key: string, shift = false): string {
  if (platform === 'darwin') {
    return `⌘${shift ? '⇧' : ''}${key}`
  }
  return shift ? `Ctrl+Shift+${key}` : `Ctrl+${key}`
}
