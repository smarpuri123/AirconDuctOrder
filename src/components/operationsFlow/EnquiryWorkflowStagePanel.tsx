import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FolderOpen, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import {
  ENQUIRY_FILE_ACCEPT,
  QUOTATION_FILE_ACCEPT,
  downloadEnquiryDocument,
  filesToPayloadsWithProgress,
} from '@/lib/enquiryDocuments'
import { formatDate } from '@/lib/calculations'
import {
  buildEnquiryWorkflowRow,
  type WorkflowStageCell,
  type WorkflowStageId,
} from '@/lib/operationsFlow/enquiryTrack'
import { enquiryService } from '@/services/enquiryService'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { orgService } from '@/services/orgService'
import type { Employee } from '@/types/org'
import { hasDuctScheduleImported } from '@/lib/enquiryWorkflow'
import {
  canApproveQuoteForClient,
  canManageAccountsWorkflow,
  canManageDesignWorkflow,
  canManageProductionOnEnquiry,
} from '@/lib/portalAccess'
import { usePortalRoles } from '@/hooks/usePortalRoles'
import type { ProductionProcess } from '@/types/production'
import type { ProductionTrackAction } from '@/lib/productionTrack'
import { ProductionProcessPanel } from '@/components/operations/ProductionProcessPanel'

export type WorkflowPanelSelection =
  | { type: 'stage'; enquiryId: string; cell: WorkflowStageCell }
  | { type: 'dispatch'; enquiryId: string; dispatchId: string }
  | null

type Props = {
  selection: WorkflowPanelSelection
  onClose: () => void
  onUpdated: () => void
}

export function EnquiryWorkflowStagePanel({ selection, onClose, onUpdated }: Props) {
  const navigate = useNavigate()
  const roles = usePortalRoles()
  const [error, setError] = useState('')
  const [designAssignees, setDesignAssignees] = useState<Employee[]>([])
  const [assigneeId, setAssigneeId] = useState('')
  const [assigneeRole, setAssigneeRole] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyProcess, setBusyProcess] = useState<ProductionProcess | null>(null)
  const [pendingDesignFiles, setPendingDesignFiles] = useState<File[]>([])
  const [pendingQuoteFiles, setPendingQuoteFiles] = useState<File[]>([])
  const quoteInputRef = useRef<HTMLInputElement>(null)
  const designOutputInputRef = useRef<HTMLInputElement>(null)

  const enquiry = selection ? enquiryService.getEnquiryWithLiveStage(selection.enquiryId) : undefined
  const order = enquiry?.orderId ? orderService.getOrderById(enquiry.orderId) : undefined

  useEffect(() => {
    if (!selection || selection.type !== 'stage') return
    if (selection.cell.id !== 'design_assignment') return
    orgService.listEmployeesForStage('design_review').then((list) => {
      setDesignAssignees(list)
      if (list[0]) {
        setAssigneeId(list[0].id)
        setAssigneeRole(list[0].jobRoles[0]?.code ?? '')
      }
    })
  }, [selection])

  if (!selection || !enquiry) return null

  const liveRow = buildEnquiryWorkflowRow(enquiry, order, dispatchService.getDispatches())
  const cell =
    selection.type === 'stage'
      ? (liveRow.cells.find((c) => c.id === selection.cell.id) ?? selection.cell)
      : null
  const dispatchRecord =
    selection.type === 'dispatch' ? dispatchService.getDispatchById(selection.dispatchId) : undefined

  const title =
    selection.type === 'stage'
      ? `${enquiry.enquiryNo} · ${cell?.label}`
      : `${enquiry.enquiryNo} · ${dispatchRecord?.dispatchNo ?? 'Dispatch'}`

  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    setBusy(true)
    try {
      await fn()
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const design = enquiry.designReview
  const canDesign = canManageDesignWorkflow(roles)
  const canAccounts = canManageAccountsWorkflow(roles)
  const canApproveQuote = canApproveQuoteForClient(roles)
  const canProduction = Boolean(order) && canManageProductionOnEnquiry(roles)
  const isDesignerAssigned = Boolean(enquiry.currentAssigneeId) || design.status !== 'pending'
  const quoteDocs = enquiry.quotationDocuments ?? []
  const designOutputDocs = enquiry.designOutputDocuments ?? []
  const hasQuoteDoc = quoteDocs.length > 0

  const renderDesignOutputDocs = (allowUpload: boolean) => (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-text-primary">Design files (shared with client)</p>
          <p className="text-[11px] text-text-secondary">
            Shared with client during approval (Schedule Excel is internal only).
          </p>
        </div>
        {allowUpload && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5">
            <input
              ref={designOutputInputRef}
              type="file"
              multiple
              accept={ENQUIRY_FILE_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setPendingDesignFiles(Array.from(e.target.files))
                }
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => designOutputInputRef.current?.click()}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {pendingDesignFiles.length > 0 ? 'Change File' : 'Browse Design File'}
            </Button>
            {pendingDesignFiles.length > 0 && (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const payloads = await filesToPayloadsWithProgress(pendingDesignFiles)
                    await enquiryService.uploadDesignOutputFiles(enquiry.id, payloads)
                    setPendingDesignFiles([])
                  })
                }
              >
                <Upload className="w-3.5 h-3.5" />
                {busy ? 'Uploading…' : `Upload ${pendingDesignFiles.length === 1 ? 'Design File' : `${pendingDesignFiles.length} Files`}`}
              </Button>
            )}
          </div>
        )}
      </div>
      {pendingDesignFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded bg-primary/5 border border-primary/20 text-xs">
          <span className="font-semibold text-primary">Selected:</span>
          {pendingDesignFiles.map((file, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 bg-white border border-border px-1.5 py-0.5 rounded text-[11px]">
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                type="button"
                onClick={() => setPendingDesignFiles((prev) => prev.filter((_, i) => i !== idx))}
                disabled={busy}
                className="text-text-secondary hover:text-error ml-0.5"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setPendingDesignFiles([])}
            disabled={busy}
            className="text-text-secondary hover:underline ml-auto text-[11px]"
          >
            Clear
          </button>
        </div>
      )}
      {designOutputDocs.length > 0 ? (
        <ul className="space-y-1.5">
          {designOutputDocs.map((doc, idx) => {
            const rev = doc.inputRevision && doc.inputRevision > 0 ? doc.inputRevision : designOutputDocs.length - idx
            return (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 rounded border border-border bg-white px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{doc.fileName}</span>
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    Rev {String(rev).padStart(2, '0')}
                  </span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-primary shrink-0 px-1.5 py-1"
                  onClick={() => downloadEnquiryDocument({ ...doc, enquiryId: enquiry.id })}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-text-secondary">No client design files uploaded yet.</p>
      )}
    </div>
  )

  const renderQuoteDocs = () => (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-text-primary">Quotation documents (PDF / Excel)</p>
          <p className="text-[11px] text-text-secondary">
            Upload Quote revisions or download for review and client approval.
          </p>
        </div>
        {canAccounts && !enquiry.orderId && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5">
            <input
              ref={quoteInputRef}
              type="file"
              multiple
              accept={QUOTATION_FILE_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setPendingQuoteFiles(Array.from(e.target.files))
                }
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => quoteInputRef.current?.click()}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {pendingQuoteFiles.length > 0 ? 'Change File' : 'Browse Quote File'}
            </Button>
            {pendingQuoteFiles.length > 0 && (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const payloads = await filesToPayloadsWithProgress(pendingQuoteFiles)
                    await enquiryService.uploadQuotationFiles(enquiry.id, payloads)
                    setPendingQuoteFiles([])
                  })
                }
              >
                <Upload className="w-3.5 h-3.5" />
                {busy ? 'Uploading…' : `Upload ${pendingQuoteFiles.length === 1 ? 'Quote Document' : `${pendingQuoteFiles.length} Documents`}`}
              </Button>
            )}
          </div>
        )}
      </div>
      {pendingQuoteFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded bg-primary/5 border border-primary/20 text-xs">
          <span className="font-semibold text-primary">Selected:</span>
          {pendingQuoteFiles.map((file, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 bg-white border border-border px-1.5 py-0.5 rounded text-[11px]">
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                type="button"
                onClick={() => setPendingQuoteFiles((prev) => prev.filter((_, i) => i !== idx))}
                disabled={busy}
                className="text-text-secondary hover:text-error ml-0.5"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setPendingQuoteFiles([])}
            disabled={busy}
            className="text-text-secondary hover:underline ml-auto text-[11px]"
          >
            Clear
          </button>
        </div>
      )}
      {quoteDocs.length > 0 ? (
        <ul className="space-y-1.5">
          {quoteDocs.map((doc, idx) => {
            const rev = doc.inputRevision && doc.inputRevision > 0 ? doc.inputRevision : quoteDocs.length - idx
            return (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 rounded border border-border bg-white px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{doc.fileName}</span>
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    Rev {String(rev).padStart(2, '0')}
                  </span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-primary shrink-0 px-1.5 py-1"
                  onClick={() => downloadEnquiryDocument({ ...doc, enquiryId: enquiry.id })}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-text-secondary">
          No Quote document uploaded yet. Click &ldquo;Upload Quote&rdquo; to attach a PDF or Excel file.
        </p>
      )}
    </div>
  )

  const stageActions = (stageId: WorkflowStageId) => {
    switch (stageId) {
      case 'design_assignment':
        if (isDesignerAssigned) {
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => navigate(`/enquiries/${enquiry.id}`)}>
                Open enquiry workspace
              </Button>
            </div>
          )
        }
        return (
          <div className="space-y-3">
            {designAssignees.length === 0 ? (
              <p className="text-sm text-text-secondary">No design staff available.</p>
            ) : (
              <>
                <Select
                  label="Design in-charge"
                  value={assigneeId}
                  disabled={busy || isDesignerAssigned}
                  onChange={(e) => {
                    const id = e.target.value
                    setAssigneeId(id)
                    const emp = designAssignees.find((x) => x.id === id)
                    setAssigneeRole(emp?.jobRoles[0]?.code ?? '')
                  }}
                  options={designAssignees.map((emp) => ({
                    value: emp.id,
                    label: emp.name,
                  }))}
                />
                {canDesign && (
                  <Button
                    disabled={busy || !assigneeId || isDesignerAssigned}
                    onClick={() =>
                      run(() =>
                        enquiryService.startDesignReview(enquiry.id, {
                          assigneeId,
                          assigneeRoleCode: assigneeRole || undefined,
                        }),
                      )
                    }
                  >
                    Assign designer
                  </Button>
                )}
              </>
            )}
          </div>
        )
      case 'design_work':
        return (
          <div className="space-y-3">
            {renderDesignOutputDocs(canDesign && !enquiry.orderId)}
            <div className="flex flex-wrap gap-2">
              {canDesign && design.status === 'pending' && enquiry.currentAssigneeId && (
                <Button disabled={busy} onClick={() => run(() => enquiryService.beginDesignWork(enquiry.id))}>
                  Start design work
                </Button>
              )}
              {canDesign && design.status === 'in_review' && hasDuctScheduleImported(enquiry) && (
                <Button disabled={busy} onClick={() => run(() => enquiryService.submitDesignToAccounts(enquiry.id))}>
                  Submit to accounts
                </Button>
              )}
              <Button variant="secondary" onClick={() => navigate(`/enquiries/${enquiry.id}`)}>
                Open enquiry workspace
              </Button>
            </div>
          </div>
        )
      case 'quotation_prep':
        return (
          <div className="space-y-3">
            {renderDesignOutputDocs(false)}
            {renderQuoteDocs()}
            {canAccounts && design.status === 'submitted_to_accounts' && (
              <Button
                disabled={busy || !hasQuoteDoc}
                onClick={() => run(() => enquiryService.markPoForReview(enquiry.id))}
              >
                Submit Quote for Review
              </Button>
            )}
          </div>
        )
      case 'quotation_approval':
        return (
          <div className="space-y-3">
            {renderDesignOutputDocs(false)}
            {renderQuoteDocs()}
            {design.status === 'po_for_review' && canApproveQuote && (
              <Button disabled={busy} onClick={() => run(() => enquiryService.markPoForApproval(enquiry.id))}>
                Approve Quote for Submission to Client
              </Button>
            )}
            {design.status === 'po_for_review' && !canApproveQuote && (
              <p className="text-xs text-text-secondary">
                Admin or Supervisor downloads the Quote above and approves it for submission to the client.
              </p>
            )}
          </div>
        )
      case 'quotation_submitted':
        return (
          <div className="space-y-3">
            {renderDesignOutputDocs(false)}
            {renderQuoteDocs()}
            {canAccounts && design.status === 'po_for_approval' && (
              <Button disabled={busy} onClick={() => run(() => enquiryService.approveDesign(enquiry.id))}>
                Approve Quote (Client Approved)
              </Button>
            )}
          </div>
        )
      case 'customer_approval':
        return (
          <div className="space-y-3">
            {renderDesignOutputDocs(false)}
            {renderQuoteDocs()}
            {canAccounts && design.status === 'po_for_approval' && (
              <Button disabled={busy} onClick={() => run(() => enquiryService.approveDesign(enquiry.id))}>
                Approve Quote (Client Approved)
              </Button>
            )}
            {order && (
              <Button variant="secondary" onClick={() => navigate(`/orders/${order.id}`)}>
                Open Order ({order.orderNo})
              </Button>
            )}
          </div>
        )
      case 'production_flat':
      case 'production_plasma':
        return order && canProduction ? (
          <ProductionProcessPanel
            order={order}
            inProduction={order.status === 'production'}
            busyProcess={busyProcess}
            onTrackAction={async (process, action: ProductionTrackAction) => {
              setBusyProcess(process)
              setError('')
              try {
                await orderService.updateProductionTrack(order.id, process, action)
                onUpdated()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Production update failed')
              } finally {
                setBusyProcess(null)
              }
            }}
            onMarkReady={() => run(() => orderService.markProductionReady(order.id))}
          />
        ) : null
      case 'ready_dispatch':
        return order ? (
          <Button variant="secondary" onClick={() => navigate(`/orders/${order.id}`)}>
            Open order & dispatches
          </Button>
        ) : null
      default:
        return (
          <Button variant="secondary" onClick={() => navigate(`/enquiries/${enquiry.id}`)}>
            Open enquiry
          </Button>
        )
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4 text-sm">
        {error && <p className="text-danger text-sm">{error}</p>}
        {selection.type === 'stage' && cell && (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-text-secondary">Status</dt>
                <dd className="font-medium capitalize">{cell.status.replace('_', ' ')}</dd>
              </div>
              {cell.assigneeName && (
                <div>
                  <dt className="text-xs text-text-secondary">Assignee</dt>
                  <dd className="font-medium">{cell.assigneeName}</dd>
                </div>
              )}
              {cell.startedAt && (
                <div>
                  <dt className="text-xs text-text-secondary">Started</dt>
                  <dd className="font-medium">{formatDate(cell.startedAt)}</dd>
                </div>
              )}
              {cell.completedAt && (
                <div>
                  <dt className="text-xs text-text-secondary">Completed</dt>
                  <dd className="font-medium">{formatDate(cell.completedAt)}</dd>
                </div>
              )}
            </dl>
            {cell.detail && <p className="text-text-secondary">{cell.detail}</p>}
            {stageActions(cell.id)}
          </>
        )}
        {selection.type === 'dispatch' && dispatchRecord && (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-text-secondary">Dispatch no.</dt>
                <dd className="font-medium font-mono">{dispatchRecord.dispatchNo}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Vehicle</dt>
                <dd className="font-medium">{dispatchRecord.vehicle.vehicleType}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Status</dt>
                <dd className="font-medium capitalize">{dispatchRecord.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Trip quantity</dt>
                <dd className="font-medium tabular-nums">{dispatchRecord.totalQuantity}</dd>
              </div>
              {liveRow.totalOrderQty > 0 && (
                <div>
                  <dt className="text-xs text-text-secondary">Order dispatch progress</dt>
                  <dd className="font-medium tabular-nums">
                    {liveRow.dispatchedQty}/{liveRow.totalOrderQty} dispatched ({liveRow.pendingDispatchQty}{' '}
                    pending)
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-text-secondary">Dispatch date</dt>
                <dd className="font-medium">{formatDate(dispatchRecord.dispatchDate)}</dd>
              </div>
            </dl>
            <Button onClick={() => navigate(`/dispatch/${dispatchRecord.id}`)}>
              Open dispatch detail
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
