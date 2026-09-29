/** Login id: lowercase; strips `@domain` when users paste an old email address. */
export function normalizeUsername(input: string): string {
  const trimmed = input.trim().toLowerCase()
  const at = trimmed.indexOf('@')
  if (at > 0) return trimmed.slice(0, at)
  return trimmed
}
