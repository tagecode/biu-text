export function readLanguagePreference(raw: string): string | null {
  if (!raw.trim()) return null
  try {
    const data = JSON.parse(raw) as { language?: unknown }
    return typeof data?.language === 'string' ? data.language : null
  } catch {
    return null
  }
}
