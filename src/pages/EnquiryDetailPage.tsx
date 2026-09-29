import { useEffect, useState } from 'react'

import { useParams, useNavigate, Link } from 'react-router-dom'

import { enquiryService } from '@/services/enquiryService'

import { orderService } from '@/services/orderService'

import { EntityHeader } from '@/components/operations/EntityHeader'

import { DetailGrid } from '@/components/operations/DetailGrid'

import { ActivityTimeline } from '@/components/operations/ActivityTimeline'

import { WorkflowProgressSummary } from '@/components/operations/WorkflowProgressSummary'

import { SimpleWorkflowStepper } from '@/components/operations/SimpleWorkflowStepper'

import { StageChip } from '@/components/operations/StageChip'

import { Card } from '@/components/ui/Card'

import { Button } from '@/components/ui/Button'

import { Input } from '@/components/ui/Input'

import { Textarea } from '@/components/ui/Textarea'

import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProductionProcessPanel } from '@/components/operations/ProductionProcessPanel'
import { downloadEnquiryDocument } from '@/lib/enquiryDocuments'
import { isApiMode } from '@/lib/api'
import { Download } from 'lucide-react'
import type { ProductionProcess } from '@/types/production'

import { usePortalRoles } from '@/hooks/usePortalRoles'
import {
  canAccessDesignImport,
  canAccessDispatchList,
  canManageAccountsWorkflow as portalCanManageAccountsWorkflow,
  canManageDesignWorkflow,
  canManageEnquiryIntake,
  canManageProductionOnEnquiry,
  canSeeWorkflowAuditLog,
  canUploadClientInputFiles,
} from '@/lib/portalAccess'
import { DesignPoStatusBar, designStatusLabel } from '@/components/operations/DesignPoStatusBar'
import { orgService } from '@/services/orgService'
import type { Employee } from '@/types/org'
import { Select } from '@/components/ui/Select'
import { EnquiryDesignFiles } from '@/components/operations/EnquiryDesignFiles'
import { formatDate, getOrderBalanceQty, getOrderDispatchedQty } from '@/lib/calculations'
import {
  APPROVAL_PROCESSING_STATUSES,
  canEditDesignExtractionUi,
  canRequestDesignRevisionUi,
  canReturnToDesignUi,
  canRevertDesignStepUi,
  needsEnquiryIntake,
} from '@/lib/enquiryWorkflow'
import { canRevertOrderStepUi, orderRevertStepLabel } from '@/lib/orderWorkflow'



export function EnquiryDetailPage() {

  const { id } = useParams<{ id: string }>()

  const navigate = useNavigate()

  const [version, setVersion] = useState(0)

  const [formError, setFormError] = useState('')

  const [ductTags, setDuctTags] = useState('')

  const [totalQty, setTotalQty] = useState('')

  const [totalArea, setTotalArea] = useState('')

  const [designNotes, setDesignNotes] = useState('')

  const [busyProcess, setBusyProcess] = useState<ProductionProcess | null>(null)
  const roles = usePortalRoles()
  const [designAssignees, setDesignAssignees] = useState<Employee[]>([])
  const [designAssigneeId, setDesignAssigneeId] = useState('')
  const [designAssigneeRole, setDesignAssigneeRole] = useState('')
  const [savingExtraction, setSavingExtraction] = useState(false)
  const [returnToDesignReason, setReturnToDesignReason] = useState('')
  const [revisionReason, setRevisionReason] = useState('')
  const [workflowNote, setWorkflowNote] = useState('')



  const enquiry = enquiryService.getEnquiryWithLiveStage(id!)



  useEffect(() => {
    if (!isApiMode) return
    enquiryService.refresh().then(() => reload())
  }, [id])

  useEffect(() => {
    if (!enquiry) return
    const ready =
      enquiry.designReview.status === 'pending' &&
      !enquiry.orderId &&
      (enquiry.stage === 'design_review' || enquiry.stage === 'enquiry')
    if (!ready) return
    orgService.listEmployeesForStage('design_review').then((list) => {
      setDesignAssignees(list)
      if (list[0]) {
        setDesignAssigneeId(list[0].id)
        setDesignAssigneeRole(list[0].jobRoles[0]?.code ?? '')
      }
    })
  }, [enquiry?.id, enquiry?.stage, enquiry?.designReview.status, version])

  useEffect(() => {

    if (!enquiry) return

    const dr = enquiry.designReview

    if (dr.ductTags) setDuctTags(String(dr.ductTags))

    if (dr.totalQty) setTotalQty(String(dr.totalQty))

    if (dr.totalArea) setTotalArea(String(dr.totalArea))

    if (dr.notes) setDesignNotes(dr.notes)

  }, [enquiry?.id, version])



  if (!enquiry) return <p className="text-text-secondary">Enquiry not found.</p>



  const order = enquiry.orderId ? orderService.getOrderById(enquiry.orderId) : undefined

  const steps = enquiryService.getWorkflowSteps(enquiry)

  const design = enquiry.designReview

  const reload = () => setVersion((n) => n + 1)

  const actionError = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback



  const canCompleteIntake =
    needsEnquiryIntake(enquiry) && !enquiry.orderId && canManageEnquiryIntake(roles)
  const canStartReview =
    enquiry.stage === 'design_review' &&
    design.status === 'pending' &&
    !enquiry.orderId &&
    canManageEnquiryIntake(roles)

  const showAcceptAndAssignPanel =
    canManageEnquiryIntake(roles) &&
    design.status === 'pending' &&
    !enquiry.orderId &&
    (canCompleteIntake || canStartReview)

  const needsRevisionResume = design.status === 'revision_needed'

  const canManageAccountsWorkflow = portalCanManageAccountsWorkflow(roles)
  const showWorkflowAudit = canSeeWorkflowAuditLog(roles)
  const showProductionPanel = Boolean(order) && canManageProductionOnEnquiry(roles)
  const showOrderSummary =
    Boolean(order) &&
    (showProductionPanel || canManageAccountsWorkflow || showWorkflowAudit)

  const orderSnapshot = order
    ? { status: order.status, items: order.items }
    : undefined

  const canEditExtraction =
    canManageDesignWorkflow(roles) && canEditDesignExtractionUi(enquiry, orderSnapshot)
  const showExtractionPanel = [
    'in_review',
    'revision_needed',
    'submitted_to_accounts',
    'po_for_review',
    'po_for_approval',
    'approved',
  ].includes(design.status)

  const canSubmitToAccounts =
    design.status === 'in_review' && !enquiry.orderId && canManageDesignWorkflow(roles)
  const canMarkPoReview = design.status === 'submitted_to_accounts' && canManageAccountsWorkflow
  const canMarkPoApproval = design.status === 'po_for_review' && canManageAccountsWorkflow
  const canApprovePo = design.status === 'po_for_approval' && canManageAccountsWorkflow
  const canReturnToDesign = canReturnToDesignUi(enquiry, orderSnapshot)
  const canRevertDesignStep =
    canRevertDesignStepUi(enquiry, orderSnapshot) && canManageAccountsWorkflow
  const canRequestRedesign =
    canRequestDesignRevisionUi(enquiry, orderSnapshot) && canManageDesignWorkflow(roles)
  const canRevertOrder =
    order && canManageProductionOnEnquiry(roles) ? canRevertOrderStepUi(order) : false

  const canConvert =
    design.status === 'approved' && !enquiry.orderId && canManageAccountsWorkflow

  const inProduction = order?.status === 'production'

  const balanceQty = order ? getOrderBalanceQty(order) : 0

  const productionApproved = order?.productionApproved ?? false



  const handleAcceptAndAssignDesign = async () => {
    setFormError('')
    if (!designAssigneeId) {
      setFormError('Select the design in-charge for this enquiry.')
      return
    }
    try {
      await enquiryService.acceptEnquiryAndAssignDesign(enquiry.id, {
        assigneeId: designAssigneeId,
        assigneeRoleCode: designAssigneeRole || undefined,
      })
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to accept and assign enquiry')
    }
  }



  const handleResumeRevision = async () => {
    setFormError('')
    try {
      await enquiryService.resumeDesignRevision(enquiry.id)
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to resume design revision'))
    }
  }



  const handleSaveExtraction = async () => {
    if (savingExtraction) return
    setFormError('')
    const tags = parseInt(ductTags, 10)
    const qty = parseInt(totalQty, 10)
    const area = parseFloat(totalArea)
    if (!tags || !qty || !area) {
      setFormError('Enter duct tags, total quantity, and total area.')
      return
    }
    const prev = enquiry.designReview
    const notes = designNotes.trim()
    const prevNotes = (prev.notes ?? '').trim()
    if (
      prev.ductTags === tags &&
      prev.totalQty === qty &&
      prev.totalArea === area &&
      prevNotes === notes
    ) {
      setFormError('No changes to save.')
      return
    }
    setSavingExtraction(true)
    try {
      await enquiryService.saveDesignExtraction(enquiry.id, {
        ductTags: tags,
        totalQty: qty,
        totalArea: area,
        notes: designNotes,
      })
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to save duct extraction'))
    } finally {
      setSavingExtraction(false)
    }
  }



  const handleSubmitToAccounts = async () => {
    setFormError('')
    try {
      const result = await enquiryService.submitDesignToAccounts(enquiry.id)
      if (!result) {
        setFormError('Save duct extraction before submitting to accounts.')
        return
      }
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to submit to accounts'))
    }
  }

  const handleMarkPoReview = async () => {
    setFormError('')
    try {
      const result = await enquiryService.markPoForReview(enquiry.id)
      if (!result) {
        setFormError('Could not move to PO review.')
        return
      }
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to update PO status'))
    }
  }

  const handleMarkPoApproval = async () => {
    setFormError('')
    try {
      const result = await enquiryService.markPoForApproval(enquiry.id)
      if (!result) {
        setFormError('Could not move to PO approval.')
        return
      }
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to update PO status'))
    }
  }

  const handleApproveDesign = async () => {
    setFormError('')
    try {
      const result = await enquiryService.approveDesign(enquiry.id)
      if (!result) {
        setFormError('PO must be in approval stage before sign-off.')
        return
      }
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to approve PO'))
    }
  }

  const handleReturnToDesign = async () => {
    setFormError('')
    try {
      const result = await enquiryService.returnToDesignFromApproval(
        enquiry.id,
        returnToDesignReason,
      )
      if (!result) {
        setFormError(
          'Cannot return to design (fully delivered, dispatches in progress, or invalid stage).',
        )
        return
      }
      setReturnToDesignReason('')
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to return enquiry to design'))
    }
  }

  const handleRequestRedesign = async () => {
    setFormError('')
    try {
      const result = await enquiryService.requestDesignRevision(enquiry.id, revisionReason)
      if (!result) {
        setFormError('Cannot request redesign at this stage.')
        return
      }
      setRevisionReason('')
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to request redesign'))
    }
  }

  const handleRevertDesignStep = async () => {
    setFormError('')
    try {
      const result = await enquiryService.revertDesignWorkflowStep(enquiry.id, workflowNote)
      if (!result) {
        setFormError('Cannot step back from the current design stage.')
        return
      }
      setWorkflowNote('')
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to step back'))
    }
  }

  const handleRevertOrderStep = async () => {
    if (!order) return
    setFormError('')
    try {
      await orderService.revertOrderWorkflowStep(order.id, workflowNote)
      setWorkflowNote('')
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to step back production'))
    }
  }

  const handleConvertToOrder = async () => {
    setFormError('')
    try {
      const updated = await enquiryService.convertToOrder(enquiry.id)
      if (!updated?.orderId) {
        setFormError('Design must be approved before converting to order.')
        return
      }
      navigate(`/orders/${updated.orderId}`)
    } catch (err) {
      setFormError(actionError(err, 'Failed to convert to order'))
    }
  }



  const handleApproveProduction = async () => {
    if (!order) return
    setFormError('')
    try {
      await orderService.approveProductionStart(order.id)
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to approve production'))
    }
  }



  const handleCompleteProcess = async (process: ProductionProcess) => {
    if (!order) return
    setFormError('')
    setBusyProcess(process)
    try {
      await orderService.completeProductionProcess(order.id, process)
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to update production process'))
    } finally {
      setBusyProcess(null)
    }
  }

  const handleMarkReady = async () => {
    if (!order) return
    setFormError('')
    try {
      await orderService.markProductionReady(order.id)
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to mark ready for dispatch'))
    }
  }



  return (

    <div className="space-y-6">

      <EntityHeader

        backTo="/enquiries"

        backLabel="Back to Enquiries"

        title={enquiry.enquiryNo}

        subtitle={`${enquiry.projectName} · ${enquiry.customerName}`}

        badge={<StageChip stage={enquiry.stage} />}

        actions={

          order ? (

            <Button size="sm" onClick={() => navigate(`/orders/${order.id}`)}>

              View Order

            </Button>

          ) : undefined

        }

      />



      {showWorkflowAudit && (
        <Card>
          <h3 className="font-semibold mb-4">Workflow Progress</h3>
          <SimpleWorkflowStepper steps={steps} />
          {enquiry.activity.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <WorkflowProgressSummary entries={enquiry.activity} />
            </div>
          )}
        </Card>
      )}



      <Card>

        <h3 className="font-semibold mb-4">Enquiry Details</h3>

        <DetailGrid

          cols={3}

          items={[

            { label: 'Customer', value: enquiry.customerName },

            { label: 'Contact', value: enquiry.contactPerson },

            { label: 'Phone', value: enquiry.phone },

            { label: 'Email', value: enquiry.email },

            { label: 'Location', value: enquiry.location },

            { label: 'Enquiry Date', value: formatDate(enquiry.enquiryDate) },

            { label: 'Expected Completion', value: enquiry.expectedCompletion ? formatDate(enquiry.expectedCompletion) : '—' },

            {
              label: 'Person in charge',
              value: enquiry.personInChargeName ?? enquiry.salesPerson ?? '—',
            },
            {
              label: 'Current assignee',
              value: enquiry.currentAssigneeName
                ? `${enquiry.currentAssigneeName}${enquiry.currentAssigneeRoleCode ? ` (${enquiry.currentAssigneeRoleCode})` : ''}`
                : '—',
            },

            { label: 'Source', value: enquiry.source ?? '—' },

            { label: 'Priority', value: <span className="capitalize">{enquiry.priority}</span> },


          ]}

        />

        {enquiry.remarks && (

          <p className="text-sm text-text-secondary mt-4 border-t border-border pt-4">{enquiry.remarks}</p>

        )}

      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Client input files</h3>
        <p className="text-sm text-text-secondary mb-4">
          Latest revision available below. Earlier uploads are linked from the activity log.
        </p>
        <EnquiryDesignFiles
          enquiryId={enquiry.id}
          documents={enquiry.designDocuments ?? enquiry.currentDesignDocuments ?? []}
          allowUpload={!enquiry.orderId && canUploadClientInputFiles(roles)}
          onSaved={reload}
        />
      </Card>

      <Card>

        <div className="flex items-center justify-between mb-4">

          <div>

            <h3 className="font-semibold">Design Review</h3>

            <p className="text-xs text-text-secondary mt-0.5">

              Current phase: Rev {String(design.revision).padStart(2, '0')}

            </p>

          </div>

          {design.status === 'pending' && enquiry.stage === 'enquiry' && (
            <span className="text-sm text-text-secondary">Pending intake</span>
          )}
          {design.status === 'pending' && enquiry.stage === 'design_review' && (
            <span className="text-sm font-medium text-primary">Awaiting design start</span>
          )}
          {design.status !== 'pending' && (
            <span className="text-sm font-medium text-primary">{designStatusLabel(design.status)}</span>
          )}

        </div>

        {showExtractionPanel && <DesignPoStatusBar status={design.status} />}

        {showAcceptAndAssignPanel && (
          <div className="mb-4 p-4 rounded-lg bg-background border border-border">
            <p className="text-sm text-text-secondary mb-4">
              Accept this enquiry and assign a design in-charge. The enquiry will appear in that
              designer&apos;s list immediately.
            </p>
            {designAssignees.length === 0 ? (
              <p className="text-sm text-warning mb-3">
                No employees are set up for design review. Add staff under Settings → Organization.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 max-w-xl mb-4">
                <Select
                  label="Design in-charge"
                  value={designAssigneeId}
                  onChange={(e) => {
                    const nextId = e.target.value
                    setDesignAssigneeId(nextId)
                    const emp = designAssignees.find((x) => x.id === nextId)
                    setDesignAssigneeRole(emp?.jobRoles[0]?.code ?? '')
                  }}
                  options={designAssignees.map((emp) => ({
                    value: emp.id,
                    label: `${emp.name}${emp.departmentName ? ` · ${emp.departmentName}` : ''}`,
                  }))}
                />
                {designAssigneeRole && (
                  <p className="text-sm text-text-secondary self-end pb-2">
                    Role:{' '}
                    {designAssignees
                      .find((x) => x.id === designAssigneeId)
                      ?.jobRoles.find((r) => r.code === designAssigneeRole)?.label ??
                      designAssigneeRole}
                  </p>
                )}
              </div>
            )}
            {formError && <p className="text-error text-sm mb-3">{formError}</p>}
            <Button
              onClick={handleAcceptAndAssignDesign}
              disabled={!designAssigneeId || designAssignees.length === 0}
            >
              Accept & assign to design
            </Button>
          </div>
        )}



        {needsRevisionResume && canManageDesignWorkflow(roles) && (
          <div className="mb-4 p-4 rounded-lg bg-background border border-border">
            <p className="text-sm text-text-secondary mb-4">
              A revision was requested. Resume design work for the next revision phase.
            </p>
            <Button onClick={handleResumeRevision}>Start Next Revision Phase</Button>
          </div>
        )}



        {showExtractionPanel && (

          <div className="space-y-4">

            <p className="text-sm text-text-secondary">
              {canEditExtraction
                ? 'Enter or import duct schedule values. You can save at any pre-delivery stage; use Request redesign or workflow step-back when accounts or production must revisit design.'
                : 'Duct editing is locked after full delivery or once dispatch has started.'}
            </p>

            {canEditExtraction && canAccessDesignImport(roles) && (
              <Link to={`/enquiries/${enquiry.id}/design/import`}>
                <Button type="button" variant="secondary" className="w-full sm:w-auto">
                  Import from Excel
                </Button>
              </Link>
            )}

            {(enquiry.ductScheduleDocuments?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <p className="text-sm font-medium">Duct schedule Excel</p>
                <ul className="space-y-2">
                  {enquiry.ductScheduleDocuments!.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{doc.fileName}</span>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-primary shrink-0 min-h-11 px-2"
                        onClick={() => downloadEnquiryDocument({ ...doc, enquiryId: enquiry.id }, isApiMode)}
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </li>
                  ))}
                </ul>
                {(enquiry.ductLines?.length ?? 0) > 0 && (
                  <p className="text-xs text-text-secondary">
                    {enquiry.ductLines!.length} duct line(s) saved for order conversion.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <Input
                label="Duct Tags"
                type="number"
                min={1}
                value={ductTags}
                onChange={(e) => setDuctTags(e.target.value)}
                disabled={!canEditExtraction}
              />

              <Input
                label="Total Quantity"
                type="number"
                min={1}
                value={totalQty}
                onChange={(e) => setTotalQty(e.target.value)}
                disabled={!canEditExtraction}
              />

              <Input
                label="Total Area (m²)"
                type="number"
                min={0}
                step={0.01}
                value={totalArea}
                onChange={(e) => setTotalArea(e.target.value)}
                disabled={!canEditExtraction}
              />

            </div>

            <Textarea
              label="Design Notes"
              value={designNotes}
              onChange={(e) => setDesignNotes(e.target.value)}
              disabled={!canEditExtraction}
              placeholder="Dimensions verified, revisions, clarifications..."
            />

            {APPROVAL_PROCESSING_STATUSES.includes(design.status) && (
              <p className="text-sm text-text-secondary rounded-md border border-border bg-background px-3 py-2">
                Approval processing — accounts prepares the PO and tracks client sign-off. If the client requests
                design changes, use <strong>Return to design</strong> below (starts the next revision for
                engineering).
              </p>
            )}

            {canRequestRedesign && (
              <Textarea
                label="Reason for redesign (optional)"
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="e.g. Clarification needed on duct sizes before accounts can proceed"
              />
            )}

            {canReturnToDesign && (
              <Textarea
                label="Reason for return to design (optional)"
                value={returnToDesignReason}
                onChange={(e) => setReturnToDesignReason(e.target.value)}
                placeholder="e.g. Client PO mismatch — revise duct schedule"
              />
            )}

            {canRevertDesignStep && !canReturnToDesign && (
              <Textarea
                label="Workflow note (optional)"
                value={workflowNote}
                onChange={(e) => setWorkflowNote(e.target.value)}
                placeholder="e.g. Move PO workflow back one step"
              />
            )}

            {design.reviewedBy && (

              <p className="text-sm text-text-secondary">

                Approved by {design.reviewedBy} on {design.reviewDate ? formatDate(design.reviewDate) : '—'}

              </p>

            )}

            {formError && <p className="text-error text-sm">{formError}</p>}

            <div className="flex flex-wrap gap-3">

              {canEditExtraction && (
                <Button
                  variant="secondary"
                  onClick={handleSaveExtraction}
                  disabled={savingExtraction}
                >
                  {savingExtraction ? 'Saving…' : 'Save duct extraction'}
                </Button>
              )}

              {canSubmitToAccounts && (
                <Button onClick={handleSubmitToAccounts}>Submit to accounts</Button>
              )}

              {canMarkPoReview && (
                <Button onClick={handleMarkPoReview}>Mark PO for review</Button>
              )}

              {canMarkPoApproval && (
                <Button onClick={handleMarkPoApproval}>Mark PO for approval</Button>
              )}

              {canApprovePo && (
                <Button onClick={handleApproveDesign}>Approve PO</Button>
              )}

              {canRequestRedesign && (
                <Button variant="secondary" onClick={handleRequestRedesign}>
                  Request redesign
                </Button>
              )}

              {canRevertDesignStep && (
                <Button variant="secondary" onClick={handleRevertDesignStep}>
                  Step back (previous stage)
                </Button>
              )}

              {canReturnToDesign && (
                <Button variant="secondary" onClick={handleReturnToDesign}>
                  Return to design
                </Button>
              )}

              {canConvert && (

                <Button variant="gold" onClick={handleConvertToOrder}>Convert to Order</Button>

              )}

            </div>

          </div>

        )}

      </Card>



      {showOrderSummary && order && (
        <Card>
          <h3 className="font-semibold mb-4">Order & Manufacturing</h3>

          <DetailGrid
            cols={3}
            items={[
              { label: 'Order No', value: order.orderNo },
              { label: 'Ordered Qty', value: order.totalQuantity },
              { label: 'Area', value: `${order.totalArea} m²` },
            ]}
          />

          <div className="mt-4">
            <ProgressBar
              value={getOrderDispatchedQty(order)}
              max={order.totalQuantity}
              label="Dispatch Progress"
            />
          </div>

          {showProductionPanel && (
            <ProductionProcessPanel
              order={order}
              productionApproved={productionApproved}
              inProduction={inProduction}
              onApproveProduction={handleApproveProduction}
              onCompleteProcess={handleCompleteProcess}
              onMarkReady={handleMarkReady}
              busyProcess={busyProcess}
            />
          )}

          {formError && order && (
            <p className="text-error text-sm mt-4">{formError}</p>
          )}

          <div className="flex flex-wrap gap-3 mt-6">
            {canRevertOrder && (
              <>
                <Textarea
                  label="Production step-back note (optional)"
                  value={workflowNote}
                  onChange={(e) => setWorkflowNote(e.target.value)}
                  placeholder="Why production is moving to the previous stage"
                />
                <Button variant="secondary" onClick={handleRevertOrderStep}>
                  {orderRevertStepLabel(order)}
                </Button>
              </>
            )}

            {balanceQty > 0 &&
              order.status !== 'production' &&
              canAccessDispatchList(roles) && (
                <Button variant="secondary" onClick={() => navigate(`/orders/${order.id}/dispatch`)}>
                  Create Dispatch
                </Button>
              )}

          </div>

        </Card>

      )}



      {showWorkflowAudit && (
        <Card>
          <h3 className="font-semibold mb-4">Delivery & Activity History</h3>
          <p className="text-sm text-text-secondary mb-4">
            Full audit trail — who updated each phase, design revisions, production progress, and
            dispatch trips.
          </p>
          <ActivityTimeline
            entries={enquiry.activity}
            documents={[
              ...(enquiry.designDocuments ?? []),
              ...(enquiry.ductScheduleDocuments ?? []),
            ]}
          />
        </Card>
      )}

    </div>

  )

}


