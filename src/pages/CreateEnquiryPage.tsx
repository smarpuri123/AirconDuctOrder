import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { enquiryService } from '@/services/enquiryService'
import { crmService } from '@/services/crmService'
import { ProjectCombobox } from '@/components/enquiry/ProjectCombobox'
import { masterService } from '@/services/masterService'
import { orgService } from '@/services/orgService'
import type { Employee } from '@/types/org'
import { getCurrentUser } from '@/lib/currentUser'
import { useAuthStore } from '@/store/authStore'
import { userService } from '@/services/userService'
import { getTodayISO } from '@/lib/calculations'
import { ENQUIRY_FILE_ACCEPT, filesToPayloads } from '@/lib/enquiryDocuments'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FileUploadZone } from '@/components/ui/FileUploadZone'
import type { CreateEnquiryInput } from '@/types/enquiry'
import type { Client, Contact, MasterLookup, ProjectSummary } from '@/types/crm'

export function CreateEnquiryPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [priorities, setPriorities] = useState<MasterLookup[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [personInChargeId, setPersonInChargeId] = useState('')
  const [showContact, setShowContact] = useState(false)
  const [showExtras, setShowExtras] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [creatingProject, setCreatingProject] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [contactId, setContactId] = useState('')
  const [form, setForm] = useState({
    enquiryDate: getTodayISO(),
    expectedCompletion: '',
    salesPerson: getCurrentUser().name,
    priority: 'normal' as CreateEnquiryInput['priority'],
    source: '',
    remarks: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    Promise.all([
      crmService.listClients(),
      masterService.enquiryPriorities(),
      orgService.listResponsibilityAssignees(),
      userService.listAssignableUsers(),
    ]).then(([c, p, emps, assignable]) => {
      setClients(c)
      setPriorities(p)
      setEmployees(emps)
      const authUserId = useAuthStore.getState().user?.id
      const self = assignable.find((row) => row.userId === authUserId)
      let picId = self?.employeeId ?? ''
      if (!picId) {
        const byName = emps.find((e) => e.name === getCurrentUser().name)
        if (byName) picId = byName.id
      }
      if (!picId && emps[0]) picId = emps[0].id
      if (picId) setPersonInChargeId(picId)
      if (c.length > 0) setCustomerId(c[0].id)
      const actor = getCurrentUser()
      setForm((f) => ({ ...f, salesPerson: actor.name }))
    })
  }, [])

  const selectedClient = useMemo(() => clients.find((c) => c.id === customerId), [clients, customerId])
  const projects: ProjectSummary[] = selectedClient?.projects ?? []
  const contacts: Contact[] = (selectedClient?.contacts ?? []).filter((c) => c.active)
  const selectedContact = contacts.find((c) => c.id === contactId)
  const selectedProject = projects.find((p) => p.id === projectId)

  useEffect(() => {
    setProjectId('')
    setContactId('')
  }, [customerId])

  useEffect(() => {
    return () => {
      setPendingFiles([])
    }
  }, [])

  useEffect(() => {
    if (!selectedContact) return
    setForm((prev) => ({
      ...prev,
      phone: selectedContact.phone ?? prev.phone,
      email: selectedContact.email ?? prev.email,
    }))
  }, [selectedContact])

  const priorityOptions = priorities.length
    ? priorities.map((p) => ({ value: p.code.toLowerCase(), label: p.label }))
    : [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
      ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!customerId) {
      setError('Select a client.')
      return
    }
    if (!projectId) {
      setError('Select a project, or type a name and add it.')
      return
    }

    const filePayloads = pendingFiles.length ? await filesToPayloads(pendingFiles) : undefined

    const payload: CreateEnquiryInput = {
      customerId,
      projectId,
      contactId: contactId || undefined,
      customerName: selectedClient?.name ?? '',
      contactPerson: selectedContact?.name,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      projectName: selectedProject?.name ?? '',
      location: selectedProject?.location ?? '',
      enquiryDate: form.enquiryDate,
      expectedCompletion: form.expectedCompletion || undefined,
      personInChargeId: personInChargeId || undefined,
      salesPerson: form.salesPerson.trim() || undefined,
      priority: form.priority,
      source: form.source || undefined,
      remarks: form.remarks || undefined,
      files: filePayloads,
    }

    try {
      const enquiry = await enquiryService.createEnquiry(payload)
      setPendingFiles([])
      navigate(`/enquiries/${enquiry.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create enquiry')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <button
        type="button"
        onClick={() => navigate('/enquiries')}
        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Enquiries
      </button>

      <div>
        <h2 className="text-2xl font-semibold">New Customer Enquiry</h2>
        <p className="text-text-secondary text-sm mt-1">
          Pick client and project from masters. Contact and client input files are optional at this step.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <h3 className="font-semibold mb-4">Client &amp; project</h3>
          <div className="space-y-4">
            <Select
              label="Client"
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={[
                { value: '', label: 'Select client' },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />

            <ProjectCombobox
              key={customerId}
              clients={clients}
              projects={projects}
              value={projectId}
              disabled={!customerId}
              busy={creatingProject}
              onSelect={setProjectId}
              onCreate={async ({ name, code }) => {
                setError('')
                setCreatingProject(true)
                try {
                  const project = await crmService.createProject(customerId, {
                    code,
                    name,
                  })
                  setClients((prev) =>
                    prev.map((client) =>
                      client.id === customerId
                        ? { ...client, projects: [...(client.projects ?? []), project] }
                        : client,
                    ),
                  )
                  setProjectId(project.id)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to add project')
                  throw err
                } finally {
                  setCreatingProject(false)
                }
              }}
            />

            <Select
              label="Responsibility (person in charge)"
              value={personInChargeId}
              onChange={(e) => setPersonInChargeId(e.target.value)}
              options={[
                {
                  value: '',
                  label: employees.length ? 'Select responsible person' : 'Add portal users in Settings',
                },
                ...employees.map((e) => ({
                  value: e.id,
                  label: `${e.name}${e.jobRoles.length ? ` — ${e.jobRoles.map((r) => r.label).join(', ')}` : ''}`,
                })),
              ]}
            />

            <p className="text-xs text-text-secondary">
              If the project is not in the list, type its name, then set a code that is not already used. You can still edit masters in{' '}
              <button type="button" className="text-primary underline" onClick={() => navigate('/clients')}>
                Clients
              </button>
              .
            </p>
          </div>
        </Card>

        <Card>
          <button
            type="button"
            className="w-full flex items-center justify-between font-semibold text-left"
            onClick={() => setShowContact((v) => !v)}
          >
            Contact (optional)
            {showContact ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showContact && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Contact person"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                options={[
                  { value: '', label: 'None' },
                  ...contacts.map((c) => ({
                    value: c.id,
                    label: `${c.name}${c.designation ? ` — ${c.designation}` : ''}`,
                  })),
                ]}
              />
              <Input
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="Email"
                type="email"
                className="sm:col-span-2"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Client input files (optional)</h3>
          <p className="text-sm text-text-secondary mb-3">
            Upload drawings or specs in any common format. You can add revised files later from the enquiry page.
          </p>
          <FileUploadZone
            accept={ENQUIRY_FILE_ACCEPT}
            files={pendingFiles}
            onFilesChange={setPendingFiles}
          />
        </Card>

        <Card>
          <button
            type="button"
            className="w-full flex items-center justify-between font-semibold text-left"
            onClick={() => setShowExtras((v) => !v)}
          >
            Scheduling &amp; notes
            {showExtras ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showExtras && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Enquiry date"
                type="date"
                value={form.enquiryDate}
                onChange={(e) => setForm((f) => ({ ...f, enquiryDate: e.target.value }))}
              />
              <Input
                label="Expected completion"
                type="date"
                value={form.expectedCompletion}
                onChange={(e) => setForm((f) => ({ ...f, expectedCompletion: e.target.value }))}
              />
              <Select
                label="Priority"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as CreateEnquiryInput['priority'] }))
                }
                options={priorityOptions}
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Remarks"
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}
        </Card>

        {error && <p className="text-danger text-sm">{error}</p>}

        <Button type="submit">Create enquiry</Button>
      </form>
    </div>
  )
}
