import { PrismaClient } from '@prisma/client'
import { seedMasterLookups, seedOrganization } from './seed.js'

const prisma = new PrismaClient()

/** Remove all operational data; keep users, roles, and permissions (login). */
export async function clearBusinessData(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.notification.deleteMany()
      await tx.pushSubscription.deleteMany()
      await tx.notificationPreference.deleteMany()
      await tx.auditLog.deleteMany()

      await tx.workflowHistory.deleteMany()
      await tx.workflowInstance.deleteMany()
      await tx.workflowTransition.deleteMany()
      await tx.workflowState.deleteMany()
      await tx.workflowDefinition.deleteMany()

      await tx.delivery.deleteMany()
      await tx.dispatchItem.deleteMany()
      await tx.dispatch.deleteMany()
      await tx.vehicle.deleteMany()

      await tx.manufacturingItem.deleteMany()
      await tx.manufacturingOrder.deleteMany()

      await tx.enquiryActivity.deleteMany()
      await tx.enquiryDocument.deleteMany()
      await tx.enquiry.deleteMany()

      await tx.customerOrderItem.deleteMany()
      await tx.customerOrder.deleteMany()
      await tx.customerPo.deleteMany()
      await tx.quotation.deleteMany()

      await tx.ductScheduleItem.deleteMany()
      await tx.ductSchedule.deleteMany()

      await tx.drawingRevision.deleteMany()
      await tx.drawing.deleteMany()

      await tx.projectContact.deleteMany()
      await tx.project.deleteMany()
      await tx.contact.deleteMany()
      await tx.customer.deleteMany()

      await tx.employeeJobRole.deleteMany()
      await tx.employee.deleteMany()
      await tx.workflowStageRole.deleteMany()
      await tx.jobRole.deleteMany()
      await tx.department.deleteMany()

      await tx.masterLookup.deleteMany()
    },
    { timeout: 120_000 },
  )

  console.log('Re-seeding master lookups and organization (no demo CRM/orders/enquiries)...')
  await seedMasterLookups()
  await seedOrganization()
}

async function main() {
  console.log('Clearing business data (keeping login users)...')
  await clearBusinessData()
  console.log('Done. Login accounts unchanged.')
  console.log('Do not run `npm run db:seed:demo` unless you want sample clients/orders back.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
