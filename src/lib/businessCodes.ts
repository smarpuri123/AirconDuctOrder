export interface CodedClient {
  id?: string
  code?: string | null
  projects?: { id?: string; code: string }[]
}

export function findCodeConflict(
  code: string,
  clients: CodedClient[],
  ignore: { clientId?: string; projectId?: string } = {},
): 'client' | 'project' | null {
  const needle = code.trim().toLowerCase()
  if (!needle) return null

  for (const client of clients) {
    if (client.code?.trim().toLowerCase() === needle && client.id !== ignore.clientId) {
      return 'client'
    }
    for (const project of client.projects ?? []) {
      if (project.code.trim().toLowerCase() === needle && project.id !== ignore.projectId) {
        return 'project'
      }
    }
  }
  return null
}

export function codeConflictMessage(kind: 'client' | 'project' | null): string {
  if (kind === 'client') return 'This code is already used by a client.'
  if (kind === 'project') return 'This code is already used by another project.'
  return ''
}

/** Next free P-001 style code, skipping client codes and existing project codes. */
export function nextProjectCode(clients: CodedClient[]): string {
  const taken = new Set<string>()
  for (const client of clients) {
    if (client.code?.trim()) taken.add(client.code.trim().toLowerCase())
    for (const project of client.projects ?? []) {
      if (project.code.trim()) taken.add(project.code.trim().toLowerCase())
    }
  }

  let max = 0
  for (const code of taken) {
    const match = /^p-(\d+)$/.exec(code)
    if (match) max = Math.max(max, Number(match[1]))
  }

  for (let n = max + 1; n < max + 1000; n += 1) {
    const code = `P-${String(n).padStart(3, '0')}`
    if (!taken.has(code.toLowerCase())) return code
  }
  return `P-${String(max + 1).padStart(3, '0')}`
}
