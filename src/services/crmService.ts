import crmSeed from '@/data/crm-seed.json'
import { api, isApiMode } from '@/lib/api'
import { loadFromStorage, saveToStorage } from '@/lib/storage'
import type { Client, Contact, ProjectContact, ProjectDetail, ProjectSummary } from '@/types/crm'

type CrmStore = {
  clients: Client[]
  projectContacts: Record<string, ProjectContact[]>
}

const STORAGE_KEY = 'crm'

function defaultStore(): CrmStore {
  const seed = crmSeed as CrmStore & { masters?: unknown }
  return {
    clients: seed.clients,
    projectContacts: seed.projectContacts ?? {},
  }
}

function getStore(): CrmStore {
  return loadFromStorage(STORAGE_KEY, defaultStore())
}

function persistStore(store: CrmStore): void {
  saveToStorage(STORAGE_KEY, JSON.stringify(store))
}

function contactName(c: { firstName: string; lastName?: string | null }): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ')
}

export const crmService = {
  async listClients(): Promise<Client[]> {
    if (isApiMode) return api<Client[]>('/customers')
    return getStore().clients.filter((c) => c.active !== false)
  },

  async getClient(id: string): Promise<Client | undefined> {
    if (isApiMode) return api<Client>(`/customers/${id}`)
    return getStore().clients.find((c) => c.id === id)
  },

  async createClient(input: Partial<Client> & { name: string }): Promise<Client> {
    if (isApiMode) {
      return api<Client>('/customers', { method: 'POST', body: JSON.stringify(input) })
    }
    const store = getStore()
    const client: Client = {
      id: `client-${Date.now()}`,
      code: input.code ?? input.name.replace(/\s+/g, '-').toUpperCase().slice(0, 20),
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      gstin: input.gstin,
      active: true,
      contacts: [],
      projects: [],
    }
    store.clients.push(client)
    persistStore(store)
    return client
  },

  async updateClient(id: string, input: Partial<Client> & { name?: string }): Promise<Client> {
    if (isApiMode) {
      return api<Client>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
    }
    const store = getStore()
    const idx = store.clients.findIndex((c) => c.id === id)
    if (idx === -1) throw new Error('Client not found')
    const updated = { ...store.clients[idx], ...input, id }
    store.clients[idx] = updated
    persistStore(store)
    return updated
  },

  async addContact(
    customerId: string,
    input: {
      firstName: string
      lastName?: string
      email?: string
      phone?: string
      designation?: string
      department?: string
      isPrimary?: boolean
    },
  ): Promise<Contact> {
    if (isApiMode) {
      return api<Contact>(`/customers/${customerId}/contacts`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    }
    const store = getStore()
    const client = store.clients.find((c) => c.id === customerId)
    if (!client) throw new Error('Client not found')
    const contact: Contact = {
      id: `contact-${Date.now()}`,
      customerId,
      firstName: input.firstName,
      lastName: input.lastName,
      name: contactName(input),
      email: input.email,
      phone: input.phone,
      designation: input.designation,
      department: input.department,
      isPrimary: input.isPrimary ?? false,
      active: true,
    }
    client.contacts = [...(client.contacts ?? []), contact]
    persistStore(store)
    return contact
  },

  async createProject(
    customerId: string,
    input: { code: string; name: string; location?: string; projectType?: string },
  ): Promise<ProjectSummary> {
    if (isApiMode) {
      return api<ProjectSummary>('/projects', {
        method: 'POST',
        body: JSON.stringify({ customerId, ...input }),
      })
    }
    const store = getStore()
    const client = store.clients.find((c) => c.id === customerId)
    if (!client) throw new Error('Client not found')
    const project: ProjectSummary = {
      id: `proj-${Date.now()}`,
      customerId,
      code: input.code,
      name: input.name,
      location: input.location,
      projectType: input.projectType,
      status: 'ACTIVE',
    }
    client.projects = [...(client.projects ?? []), project]
    store.projectContacts[project.id] = []
    persistStore(store)
    return project
  },

  async getProject(id: string): Promise<ProjectDetail | undefined> {
    if (isApiMode) return api<ProjectDetail>(`/projects/${id}`)
    const store = getStore()
    for (const client of store.clients) {
      const project = client.projects?.find((p) => p.id === id)
      if (project) {
        return {
          ...project,
          projectContacts: store.projectContacts[id] ?? [],
        }
      }
    }
    return undefined
  },

  async addProjectContact(
    projectId: string,
    input: { contactId: string; role: string; isPrimary?: boolean },
  ): Promise<ProjectContact> {
    if (isApiMode) {
      return api<ProjectContact>(`/projects/${projectId}/contacts`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    }
    const store = getStore()
    const client = store.clients.find((c) => c.projects?.some((p) => p.id === projectId))
    const contact = client?.contacts?.find((c) => c.id === input.contactId)
    if (!contact) throw new Error('Contact not found')
    const row: ProjectContact = {
      id: `pc-${Date.now()}`,
      projectId,
      contactId: input.contactId,
      role: input.role,
      isPrimary: input.isPrimary ?? false,
      isActive: true,
      contact,
    }
    const list = store.projectContacts[projectId] ?? []
    store.projectContacts[projectId] = [...list.filter((pc) => !(pc.contactId === input.contactId && pc.role === input.role)), row]
    persistStore(store)
    return row
  },

  resetToSeed(): void {
    persistStore(defaultStore())
  },
}
