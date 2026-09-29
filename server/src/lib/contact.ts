export function contactFullName(firstName: string, lastName?: string | null): string {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(' ')
}

export function mapContactToApi(contact: {
  id: string
  customerId: string
  firstName: string
  lastName: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  designation: string | null
  department: string | null
  isPrimary: boolean
  active: boolean
}) {
  return {
    id: contact.id,
    customerId: contact.customerId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    name: contactFullName(contact.firstName, contact.lastName),
    email: contact.email,
    phone: contact.phone,
    whatsapp: contact.whatsapp,
    designation: contact.designation,
    department: contact.department,
    isPrimary: contact.isPrimary,
    active: contact.active,
  }
}
