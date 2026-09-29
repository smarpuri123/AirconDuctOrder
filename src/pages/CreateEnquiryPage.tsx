import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { enquiryService } from '@/services/enquiryService'
import { crmService } from '@/services/crmService'
import { masterService } from '@/services/masterService'
import { orgService } from '@/services/orgService'
import type { Employee } from '@/types/org'
import { getCurrentUser } from '@/lib/currentUser'
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
  const [useNewProject, setUseNewProject] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const [customerId, setCustomerId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [contactId, setContactId] = useState('')

  const [newProject, setNewProject] = useState({ name: '', location: '' })
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
      orgService.listEmployeesForStage('enquiry'),
    ]).then(([c, p, emps]) => {
      setClients(c)
      setPriorities(p)
      setEmployees(emps)
      const actor = getCurrentUser().name
      const match = emps.find((e) => e.name === actor)
      if (match) setPersonInChargeId(match.id)
      else if (emps[0]) setPersonInChargeId(emps[0].id)
      if (c.length > 0) setCustomerId(c[0].id)
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
    if (!useNewProject && !projectId) {
      setError('Select a project, or add a new one.')
      return
    }
    if (useNewProject && !newProject.name.trim()) {
      setError('Enter a name for the new project.')
      return
    }

    const filePayloads = pendingFiles.length ? await filesToPayloads(pendingFiles) : undefined

    const payload: CreateEnquiryInput = {
      customerId,
      projectId: useNewProject ? undefined : projectId,
      contactId: contactId || undefined,
      customerName: selectedClient?.name ?? '',
      contactPerson: selectedContact?.name,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      projectName: useNewProject ? newProject.name.trim() : (selectedProject?.name ?? ''),
      location: useNewProject ? newProject.location.trim() : (selectedProject?.location ?? ''),
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

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useNewProject}
                onChange={(e) => setUseNewProject(e.target.checked)}
              />
              Quick-add new project for this client
            </label>

            {!useNewProject ? (
              <Select
                label="Project"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                options={[
                  { value: '', label: projects.length ? 'Select project' : 'No projects — add one in Clients' },
                  ...projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
                ]}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Project name"
                  required
                  value={newProject.name}
                  onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
                />
                <Input
                  label="Location"
                  value={newProject.location}
                  onChange={(e) => setNewProject((p) => ({ ...p, location: e.target.value }))}
                />
              </div>
            )}

            <Select
              label="Person in charge (internal)"
              value={personInChargeId}
              onChange={(e) => setPersonInChargeId(e.target.value)}
              options={[
                { value: '', label: employees.length ? 'Select PIC' : 'Add employees in Settings' },
                ...employees.map((e) => ({
                  value: e.id,
                  label: `${e.name}${e.jobRoles[0] ? ` — ${e.jobRoles[0].label}` : ''}`,
                })),
              ]}
            />

            <p className="text-xs text-text-secondary">
              Maintain masters in{' '}
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
