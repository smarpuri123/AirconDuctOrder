import { mkdir, writeFile, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const UPLOAD_ROOT = join(__dirname, '../../uploads/enquiries')

export type IncomingEnquiryFile = {
  fileName: string
  mimeType?: string
  dataBase64: string
}

export async function saveEnquiryFile(enquiryId: string, file: IncomingEnquiryFile): Promise<{
  filePath: string
  fileSize: number
}> {
  const buffer = Buffer.from(file.dataBase64, 'base64')
  const safeName = file.fileName.replace(/[^\w.\-()+ ]/g, '_')
  const dir = join(UPLOAD_ROOT, enquiryId)
  await mkdir(dir, { recursive: true })
  const storedName = `${randomBytes(8).toString('hex')}-${safeName}`
  const filePath = join(dir, storedName)
  await writeFile(filePath, buffer)
  return { filePath, fileSize: buffer.length }
}

export async function readEnquiryFile(filePath: string): Promise<Buffer> {
  return readFile(filePath)
}
