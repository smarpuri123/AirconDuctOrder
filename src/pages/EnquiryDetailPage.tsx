import { useEffect, useRef, useState } from 'react'

import { useParams, useNavigate, Link } from 'react-router-dom'
import { Download, FolderOpen, RotateCcw, Upload, X } from 'lucide-react'
import { WorkflowConfirmModal, StepSuccessModal } from '@/components/ui/WorkflowConfirmModal'
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
import { formatDate, getOrderBalanceQty } from '@/lib/calculations'
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
  const [pendingDesignFiles, setPendingDesignFiles] = useState<File[]>([])
  const [pendingQuoteFiles, setPendingQuoteFiles] = useState<File[]>([])
  const [uploadingQuote, setUploadingQuote] = useState(false)
  const [uploadingDesignOutput, setUploadingDesignOutput] = useState(false)
  const [transitionBusy, setTransitionBusy] = useState(false)
  const [transitionText, setTransitionText] = useState('')
  const [confirmModalType, setConfirmModalType] = useState<
    | 'submit_to_accounts'
    | 'submit_quote_review'
    | 'approve_quote_client'
    | 'approve_quote_final'
    | 'revert_design_step'
    | 'return_to_design'
    | 'request_redesign'
    | 'revert_order_step'
    | null
  >(null)
  const [confirmNote, setConfirmNote] = useState('')
  const [successModal, setSuccessModal] = useState<{ open: boolean; title?: string; message: string }>({
    open: false,
    title: '',
    message: '',
  })
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
  const hasQuoteDocument = (enquiry.quotationDocuments?.length ?? 0) > 0
  const canApprovePo = design.status === 'po_for_approval' && canManageAccountsWorkflow
  const canReturnToDesign = canReturnToDesignUi(enquiry, orderSnapshot)
  const canRevertDesignStep =
    canRevertDesignStepUi(enquiry, orderSnapshot) && canManageAccountsWorkflow
  const canRequestRedesign =
    canRequestDesignRevisionUi(enquiry, orderSnapshot) && canManageDesignWorkflow(roles)
  const canRevertOrder =
    order && canManageProductionOnEnquiry(roles) ? canRevertOrderStepUi(order) : false
  const hasAnyRevertAction = Boolean(
    canRevertDesignStep || canReturnToDesign || canRequestRedesign || canRevertOrder,
  )

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



  const handleUploadDesignOutput = async () => {
    if (pendingDesignFiles.length === 0 || uploadingDesignOutput) return
    setFormError('')
    setUploadingDesignOutput(true)
    try {
      const payloads = await filesToPayloadsWithProgress(pendingDesignFiles)
      await enquiryService.uploadDesignOutputFiles(enquiry.id, payloads)
      setPendingDesignFiles([])
      reload()
      setSuccessModal({
        open: true,
        title: 'Design File Uploaded',
        message: 'Client-shared design file uploaded successfully.',
      })
    } catch (err) {
      setFormError(actionError(err, 'Failed to upload design file'))
    } finally {
      setUploadingDesignOutput(false)
    }
  }

  const handleUploadQuoteFiles = async () => {
    if (pendingQuoteFiles.length === 0 || uploadingQuote) return
    setFormError('')
    setUploadingQuote(true)
    try {
      const payloads = await filesToPayloadsWithProgress(pendingQuoteFiles)
      await enquiryService.uploadQuotationFiles(enquiry.id, payloads)
      setPendingQuoteFiles([])
      reload()
      setSuccessModal({
        open: true,
        title: 'Quote Document Uploaded',
        message: 'Quotation document uploaded successfully. You can now submit it for review.',
      })
    } catch (err) {
      setFormError(actionError(err, 'Failed to upload Quote document'))
    } finally {
      setUploadingQuote(false)
    }
  }

  const handleExecuteConfirmedAction = async () => {
    if (!confirmModalType || transitionBusy) return
    setFormError('')
    setTransitionBusy(true)

    const type = confirmModalType
    const note = confirmNote.trim()

    try {
      if (type === 'submit_to_accounts') {
        setTransitionText('Submitting to accounts…')
        const result = await enquiryService.submitDesignToAccounts(enquiry.id)
        if (!result) {
          setFormError('Import duct schedule from Excel before submitting to accounts.')
          return
        }
        setConfirmModalType(null)
        setConfirmNote('')
        reload()
        setSuccessModal({
          open: true,
          title: 'Submitted to Accounts',
          message: 'Duct extraction and drawings were successfully submitted to Accounts for quote preparation.',
        })
      } else if (type === 'submit_quote_review') {
        setTransitionText('Submitting Quote…')
        const result = await enquiryService.markPoForReview(enquiry.id)
        if (!result) {
          setFormError('Could not move to Quote review.')
          return
        }
        setConfirmModalType(null)
        setConfirmNote('')
        reload()
        setSuccessModal({
          open: true,
          title: 'Quote Submitted for Review',
          message: 'Quotation document submitted for Supervisor / Admin verification.',
        })
      } else if (type === 'approve_quote_client') {
        setTransitionText('Approving Quote…')
        const result = await enquiryService.markPoForApproval(enquiry.id)
        if (!result) {
          setFormError('Could not approve Quote for client submission.')
          return
        }
        setConfirmModalType(null)
        setConfirmNote('')
        reload()
        setSuccessModal({
          open: true,
          title: 'Quote Approved for Client',
          message: 'Quotation verified and approved for sending to the client.',
        })
      } else if (type === 'approve_quote_final') {
        setTransitionText('Recording approval…')
        const result = await enquiryService.approveDesign(enquiry.id)
        if (!result) {
          setFormError('Quote must be submitted to client before recording client approval.')
          return
        }
        setConfirmModalType(null)
        setConfirmNote('')
        reload()
        setSuccessModal({
          open: true,
          title: 'Client Approval Recorded',
          message: 'Client approval recorded successfully! The enquiry is released to production.',
        })
      } else if (type === 'revert_design_step') {
        setTransitionText('Stepping back…')
        const result = await enquiryService.revertDesignWorkflowStep(enquiry.id, note)
        if (!result) {
          setFormError('Cannot step back from the current design stage.')
          return
        }
        setConfirmModalType(null)
        setConfirmNote('')
        reload()
        setSuccessModal({
          open: true,
          title: 'Workflow Stepped Back',
          message: `Successfully stepped back to ${designRevertStepLabel(design.status).replace('Step back to ', '')}.`,
        })
      } else if (type === 'return_to_design') {
        setTransitionText('Returning to design…')
        const result = await enquiryService.returnToDesignFromApproval(enquiry.id, note)
        if (!result) {
          setFormError('Cannot return to design (fully delivered, dispatches in progress, or invalid stage).')
          return
        }
        setConfirmModalType(null)
        setConfirmNote('')
        reload()
        setSuccessModal({
          open: true,
          title: 'Returned to Design Stage',
          message: 'Enquiry has returned to Design Review for engineering modifications.',
        })
      } else if (type === 'request_redesign') {
        setTransitionText('Requesting redesign…')
        const result = await enquiryService.requestDesignRevision(enquiry.id, note)
        if (!result) {
          setFormError('Cannot request redesign at this stage.')
          return
        }
        setConfirmModalType(null)
        setConfirmNote('')
        reload()
        setSuccessModal({
          open: true,
          title: 'Redesign Requested',
          message: 'Design revision task created and sent back to the assigned designer.',
        })
      } else if (type === 'revert_order_step') {
        if (!order) return
        setTransitionText('Stepping back production…')
        await orderService.revertOrderWorkflowStep(order.id, note)
        setConfirmModalType(null)
        setConfirmNote('')
        reload()
        setSuccessModal({
          open: true,
          title: 'Production Stepped Back',
          message: 'Production order moved back to the previous workflow stage.',
        })
      }
    } catch (err) {
      setFormError(actionError(err, 'Failed to complete action'))
    } finally {
      setTransitionBusy(false)
      setTransitionText('')
    }
  }

  const getConfirmModalConfig = () => {
    switch (confirmModalType) {
      case 'submit_to_accounts':
        return {
          title: 'Submit Design to Accounts',
          description: 'Submit the completed duct extraction and drawings to Accounts for quotation preparation?',
          confirmText: 'Confirm & Submit',
          variant: 'primary' as const,
        }
      case 'submit_quote_review':
        return {
          title: 'Submit Quote for Review',
          description: 'Submit this Quote document for Supervisor and Admin review?',
          confirmText: 'Submit for Review',
          variant: 'primary' as const,
        }
      case 'approve_quote_client':
        return {
          title: 'Approve Quote for Client Submission',
          description: 'Confirm that this quote has been checked and is ready to share with the client?',
          confirmText: 'Approve Quote',
          variant: 'primary' as const,
        }
      case 'approve_quote_final':
        return {
          title: 'Record Client Approval',
          description: 'Confirm that the client has approved the quote? This will release the enquiry for customer order creation.',
          confirmText: 'Confirm Client Approval',
          variant: 'primary' as const,
        }
      case 'revert_design_step':
        return {
          title: designRevertStepLabel(design.status),
          description: 'This will step back the quotation workflow to the previous step so updates can be made.',
          confirmText: 'Confirm Step Back',
          variant: 'warning' as const,
          showNote: true,
          noteLabel: 'Reason for step back (optional)',
          notePlaceholder: 'Why is the workflow being stepped back?',
        }
      case 'return_to_design':
        return {
          title: 'Return Enquiry to Design',
          description: 'Return this enquiry to the Design stage? The designer will be able to revise duct schedules and engineering files.',
          confirmText: 'Return to Design',
          variant: 'warning' as const,
          showNote: true,
          noteLabel: 'Reason for return to design (optional)',
          notePlaceholder: 'Why is this enquiry being returned to design?',
        }
      case 'request_redesign':
        return {
          title: 'Request Redesign',
          description: 'Request a design revision from the engineering team?',
          confirmText: 'Request Redesign',
          variant: 'warning' as const,
          showNote: true,
          noteLabel: 'Reason for redesign (optional)',
          notePlaceholder: 'Describe the design changes required…',
        }
      case 'revert_order_step':
        return {
          title: order ? orderRevertStepLabel(order) : 'Step Back Production',
          description: 'Step back the production order to the previous workflow stage?',
          confirmText: 'Confirm Step Back',
          variant: 'warning' as const,
          showNote: true,
          noteLabel: 'Production step-back note (optional)',
          notePlaceholder: 'Why is production moving back?',
        }
      default:
        return null
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

  const confirmModalConfig = getConfirmModalConfig()

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

      {((showWorkflowAudit && enquiry.activity.length > 0) || hasAnyRevertAction) && (
        <Card>
          <h3 className="font-semibold mb-4">Workflow Progress</h3>
          {enquiry.activity.length > 0 && (
            <WorkflowProgressSummary entries={enquiry.activity} />
          )}

          {hasAnyRevertAction && (
            <div className={`${enquiry.activity.length > 0 ? 'mt-5 pt-4 border-t border-border' : ''}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <RotateCcw className="w-4 h-4 text-warning" />
                <h4 className="text-sm font-semibold text-text-primary">Workflow Reversion &amp; Corrections</h4>
              </div>
              <p className="text-xs text-text-secondary mb-3">
                Need to make revisions or corrections? Use the options below to step back to an earlier stage.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {canRevertDesignStep && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConfirmNote('')
                      setConfirmModalType('revert_design_step')
                    }}
                    disabled={transitionBusy}
                    className="border-warning/30 hover:bg-warning/10 text-warning"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    {designRevertStepLabel(design.status)}
                  </Button>
                )}
                {canReturnToDesign && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConfirmNote('')
                      setConfirmModalType('return_to_design')
                    }}
                    disabled={transitionBusy}
                    className="border-warning/30 hover:bg-warning/10 text-warning"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Return to design
                  </Button>
                )}
                {canRequestRedesign && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConfirmNote('')
                      setConfirmModalType('request_redesign')
                    }}
                    disabled={transitionBusy}
                    className="border-warning/30 hover:bg-warning/10 text-warning"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Request redesign
                  </Button>
                )}
                {canRevertOrder && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConfirmNote('')
                      setConfirmModalType('revert_order_step')
                    }}
                    disabled={transitionBusy}
                    className="border-warning/30 hover:bg-warning/10 text-warning"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    {order ? orderRevertStepLabel(order) : 'Step back production'}
                  </Button>
                )}
              </div>
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <input
                      ref={designOutputInputRef}
                      type="file"
                      multiple
                      accept={ENQUIRY_FILE_ACCEPT}
                      disabled={uploadingDesignOutput}
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
                      disabled={uploadingDesignOutput}
                      onClick={() => designOutputInputRef.current?.click()}
                    >
                      <FolderOpen className="w-4 h-4" />
                      {pendingDesignFiles.length > 0 ? 'Change File' : 'Browse Design File'}
                    </Button>
                    {pendingDesignFiles.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={uploadingDesignOutput}
                        onClick={handleUploadDesignOutput}
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingDesignOutput ? 'Uploading…' : `Upload ${pendingDesignFiles.length === 1 ? 'Design File' : `${pendingDesignFiles.length} Files`}`}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {pendingDesignFiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20 text-xs">
                  <span className="font-semibold text-primary">Selected for upload:</span>
                  {pendingDesignFiles.map((file, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 bg-surface border border-border px-2 py-1 rounded">
                      <span className="font-medium text-text-primary truncate max-w-[200px]">{file.name}</span>
                      <span className="text-text-secondary">({(file.size / 1024).toFixed(0)} KB)</span>
                      <button
                        type="button"
                        onClick={() => setPendingDesignFiles((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={uploadingDesignOutput}
                        className="text-text-secondary hover:text-error ml-1"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPendingDesignFiles([])}
                    disabled={uploadingDesignOutput}
                    className="text-text-secondary hover:underline ml-auto"
                  >
                    Clear
                  </button>
                </div>
              )}

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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <input
                        ref={quoteInputRef}
                        type="file"
                        multiple
                        accept={QUOTATION_FILE_ACCEPT}
                        disabled={uploadingQuote}
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
                        disabled={uploadingQuote}
                        onClick={() => quoteInputRef.current?.click()}
                      >
                        <FolderOpen className="w-4 h-4" />
                        {pendingQuoteFiles.length > 0 ? 'Change File' : 'Browse Quote File'}
                      </Button>
                      {pendingQuoteFiles.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={uploadingQuote}
                          onClick={handleUploadQuoteFiles}
                        >
                          <Upload className="w-4 h-4" />
                          {uploadingQuote ? 'Uploading…' : `Upload ${pendingQuoteFiles.length === 1 ? 'Quote Document' : `${pendingQuoteFiles.length} Documents`}`}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {pendingQuoteFiles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20 text-xs">
                    <span className="font-semibold text-primary">Selected for upload:</span>
                    {pendingQuoteFiles.map((file, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 bg-surface border border-border px-2 py-1 rounded">
                        <span className="font-medium text-text-primary truncate max-w-[200px]">{file.name}</span>
                        <span className="text-text-secondary">({(file.size / 1024).toFixed(0)} KB)</span>
                        <button
                          type="button"
                          onClick={() => setPendingQuoteFiles((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={uploadingQuote}
                          className="text-text-secondary hover:text-error ml-1"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPendingQuoteFiles([])}
                      disabled={uploadingQuote}
                      className="text-text-secondary hover:underline ml-auto"
                    >
                      Clear
                    </button>
                  </div>
                )}

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
                the client requests design changes, use <strong>Return to design</strong> in the Workflow Progress section above.
              </p>
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
                <Button onClick={() => setConfirmModalType('submit_to_accounts')} disabled={transitionBusy}>
                  {transitionBusy && transitionText ? transitionText : 'Submit to accounts'}
                </Button>
              )}

              {canMarkPoReview && (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      if (!hasQuoteDocument) {
                        setFormError('Upload a Quote document (PDF or Excel) before submitting for Quote review.')
                        return
                      }
                      setConfirmModalType('submit_quote_review')
                    }}
                    disabled={uploadingQuote || !hasQuoteDocument || transitionBusy}
                  >
                    {uploadingQuote ? 'Submitting Quote…' : 'Submit Quote for Review'}
                  </Button>
                  {!hasQuoteDocument && (
                    <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-md">
                      Upload the Quote document (PDF or Excel) above to move from Quote preparation to Quote review.
                    </p>
                  )}
                </div>
              )}

              {design.status === 'po_for_review' && !canMarkPoApproval && (
                <p className="text-sm text-text-secondary self-center">
                  Awaiting Admin or Supervisor to download the Quote and approve it for client submission.
                </p>
              )}

              {canMarkPoApproval && (
                <Button onClick={() => setConfirmModalType('approve_quote_client')} disabled={transitionBusy}>
                  {transitionBusy && transitionText ? transitionText : 'Approve Quote for Submission to Client'}
                </Button>
              )}

              {canApprovePo && (
                <Button onClick={() => setConfirmModalType('approve_quote_final')} disabled={transitionBusy}>
                  {transitionBusy && transitionText ? transitionText : 'Approve Quote (Client Approved)'}
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

      {confirmModalConfig && (
        <WorkflowConfirmModal
          open={Boolean(confirmModalType)}
          onClose={() => {
            setConfirmModalType(null)
            setConfirmNote('')
          }}
          onConfirm={handleExecuteConfirmedAction}
          title={confirmModalConfig.title}
          description={confirmModalConfig.description}
          confirmText={confirmModalConfig.confirmText}
          variant={confirmModalConfig.variant}
          busy={transitionBusy}
          busyText={transitionText || 'Processing…'}
          showNote={confirmModalConfig.showNote}
          noteLabel={confirmModalConfig.noteLabel}
          notePlaceholder={confirmModalConfig.notePlaceholder}
          noteValue={confirmNote}
          onNoteChange={setConfirmNote}
        />
      )}

      <StepSuccessModal
        open={successModal.open}
        onClose={() => setSuccessModal((prev) => ({ ...prev, open: false }))}
        title={successModal.title}
        message={successModal.message}
      />
    </div>
  )
}


