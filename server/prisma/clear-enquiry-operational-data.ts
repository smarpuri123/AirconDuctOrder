import { PrismaClient } from '@prisma/client'
import { rm, readdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()
const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOAD_ROOT = join(__dirname, '../uploads/enquiries')

/**
 * Clears enquiries, customer orders, dispatches, and operational logs/sequences.
 * Preserves:
 * - Customers (Clients) & Contacts
 * - Projects & ProjectContacts
 * - Users, Employees, Departments, JobRoles, Permissions (Authentication / Login)
 * - Workflow Definitions & States
 * - Master Lookups & Vehicles
 */
export async function clearEnquiryAndOperationalData(): Promise<void> {
  console.log('Clearing enquiries, orders, dispatches, and logs while preserving clients and projects...')

  await prisma.$transaction(
    async (tx) => {
      // 1. Notifications & Audit Logs
      await tx.notification.deleteMany()
      await tx.auditLog.deleteMany()

      // 2. Workflow instances and history
      await tx.workflowHistory.deleteMany()
      await tx.workflowInstance.deleteMany()

      // 3. Dispatches & Deliveries
      await tx.delivery.deleteMany()
      await tx.dispatchItem.deleteMany()
      await tx.dispatch.deleteMany()

      // 4. Manufacturing orders & items
      await tx.manufacturingItem.deleteMany()
      await tx.manufacturingOrder.deleteMany()

      // 5. Enquiries & related documents, activities, duct lines
      await tx.enquiry.updateMany({
        data: { customerOrderId: null },
      })
      await tx.enquiryDuctLine.deleteMany()
      await tx.enquiryActivity.deleteMany()
      await tx.enquiryDocument.deleteMany()
      await tx.enquiry.deleteMany()

      // 6. Customer Orders, POs, Quotations
      await tx.customerOrderItem.deleteMany()
      await tx.customerOrder.deleteMany()
      await tx.customerPo.deleteMany()
      await tx.quotation.deleteMany()

      // 7. Duct Schedules and Drawings
      await tx.ductScheduleItem.deleteMany()
      await tx.ductSchedule.deleteMany()
      await tx.drawingRevision.deleteMany()
      await tx.drawing.deleteMany()

      // 8. Business sequences (resets counters for enquiry, dispatch, etc. to start initial from 1)
      await tx.businessSequence.deleteMany()
    },
    { timeout: 120_000 }
  )

  // 9. Remove uploaded enquiry files from disk
  try {
    const entries = await readdir(UPLOAD_ROOT, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(UPLOAD_ROOT, entry.name)
      await rm(fullPath, { recursive: true, force: true })
      console.log(`Removed upload entry: ${entry.name}`)
    }
    console.log('Cleaned uploads/enquiries directory.')
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.warn('Warning clearing uploads:', err.message)
    }
  }
}

async function main() {
  await clearEnquiryAndOperationalData()
  console.log('Successfully cleared all enquiry, order, and dispatch records. Clients and projects are intact.')
}

main()
  .catch((e) => {
    console.error('Failed to clear operational data:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
