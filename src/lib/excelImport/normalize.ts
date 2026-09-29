export function normalizeHeader(value: string): string {
  return value
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[._]+/g, ' ')
}

export function fingerprintHeaders(headers: string[]): string {
  return headers.map(normalizeHeader).filter(Boolean).sort().join('|')
}
