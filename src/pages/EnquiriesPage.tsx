import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { enquiryService } from '@/services/enquiryService'
import { WorkflowDisplayChip } from '@/components/operations/StageChip'
import { OPERATIONS_WORKFLOW, resolveWorkflowDisplayStage } from '@/lib/operationsWorkflow'
import { PageToolbar } from '@/components/layout/PageToolbar'
import { KanbanBoard } from '@/components/views/KanbanBoard'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { useViewStore } from '@/store/viewStore'
import { useApiData } from '@/hooks/useApiData'
import { formatDate } from '@/lib/calculations'
import type { Enquiry, WorkflowDisplayStage } from '@/types/enquiry'
import { usePortalRoles } from '@/hooks/usePortalRoles'
import { canCreateEnquiry, isAccountsOnlyUser, isDesignerOnlyUser } from '@/lib/portalAccess'

const filters: { key: WorkflowDisplayStage | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  ...OPERATIONS_WORKFLOW.map((s) => ({ key: s.stage, label: s.stepperLabel })),
]

const kanbanColumns = OPERATIONS_WORKFLOW.map((s) => ({
  id: s.stage,
  title: s.stepperLabel,
}))

function enrichEnquiry(e: Enquiry): Enquiry {
  return enquiryService.withEffectiveStage(e)
}

export function EnquiriesPage() {
  const navigate = useNavigate()
  const roles = usePortalRoles()
  const showNewEnquiry = canCreateEnquiry(roles)
  const designerInbox = isDesignerOnlyUser(roles)
  const accountsInbox = isAccountsOnlyUser(roles)
  const stageFilters = accountsInbox
    ? filters.filter((f) => ['all', 'approval_processing'].includes(f.key))
    : designerInbox
      ? filters.filter((f) => ['all', 'enquiry', 'design_review'].includes(f.key))
      : filters
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<WorkflowDisplayStage | 'all'>('all')
  const view = useViewStore((s) => s.preferences.enquiries)
  const dataTick = useApiData()

  const enquiries = useMemo(() => {
    let list = enquiryService.filterByStage(filter).map(enrichEnquiry)
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(
      (e) =>
        e.enquiryNo.toLowerCase().includes(q) ||
        e.projectName.toLowerCase().includes(q) ||
        e.customerName.toLowerCase().includes(q),
    )
  }, [search, filter, dataTick])

  const open = (id: string) => navigate(`/enquiries/${id}`)

  return (
    <div className="space-y-6">
      <PageToolbar
        screen="enquiries"
        actions={
          showNewEnquiry ? (
            <Button size="sm" onClick={() => navigate('/enquiries/new')}>
              <Plus className="w-4 h-4" />
              New Enquiry
            </Button>
          ) : undefined
        }
      />

      {designerInbox && (
        <p className="text-sm text-text-secondary">
          Showing enquiries assigned to you as design in-charge (design review only).
        </p>
      )}

      {accountsInbox && (
        <p className="text-sm text-text-secondary">
          Showing enquiries in approval processing — submitted to accounts through PO approval.
        </p>
      )}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={
          designerInbox
            ? 'Search your assigned enquiries...'
            : accountsInbox
              ? 'Search approval queue...'
              : 'Search enquiries...'
        }
      />

      {view !== 'kanban' && (
        <div className="flex flex-wrap gap-2">
          {stageFilters.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}>
              <Chip variant={filter === f.key ? 'primary' : 'default'}>{f.label}</Chip>
            </button>
          ))}
        </div>
      )}

      {enquiries.length === 0 && (
        <p className="text-center text-text-secondary py-12">
          {designerInbox
            ? 'No enquiries are assigned to you yet. Your supervisor will assign design in-charge when review starts.'
            : accountsInbox
              ? 'No enquiries are waiting in approval processing right now.'
              : 'No enquiries match your filter.'}
        </p>
      )}

      {view === 'card' && enquiries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enquiries.map((enq) => (
            <Card key={enq.id} hover onClick={() => open(enq.id)}>
              <div className="flex justify-between items-start mb-3">
                <p className="font-semibold">{enq.enquiryNo}</p>
                <WorkflowDisplayChip enquiry={enq} />
              </div>
              <p className="text-sm font-medium">{enq.projectName}</p>
              <p className="text-sm text-text-secondary">{enq.customerName}</p>
              <p className="text-xs text-text-secondary mt-2">
                {formatDate(enq.enquiryDate)} · {enq.personInChargeName ?? enq.salesPerson ?? '—'}
              </p>
            </Card>
          ))}
        </div>
      )}

      {view === 'grid' && enquiries.length > 0 && (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-left">
                  <th className="py-3 px-3">Enquiry No</th>
                  <th className="py-3 px-3">Project</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">PIC</th>
                  <th className="py-3 px-3">Stage</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((enq) => (
                  <tr
                    key={enq.id}
                    onClick={() => open(enq.id)}
                    className="border-b border-border hover:bg-background cursor-pointer"
                  >
                    <td className="py-3 px-3 font-medium">{enq.enquiryNo}</td>
                    <td className="py-3 px-3">{enq.projectName}</td>
                    <td className="py-3 px-3">{enq.customerName}</td>
                    <td className="py-3 px-3">{formatDate(enq.enquiryDate)}</td>
                    <td className="py-3 px-3">{enq.personInChargeName ?? enq.salesPerson ?? '—'}</td>
                    <td className="py-3 px-3"><WorkflowDisplayChip enquiry={enq} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'kanban' && enquiries.length > 0 && (
        <KanbanBoard
          columns={kanbanColumns.map((col) => ({
            ...col,
            items: enquiries.filter((e) => resolveWorkflowDisplayStage(e) === col.id),
          }))}
          getKey={(e) => e.id}
          onCardClick={(e) => open(e.id)}
          renderCard={(enq) => (
            <>
              <p className="font-semibold text-sm">{enq.enquiryNo}</p>
              <p className="text-sm mt-1">{enq.projectName}</p>
              <p className="text-xs text-text-secondary mt-1">{enq.customerName}</p>
            </>
          )}
        />
      )}
    </div>
  )
}
