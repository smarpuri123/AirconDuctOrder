import type { EnquiryDesignDocument, EnquiryFilePayload } from '@/types/enquiry'
import { getToken } from '@/lib/api'
import { getCurrentUser } from '@/lib/currentUser'
import { loadFromStorage, saveToStorage } from '@/lib/storage'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export const ENQUIRY_FILE_ACCEPT =
  '.pdf,.dwg,.dxf,.dwt,.zip,.rar,.7z,.png,.jpg,.jpeg,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv'

const BLOB_STORAGE_KEY = 'enquiryFileBlobs' as const

type BlobStore = Record<string, { fileName: string; mimeType: string; dataBase64: string }>

function loadBlobs(): BlobStore {
  return loadFromStorage(BLOB_STORAGE_KEY, {})
}

function saveBlobs(store: BlobStore): void {
  saveToStorage(BLOB_STORAGE_KEY, JSON.stringify(store))
}

export function storeLocalEnquiryFileBlob(
  documentId: string,
  payload: EnquiryFilePayload,
): void {
  const store = loadBlobs()
  store[documentId] = {
    fileName: payload.fileName,
    mimeType: payload.mimeType ?? 'application/octet-stream',
    dataBase64: payload.dataBase64,
  }
  saveBlobs(store)
}

export function getLocalEnquiryFileBlob(documentId: string): BlobStore[string] | undefined {
  return loadBlobs()[documentId]
}

/** Drop blob entries not referenced by any enquiry document (e.g. after demo reset). */
export function pruneEnquiryFileBlobs(keepDocumentIds: ReadonlySet<string>): void {
  const store = loadBlobs()
  const next: BlobStore = {}
  for (const [id, blob] of Object.entries(store)) {
    if (keepDocumentIds.has(id)) next[id] = blob
  }
  saveBlobs(next)
}

export function clearEnquiryFileBlobs(): void {
  saveBlobs({})
}

export async function filesToPayloads(files: FileList | File[]): Promise<EnquiryFilePayload[]> {
  return filesToPayloadsWithProgress(files)
}

export async function filesToPayloadsWithProgress(
  files: FileList | File[],
  onProgress?: (percent: number) => void,
): Promise<EnquiryFilePayload[]> {
  const list = Array.from(files)
  const payloads: EnquiryFilePayload[] = []
  for (let i = 0; i < list.length; i++) {
    const file = list[i]
    const dataBase64 = await readFileAsBase64(file)
    payloads.push({
      fileName: file.name,
      mimeType: file.type || guessMime(file.name),
      dataBase64,
    })
    onProgress?.(Math.round(((i + 1) / list.length) * 100))
  }
  return payloads
}

export async function uploadEnquiryDocumentsWithProgress(
  enquiryId: string,
  files: EnquiryFilePayload[],
  onProgress: (percent: number) => void,
): Promise<void> {
  const token = getToken()
  const acting = getCurrentUser()

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const body = JSON.stringify({ files })
    xhr.open('POST', `${API_BASE}/enquiries/${enquiryId}/documents`)
    xhr.setRequestHeader('Content-Type', 'application/json')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('X-Operation-Actor-Name', acting.name)
    xhr.setRequestHeader('X-Operation-Actor-Role', acting.role)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }
      let message = 'Upload failed'
      try {
        const parsed = JSON.parse(xhr.responseText) as { error?: string; message?: string }
        message = parsed.error ?? parsed.message ?? message
      } catch {
        /* ignore */
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(body)
  })
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function guessMime(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    dwg: 'application/acad',
    dxf: 'application/dxf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    zip: 'application/zip',
  }
  return map[ext ?? ''] ?? 'application/octet-stream'
}

export async function downloadEnquiryDocument(
  doc: EnquiryDesignDocument,
  apiMode: boolean,
): Promise<void> {
  if (apiMode) {
    const token = getToken()
    const res = await fetch(
      `${API_BASE}/enquiries/${doc.enquiryId}/documents/${doc.id}/download`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    )
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.fileName
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  const blob = getLocalEnquiryFileBlob(doc.id)
  if (!blob) return
  const bytes = Uint8Array.from(atob(blob.dataBase64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: blob.mimeType }))
  const a = document.createElement('a')
  a.href = url
  a.download = blob.fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function formatFileList(names: string[]): string {
  return names.join(', ')
}
