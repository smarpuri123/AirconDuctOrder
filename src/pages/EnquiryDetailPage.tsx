import { useEffect, useRef, useState } from 'react'

import { useParams, useNavigate, Link } from 'react-router-dom'
import { Download, Upload } from 'lucide-react'
import {
  ENQUIRY_FILE_ACCEPT,
  QUOTATION_FILE_ACCEPT,
  downloadEnquiryDocument,
  filesToPayloadsWithProgress,
} from '@/lib/enquiryDocuments'

import { enquiryService } from '@/services/enquiryService'
import { jobRoleCodeLabel } from '@/lib/jobRoleLabel'

import { orderService } from '@/services/orderService'

import { EntityHeader } from '@/components/operations/EntityHeader'

import { DetailGrid } from '@/components/operations/DetailGrid'

import { ActivityTimeline } from '@/components/operations/ActivityTimeline'

import { WorkflowProgressSummary } from '@/components/operations/WorkflowProgressSummary'

import { SimpleWorkflowStepper } from '@/components/operations/SimpleWorkflowStepper'

import { WorkflowDisplayChip } from '@/components/operations/StageChip'

import { Card } from '@/components/ui/Card'

import { Button } from '@/components/ui/Button'

import { Input } from '@/components/ui/Input'

import { Textarea } from '@/components/ui/Textarea'

import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProductionProcessPanel } from '@/components/operations/ProductionProcessPanel'
import type { ProductionProcess } from '@/types/production'

import { usePortalRoles } from '@/hooks/usePortalRoles'
import {
  canAccessDesignImport,
  canApproveQuoteForClient,
  canAccessDispatchList,
  canManageAccountsWorkflow as portalCanManageAccountsWorkflow,
  canManageDesignWorkflow,
  canManageEnquiryIntake,
  canManageProductionOnEnquiry,
  canSeeWorkflowAuditLog,
  canUploadClientInputFiles,
} from '@/lib/portalAccess'
import {
  DesignDesignerProgress,
  DesignPoStatusBar,
  designStatusLabel,
} from '@/components/operations/DesignPoStatusBar'
import { orgService } from '@/services/orgService'
import type { Employee } from '@/types/org'
import { Select } from '@/components/ui/Select'
import { EnquiryDesignFiles } from '@/components/operations/EnquiryDesignFiles'
import { DuctSchedulePanel } from '@/components/operations/DuctSchedulePanel'
import { formatDate, getOrderBalanceQty, getOrderDispatchedQty } from '@/lib/calculations'
import {
  APPROVAL_PROCESSING_STATUSES,
  canEditDesignExtractionUi,
  hasDuctScheduleImported,
  canRequestDesignRevisionUi,
  canReturnToDesignUi,
  canRevertDesignStepUi,
  designRevertStepLabel,
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
  const [assigningDesign, setAssigningDesign] = useState(false)
  const [returnToDesignReason, setReturnToDesignReason] = useState('')
  const [revisionReason, setRevisionReason] = useState('')
  const [workflowNote, setWorkflowNote] = useState('')
  const [quoteFiles, setQuoteFiles] = useState<File[]>([])
  const [uploadingQuote, setUploadingQuote] = useState(false)
  const [uploadingDesignOutput, setUploadingDesignOutput] = useState(false)
  const [transitionBusy, setTransitionBusy] = useState(false)
  const [transitionText, setTransitionText] = useState('')
  const quoteInputRef = useRef<HTMLInputElement>(null)
  const designOutputInputRef = useRef<HTMLInputElement>(null)



  const enquiry = enquiryService.getEnquiryWithLiveStage(id!)



  useEffect(() => {
    enquiryService.refresh().then(() => reload())
  }, [id])

  useEffect(() => {
    if (!enquiry) return
    if (enquiry.designReview.status === 'approved' && !enquiry.orderId) {
      enquiryService.convertToOrder(enquiry.id).then(() => setVersion((n) => n + 1)).catch(() => {})
    }
  }, [enquiry?.id, enquiry?.designReview.status, enquiry?.orderId])

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
    !enquiry.currentAssigneeId &&
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

  const canBeginDesignWork =
    design.status === 'pending' &&
    Boolean(enquiry.currentAssigneeId) &&
    !enquiry.orderId &&
    canManageDesignWorkflow(roles)

  const canSubmitToAccounts =
    design.status === 'in_review' &&
    hasDuctScheduleImported(enquiry) &&
    !enquiry.orderId &&
    canManageDesignWorkflow(roles)
  const canMarkPoReview = design.status === 'submitted_to_accounts' && canManageAccountsWorkflow
  const canMarkPoApproval = design.status === 'po_for_review' && canApproveQuoteForClient(roles)
  const hasQuoteDocument = (enquiry.quotationDocuments?.length ?? 0) > 0 || quoteFiles.length > 0
  const canApprovePo = design.status === 'po_for_approval' && canManageAccountsWorkflow
  const canReturnToDesign = canReturnToDesignUi(enquiry, orderSnapshot)
  const canRevertDesignStep =
    canRevertDesignStepUi(enquiry, orderSnapshot) && canManageAccountsWorkflow
  const canRequestRedesign =
    canRequestDesignRevisionUi(enquiry, orderSnapshot) && canManageDesignWorkflow(roles)
  const canRevertOrder =
    order && canManageProductionOnEnquiry(roles) ? canRevertOrderStepUi(order) : false

  const inProduction = order?.status === 'production'

  const balanceQty = order ? getOrderBalanceQty(order) : 0




  const handleBeginDesignWork = async () => {
    setFormError('')
    try {
      const result = await enquiryService.beginDesignWork(enquiry.id)
      if (!result) {
        setFormError('Assign a design in-charge before starting work.')
        return
      }
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to start design work'))
    }
  }

  const handleAcceptAndAssignDesign = async () => {
    if (assigningDesign) return
    setFormError('')
    if (!designAssigneeId) {
      setFormError('Select the design in-charge for this enquiry.')
      return
    }
    setAssigningDesign(true)
    try {
      await enquiryService.acceptEnquiryAndAssignDesign(enquiry.id, {
        assigneeId: designAssigneeId,
        assigneeRoleCode: designAssigneeRole || undefined,
      })
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to accept and assign enquiry')
    } finally {
      setAssigningDesign(false)
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
      setFormError('Enter number of ducts, total quantity, and total area.')
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
    if (transitionBusy) return
    setFormError('')
    setTransitionBusy(true)
    setTransitionText('Submitting to accounts…')
    try {
      const result = await enquiryService.submitDesignToAccounts(enquiry.id)
      if (!result) {
        setFormError('Import duct schedule from Excel before submitting to accounts.')
        return
      }
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to submit to accounts'))
    } finally {
      setTransitionBusy(false)
      setTransitionText('')
    }
  }

  const handleUploadDesignOutput = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || uploadingDesignOutput) return
    setFormError('')
    setUploadingDesignOutput(true)
    try {
      const payloads = await filesToPayloadsWithProgress(fileList)
      await enquiryService.uploadDesignOutputFiles(enquiry.id, payloads)
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to upload design file'))
    } finally {
      setUploadingDesignOutput(false)
    }
  }

  const handleUploadQuoteFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || uploadingQuote) return
    setFormError('')
    setUploadingQuote(true)
    try {
      const payloads = await filesToPayloadsWithProgress(fileList)
      await enquiryService.uploadQuotationFiles(enquiry.id, payloads)
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to upload Quote document'))
    } finally {
      setUploadingQuote(false)
    }
  }

  const handleMarkPoReview = async () => {
    if (uploadingQuote) return
    setFormError('')
    if (!hasQuoteDocument) {
      setFormError('Upload a Quote document (PDF or Excel) before submitting for Quote review.')
      return
    }
    setUploadingQuote(true)
    try {
      const payloads = quoteFiles.length > 0 ? await filesToPayloadsWithProgress(quoteFiles) : undefined
      const result = await enquiryService.markPoForReview(enquiry.id, payloads)
      if (!result) {
        setFormError('Could not move to Quote review.')
        return
      }
      setQuoteFiles([])
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to submit Quote for review'))
    } finally {
      setUploadingQuote(false)
    }
  }

  const handleMarkPoApproval = async () => {
    if (transitionBusy) return
    setFormError('')
    setTransitionBusy(true)
    setTransitionText('Approving Quote…')
    try {
      const result = await enquiryService.markPoForApproval(enquiry.id)
      if (!result) {
        setFormError('Could not approve Quote for client submission.')
        return
      }
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to approve Quote for client submission'))
    } finally {
      setTransitionBusy(false)
      setTransitionText('')
    }
  }

  const handleApproveDesign = async () => {
    if (transitionBusy) return
    setFormError('')
    setTransitionBusy(true)
    setTransitionText('Recording approval…')
    try {
      const result = await enquiryService.approveDesign(enquiry.id)
      if (!result) {
        setFormError('Quote must be submitted to client before recording client approval.')
        return
      }
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to approve Quote'))
    } finally {
      setTransitionBusy(false)
      setTransitionText('')
    }
  }

  const handleReturnToDesign = async () => {
    if (transitionBusy) return
    setFormError('')
    setTransitionBusy(true)
    setTransitionText('Returning to design…')
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
    } finally {
      setTransitionBusy(false)
      setTransitionText('')
    }
  }

  const handleRequestRedesign = async () => {
    if (transitionBusy) return
    setFormError('')
    setTransitionBusy(true)
    setTransitionText('Requesting redesign…')
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
    } finally {
      setTransitionBusy(false)
      setTransitionText('')
    }
  }

  const handleRevertDesignStep = async () => {
    if (transitionBusy) return
    setFormError('')
    setTransitionBusy(true)
    setTransitionText('Stepping back…')
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
    } finally {
      setTransitionBusy(false)
      setTransitionText('')
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

  const handleTrackAction = async (
    process: ProductionProcess,
    action: import('@/lib/productionTrack').ProductionTrackAction,
  ) => {
    if (!order) return
    setFormError('')
    setBusyProcess(process)
    try {
      await orderService.updateProductionTrack(order.id, process, action)
      reload()
    } catch (err) {
      setFormError(actionError(err, 'Failed to update production track'))
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

        badge={<WorkflowDisplayChip enquiry={enquiry} />}

        actions={

          order ? (

            <Button size="sm" onClick={() => navigate(`/orders/${order.id}`)}>

              View Order

            </Button>

          ) : undefined

        }

      />

      <Card className="py-5 px-4 sm:px-6">
        <SimpleWorkflowStepper steps={steps} />
      </Card>

      {showWorkflowAudit && enquiry.activity.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-4">Workflow Progress</h3>
          <WorkflowProgressSummary entries={enquiry.activity} />
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
              label: 'Responsibility (person in charge)',
              value: enquiry.personInChargeName ?? enquiry.salesPerson ?? '—',
            },
            {
              label: 'Current assignee',
              value: enquiry.currentAssigneeName
                ? `${enquiry.currentAssigneeName}${
                    enquiry.currentAssigneeRoleCode
                      ? ` (${jobRoleCodeLabel(enquiry.currentAssigneeRoleCode, designAssignees)})`
                      : ''
                  }`
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

      {((enquiry.ductLines?.length ?? 0) > 0 ||
        (enquiry.ductScheduleDocuments?.length ?? 0) > 0) && (
        <Card>
          <h3 className="font-semibold mb-2">Imported duct schedule</h3>
          <p className="text-sm text-text-secondary mb-4">
            Ducts and dimensions from the designer&apos;s Excel import. The file can be downloaded by anyone
            with access to this enquiry.
          </p>
          <DuctSchedulePanel
            enquiryId={enquiry.id}
            ductLines={enquiry.ductLines ?? []}
            ductScheduleDocuments={enquiry.ductScheduleDocuments ?? []}
          />
        </Card>
      )}

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

        <DesignDesignerProgress enquiry={enquiry} />
        {(APPROVAL_PROCESSING_STATUSES.includes(design.status) || design.status === 'approved') && (
          <DesignPoStatusBar status={design.status} />
        )}

        {showAcceptAndAssignPanel && (
          <div className="mb-4 p-4 rounded-lg bg-background border border-border">
            <p className="text-sm text-text-secondary mb-4">
              Accept this enquiry and assign a design in-charge. The designer starts work, imports the
              duct schedule from Excel, then submits to accounts.
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
                    label: `${emp.name}${
                      emp.jobRoles.length
                        ? ` — ${emp.jobRoles.map((r) => r.label).join(', ')}`
                        : emp.departmentName
                          ? ` · ${emp.departmentName}`
                          : ''
                    }`,
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
              type="button"
              onClick={handleAcceptAndAssignDesign}
              disabled={assigningDesign || !designAssigneeId || designAssignees.length === 0}
            >
              {assigningDesign ? 'Assigning…' : 'Accept & assign to design'}
            </Button>
          </div>
        )}

        {canBeginDesignWork && !showAcceptAndAssignPanel && (
          <div className="mb-4 p-4 rounded-lg bg-background border border-border">
            <p className="text-sm text-text-secondary mb-4">
              {enquiry.currentAssigneeName
                ? `${enquiry.currentAssigneeName} is assigned. Start work to import the duct schedule and submit to accounts.`
                : 'Start design work to import the duct schedule and submit to accounts.'}
            </p>
            {formError && <p className="text-error text-sm mb-3">{formError}</p>}
            <Button onClick={handleBeginDesignWork}>Start working on design</Button>
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
                ? 'Import the duct schedule from Excel (required before accounts). You can adjust totals below if needed. Use Request redesign while working on design; during Quote processing use Step back or Return to design when engineering must revise.'
                : 'Duct editing is locked after full delivery or once dispatch has started.'}
            </p>

            {canEditExtraction && canAccessDesignImport(roles) && (
              <Link to={`/enquiries/${enquiry.id}/design/import`}>
                <Button type="button" variant="secondary" className="w-full sm:w-auto">
                  Import from Excel
                </Button>
              </Link>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <Input
                label="Number of Ducts"
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

            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Design files (shared with client)</p>
                  <p className="text-xs text-text-secondary">
                    Upload the design drawings/PDFs to share with the client in the design &amp; quote approval stage. The Schedule Excel file is for internal reference only.
                  </p>
                </div>
                {canEditExtraction && (
                  <>
                    <input
                      ref={designOutputInputRef}
                      type="file"
                      multiple
                      accept={ENQUIRY_FILE_ACCEPT}
                      disabled={uploadingDesignOutput}
                      className="sr-only"
                      onChange={(e) => {
                        void handleUploadDesignOutput(e.target.files)
                        e.target.value = ''
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={uploadingDesignOutput}
                      onClick={() => designOutputInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingDesignOutput ? 'Uploading…' : 'Upload Design File'}
                    </Button>
                  </>
                )}
              </div>

              {(enquiry.designOutputDocuments?.length ?? 0) > 0 ? (
                <ul className="space-y-2">
                  {(enquiry.designOutputDocuments ?? []).map((doc, idx, arr) => {
                    const rev = doc.inputRevision && doc.inputRevision > 0 ? doc.inputRevision : arr.length - idx
                    return (
                      <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{doc.fileName}</span>
                          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            Rev {String(rev).padStart(2, '0')}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-primary shrink-0 min-h-11 px-2"
                          onClick={() => downloadEnquiryDocument({ ...doc, enquiryId: enquiry.id })}
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">
                  No client design files uploaded yet.
                </p>
              )}
            </div>

            {(APPROVAL_PROCESSING_STATUSES.includes(design.status) ||
              design.status === 'approved' ||
              (enquiry.quotationDocuments?.length ?? 0) > 0) && (
              <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Quotation documents (PDF / Excel)</p>
                    <p className="text-xs text-text-secondary">
                      {design.status === 'submitted_to_accounts'
                        ? 'Upload the Quote document (PDF or Excel) to move from Quote preparation to Quote review.'
                        : design.status === 'po_for_review'
                          ? 'Admin or Supervisor downloads the Quote document below and approves it for submission to the client.'
                          : 'Download the Quote document prepared by accounts.'}
                    </p>
                  </div>
                  {canManageAccountsWorkflow && !enquiry.orderId && (
                    <>
                      <input
                        ref={quoteInputRef}
                        type="file"
                        multiple
                        accept={QUOTATION_FILE_ACCEPT}
                        disabled={uploadingQuote}
                        className="sr-only"
                        onChange={(e) => {
                          void handleUploadQuoteFiles(e.target.files)
                          e.target.value = ''
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={uploadingQuote}
                        onClick={() => quoteInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingQuote ? 'Uploading…' : 'Upload Quote'}
                      </Button>
                    </>
                  )}
                </div>

                {(enquiry.quotationDocuments?.length ?? 0) > 0 ? (
                  <ul className="space-y-2">
                    {(enquiry.quotationDocuments ?? []).map((doc, idx, arr) => {
                      const rev = doc.inputRevision && doc.inputRevision > 0 ? doc.inputRevision : arr.length - idx
                      return (
                        <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{doc.fileName}</span>
                            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                              Rev {String(rev).padStart(2, '0')}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="flex items-center gap-1 text-primary shrink-0 min-h-11 px-2"
                            onClick={() => downloadEnquiryDocument({ ...doc, enquiryId: enquiry.id })}
                          >
                            <Download className="w-4 h-4" />
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
            )}

            {APPROVAL_PROCESSING_STATUSES.includes(design.status) && (
              <p className="text-sm text-text-secondary rounded-md border border-border bg-background px-3 py-2">
                Quotation processing — accounts prepares and uploads the Quote (PDF/Excel), Admin or Supervisor
                downloads and approves the Quote for submission to the client, then client approval is recorded. If
                the client requests design changes, use <strong>Return to design</strong> below.
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
                placeholder="e.g. Client Quote revision requested — revise duct schedule"
              />
            )}

            {canRevertDesignStep && (
              <Textarea
                label="Quote step-back note (optional)"
                value={workflowNote}
                onChange={(e) => setWorkflowNote(e.target.value)}
                placeholder="e.g. Quote details need correction before the next approval step"
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

              {design.status === 'in_review' &&
                canManageDesignWorkflow(roles) &&
                !hasDuctScheduleImported(enquiry) && (
                  <p className="text-sm text-text-secondary w-full">
                    Import duct schedule from Excel to enable submit to accounts.
                  </p>
                )}

              {canSubmitToAccounts && (
                <Button onClick={handleSubmitToAccounts} disabled={transitionBusy}>
                  {transitionBusy && transitionText ? transitionText : 'Submit to accounts'}
                </Button>
              )}

              {canMarkPoReview && (
                <Button
                  onClick={handleMarkPoReview}
                  disabled={uploadingQuote || !hasQuoteDocument || transitionBusy}
                >
                  {uploadingQuote ? 'Submitting Quote…' : 'Submit Quote for Review'}
                </Button>
              )}

              {design.status === 'po_for_review' && !canMarkPoApproval && (
                <p className="text-sm text-text-secondary self-center">
                  Awaiting Admin or Supervisor to download the Quote and approve it for client submission.
                </p>
              )}

              {canMarkPoApproval && (
                <Button onClick={handleMarkPoApproval} disabled={transitionBusy}>
                  {transitionBusy && transitionText ? transitionText : 'Approve Quote for Submission to Client'}
                </Button>
              )}

              {canApprovePo && (
                <Button onClick={handleApproveDesign} disabled={transitionBusy}>
                  {transitionBusy && transitionText ? transitionText : 'Approve Quote (Client Approved)'}
                </Button>
              )}

              {canRequestRedesign && (
                <Button variant="secondary" onClick={handleRequestRedesign} disabled={transitionBusy}>
                  Request redesign
                </Button>
              )}

              {canRevertDesignStep && (
                <Button variant="secondary" onClick={handleRevertDesignStep} disabled={transitionBusy}>
                  {designRevertStepLabel(design.status)}
                </Button>
              )}

              {canReturnToDesign && (
                <Button variant="secondary" onClick={handleReturnToDesign} disabled={transitionBusy}>
                  Return to design
                </Button>
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
              inProduction={inProduction}
              onTrackAction={handleTrackAction}
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
              ...(enquiry.designOutputDocuments ?? []),
              ...(enquiry.quotationDocuments ?? []),
            ]}
          />
        </Card>
      )}

    </div>

  )

}


