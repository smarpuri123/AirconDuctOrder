import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { crmService } from '@/services/crmService'
import { masterService } from '@/services/masterService'
import type { Client, Contact, MasterLookup, ProjectContact, ProjectSummary } from '@/types/crm'
import { MASTER_CATEGORY } from '@/types/crm'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import {
  ClientCompanyFields,
  clientFormFromClient,
  clientFormToPayload,
  emptyClientForm,
} from '@/components/clients/ClientCompanyFields'

type DetailTab = 'contacts' | 'projects'
type ClientModal = 'new' | 'edit' | 'contact' | 'project' | 'link' | null

function projectRoleCodeForContact(
  contact: Contact | undefined,
  roles: MasterLookup[],
  fallback: string,
): string {
  if (!contact?.designation?.trim()) return fallback
  const d = contact.designation.trim()
  const byCode = roles.find((r) => r.code === d)
  if (byCode) return byCode.code
  const lower = d.toLowerCase()
  const byLabel = roles.find((r) => r.label.toLowerCase() === lower)
  if (byLabel) return byLabel.code
  const partial = roles.find(
    (r) => lower.includes(r.label.toLowerCase()) || r.label.toLowerCase().includes(lower),
  )
  return partial?.code ?? fallback
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [roles, setRoles] = useState<MasterLookup[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('contacts')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectContacts, setProjectContacts] = useState<ProjectContact[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [modal, setModal] = useState<ClientModal>(null)
  const [newClient, setNewClient] = useState(emptyClientForm)
  const [editClient, setEditClient] = useState(emptyClientForm)
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', designationCode: '', phone: '' })
  const [projectForm, setProjectForm] = useState({ code: '', name: '', location: '' })
  const [linkForm, setLinkForm] = useState({ contactId: '', role: 'CLIENT_PM', isPrimary: false })

  const load = useCallback(async () => {
    setLoading(true)
    const [list, roleMasters] = await Promise.all([crmService.listClients(), masterService.contactRoles()])
    setClients(list)
    setRoles(roleMasters)
    setSelectedId((current) => current ?? list[0]?.id ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!roles.length) return
    setContactForm((f) => ({
      ...f,
      designationCode: f.designationCode || roles[0].code,
    }))
    setLinkForm((f) => ({
      ...f,
      role: roles.some((r) => r.code === f.role) ? f.role : roles[0].code,
    }))
  }, [roles])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(t)
  }, [message])

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q))
  }, [clients, search])

  const roleLabel = (code: string) => masterService.labelForCode(MASTER_CATEGORY.CONTACT_ROLE, code, roles)

  const designationLabel = (value: string | null | undefined) => {
    if (!value) return '—'
    const byCode = roles.find((r) => r.code === value)
    if (byCode) return byCode.label
    const byLabel = roles.find((r) => r.label === value)
    return byLabel?.label ?? value
  }

  const loadProjectContacts = async (projectId: string) => {
    const detail = await crmService.getProject(projectId)
    setProjectContacts(detail?.projectContacts ?? [])
  }

  useEffect(() => {
    if (selectedProjectId) loadProjectContacts(selectedProjectId)
    else setProjectContacts([])
  }, [selectedProjectId])

  useEffect(() => {
    if (selected) setEditClient(clientFormFromClient(selected))
  }, [selected?.id])

  const projects: ProjectSummary[] = selected?.projects ?? []
  const contacts: Contact[] = (selected?.contacts ?? []).filter((c) => c.active)

  useEffect(() => {
    if (tab !== 'projects' || !projects.length) return
    if (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id)
    }
  }, [tab, projects, selectedProjectId])

  const refreshClient = async (id: string) => {
    const fresh = await crmService.getClient(id)
    if (!fresh) return
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...fresh } : c)))
  }

  const openNewClient = () => {
    setNewClient(emptyClientForm())
    setModal('new')
    setMessage('')
  }

  const handleCreateClient = async () => {
    if (!newClient.name.trim()) return
    const client = await crmService.createClient(clientFormToPayload(newClient))
    setClients((prev) => [...prev, client])
    setSelectedId(client.id)
    setTab('contacts')
    setModal(null)
    setMessage('Client created')
  }

  const handleSaveClientDetails = async () => {
    if (!selected || !editClient.name.trim()) return
    const updated = await crmService.updateClient(selected.id, clientFormToPayload(editClient))
    setClients((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
    setModal(null)
    setMessage('Company details saved')
  }

  const handleAddContact = async () => {
    if (!selected || !contactForm.firstName.trim()) return
    const designation = contactForm.designationCode
      ? roleLabel(contactForm.designationCode)
      : undefined
    await crmService.addContact(selected.id, {
      firstName: contactForm.firstName.trim(),
      lastName: contactForm.lastName.trim() || undefined,
      designation,
      phone: contactForm.phone.trim() || undefined,
    })
    await refreshClient(selected.id)
    setContactForm({
      firstName: '',
      lastName: '',
      designationCode: roles[0]?.code ?? '',
      phone: '',
    })
    setModal(null)
    setMessage('Contact added')
  }

  const handleAddProject = async () => {
    if (!selected || !projectForm.code.trim() || !projectForm.name.trim()) return
    const project = await crmService.createProject(selected.id, {
      code: projectForm.code.trim(),
      name: projectForm.name.trim(),
      location: projectForm.location.trim() || undefined,
    })
    await refreshClient(selected.id)
    setProjectForm({ code: '', name: '', location: '' })
    setSelectedProjectId(project.id)
    setTab('projects')
    setModal(null)
    setMessage('Project added')
  }

  const handleLinkContact = async () => {
    if (!selectedProjectId || !linkForm.contactId || !linkForm.role) return
    await crmService.addProjectContact(selectedProjectId, linkForm)
    await loadProjectContacts(selectedProjectId)
    setLinkForm((f) => ({ ...f, contactId: '', isPrimary: false }))
    setModal(null)
    setMessage('Contact assigned to project')
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Clients</h2>
          <p className="text-text-secondary text-sm mt-1">
            Pick a company, then manage contacts and projects from one place.
          </p>
        </div>
        {message && (
          <p className="text-sm text-success" role="status">
            {message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Card className="lg:col-span-4 flex flex-col min-w-0" padding="sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Company name or code"
            aria-label="Search clients"
          />
          <Button type="button" size="sm" fullWidth className="mt-3" variant="secondary" onClick={openNewClient}>
            <Plus className="w-4 h-4" />
            New client
          </Button>
          <div className="mt-3 max-h-[min(60vh,520px)] overflow-y-auto border border-border rounded-md divide-y divide-border">
            {loading && <p className="p-3 text-sm text-text-secondary">Loading…</p>}
            {!loading && filtered.length === 0 && (
              <p className="p-3 text-sm text-text-secondary">No clients yet. Add your first company.</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedId(c.id)
                  setSelectedProjectId(null)
                }}
                className={`w-full text-left px-3 py-2.5 hover:bg-background transition-colors ${
                  selectedId === c.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/25' : ''
                }`}
              >
                <p className="font-medium text-sm truncate">{c.name}</p>
                <p className="text-xs text-text-secondary truncate">
                  {c.code ?? 'No code'} · {c.contacts?.length ?? 0} contacts · {c.projects?.length ?? 0} projects
                </p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-8 min-w-0" padding="sm">
          {!selected ? (
            <div className="py-16 text-center text-text-secondary text-sm">
              <p>Select a client from the list, or create a new one.</p>
              <Button type="button" className="mt-4" size="sm" variant="secondary" onClick={openNewClient}>
                New client
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold truncate">{selected.name}</h3>
                  <p className="text-sm text-text-secondary mt-0.5">
                    {[selected.code, selected.city, selected.phone].filter(Boolean).join(' · ') || 'No summary yet'}
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setModal('edit')}>
                  Edit company
                </Button>
              </div>

              <div className="flex gap-1 p-1 mt-4 bg-background rounded-lg border border-border w-fit">
                {(['contacts', 'projects'] as DetailTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      tab === t ? 'bg-surface shadow-sm text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {t === 'contacts' ? `Contacts (${contacts.length})` : `Projects (${projects.length})`}
                  </button>
                ))}
              </div>

              {tab === 'contacts' && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={() => setModal('contact')}>
                      <Plus className="w-4 h-4" />
                      Add contact
                    </Button>
                  </div>
                  {contacts.length === 0 ? (
                    <p className="text-sm text-text-secondary py-8 text-center rounded-md border border-dashed border-border">
                      No contacts for this client yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border border border-border rounded-md">
                      {contacts.map((c) => (
                        <li key={c.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                          <div>
                            <p className="font-medium">{c.name}</p>
                            <p className="text-text-secondary text-xs mt-0.5">
                              {designationLabel(c.designation)}
                              {c.phone ? ` · ${c.phone}` : ''}
                            </p>
                          </div>
                          {c.isPrimary && (
                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === 'projects' && (
                <div className="mt-4 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text-secondary">Sites &amp; jobs</p>
                    <Button type="button" size="sm" onClick={() => setModal('project')}>
                      <Plus className="w-4 h-4" />
                      Add project
                    </Button>
                  </div>

                  {projects.length === 0 ? (
                    <p className="text-sm text-text-secondary py-8 text-center rounded-md border border-dashed border-border">
                      No projects yet. Add a site or job for this client.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {projects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedProjectId(p.id)}
                            className={`text-left px-3 py-2 rounded-lg border text-sm max-w-full ${
                              selectedProjectId === p.id
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                : 'border-border hover:bg-background'
                            }`}
                          >
                            <span className="font-semibold">{p.code}</span>
                            <span className="text-text-secondary"> — {p.name}</span>
                            {p.location && (
                              <span className="block text-xs text-text-secondary mt-0.5 truncate">{p.location}</span>
                            )}
                          </button>
                        ))}
                      </div>

                      {selectedProject && (
                        <section className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-medium text-sm">
                              People on {selectedProject.code}
                            </h4>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={contacts.length === 0}
                              onClick={() => {
                                setLinkForm({
                                  contactId: '',
                                  role: roles[0]?.code ?? 'CLIENT_PM',
                                  isPrimary: false,
                                })
                                setModal('link')
                              }}
                            >
                              Assign contact
                            </Button>
                          </div>
                          {contacts.length === 0 && (
                            <p className="text-xs text-text-secondary">Add a client contact first, then assign them here.</p>
                          )}
                          {projectContacts.length === 0 ? (
                            <p className="text-sm text-text-secondary py-4 text-center">No one assigned to this project yet.</p>
                          ) : (
                            <ul className="divide-y divide-border/80 text-sm">
                              {projectContacts.map((pc) => (
                                <li key={pc.id} className="py-2 flex flex-wrap justify-between gap-2">
                                  <span className="font-medium">{pc.contact.name}</span>
                                  <span className="text-text-secondary text-xs sm:text-sm">
                                    {roleLabel(pc.role)}
                                    {pc.isPrimary ? ' · Primary' : ''}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <Modal
        open={modal === 'new'}
        onClose={() => setModal(null)}
        title="New client"
        size="lg"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="button" onClick={handleCreateClient}>Create client</Button>
          </>
        }
      >
        <ClientCompanyFields value={newClient} onChange={setNewClient} nameRequired />
      </Modal>

      <Modal
        open={modal === 'edit' && !!selected}
        onClose={() => setModal(null)}
        title="Edit company"
        size="lg"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="button" onClick={handleSaveClientDetails}>Save</Button>
          </>
        }
      >
        <ClientCompanyFields value={editClient} onChange={setEditClient} nameRequired />
      </Modal>

      <Modal
        open={modal === 'contact'}
        onClose={() => setModal(null)}
        title="Add contact"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="button" onClick={handleAddContact}>Save contact</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First name"
            value={contactForm.firstName}
            onChange={(e) => setContactForm((f) => ({ ...f, firstName: e.target.value }))}
            required
          />
          <Input
            label="Last name"
            value={contactForm.lastName}
            onChange={(e) => setContactForm((f) => ({ ...f, lastName: e.target.value }))}
          />
          <Select
            label="Designation"
            value={contactForm.designationCode}
            onChange={(e) => setContactForm((f) => ({ ...f, designationCode: e.target.value }))}
            options={
              roles.length
                ? roles.map((r) => ({ value: r.code, label: r.label }))
                : [{ value: '', label: 'Add roles in Settings → Master data' }]
            }
            disabled={roles.length === 0}
            required
          />
          <Input
            label="Phone"
            value={contactForm.phone}
            onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={modal === 'project'}
        onClose={() => setModal(null)}
        title="Add project"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="button" onClick={handleAddProject}>Save project</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Project code"
            value={projectForm.code}
            onChange={(e) => setProjectForm((f) => ({ ...f, code: e.target.value }))}
            required
          />
          <Input
            label="Project name"
            value={projectForm.name}
            onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Location"
            value={projectForm.location}
            onChange={(e) => setProjectForm((f) => ({ ...f, location: e.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={modal === 'link'}
        onClose={() => setModal(null)}
        title={selectedProject ? `Assign to ${selectedProject.code}` : 'Assign contact'}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="button" onClick={handleLinkContact}>Assign</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Contact"
            value={linkForm.contactId}
            onChange={(e) => {
              const contactId = e.target.value
              const contact = contacts.find((c) => c.id === contactId)
              const fallback = roles[0]?.code ?? 'CLIENT_PM'
              const role = projectRoleCodeForContact(contact, roles, fallback)
              setLinkForm((f) => ({ ...f, contactId, role }))
            }}
            options={[
              { value: '', label: 'Select contact' },
              ...contacts.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            label="Role on this project"
            value={linkForm.role}
            onChange={(e) => setLinkForm((f) => ({ ...f, role: e.target.value }))}
            options={roles.map((r) => ({ value: r.code, label: r.label }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={linkForm.isPrimary}
              onChange={(e) => setLinkForm((f) => ({ ...f, isPrimary: e.target.checked }))}
            />
            Primary contact for this project
          </label>
          <p className="text-xs text-text-secondary">
            One person can have multiple roles—assign again with a different role if needed.
          </p>
        </div>
      </Modal>
    </div>
  )
}
