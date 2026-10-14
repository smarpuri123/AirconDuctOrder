import type { Enquiry, WorkflowDisplayStage, WorkflowStep } from '@/types/enquiry'
import { isApprovalProcessing } from '@/lib/enquiryWorkflow'

/** UI pipeline aligned with the operations dashboard stat cards and enquiry stepper. */
export const OPERATIONS_WORKFLOW: {
  stage: WorkflowDisplayStage
  dashboardLabel: string
  stepperLabel: string
}[] = [
  { stage: 'enquiry', dashboardLabel: 'Enquiries', stepperLabel: 'Enquiry' },
  { stage: 'design_review', dashboardLabel: 'Design Review', stepperLabel: 'Design Review' },
  {
    stage: 'approval_processing',
    dashboardLabel: 'Approval Processing',
    stepperLabel: 'Approval Processing',
  },
  { stage: 'manufacturing', dashboardLabel: 'In Production', stepperLabel: 'In Production' },
  { stage: 'dispatch', dashboardLabel: 'Ready to Dispatch', stepperLabel: 'Ready to Dispatch' },
  { stage: 'completed', dashboardLabel: 'Completed', stepperLabel: 'Completed' },
]

const DISPLAY_STAGE_ORDER = OPERATIONS_WORKFLOW.map((s) => s.stage)

export function resolveWorkflowDisplayStage(enquiry: Enquiry): WorkflowDisplayStage {
  if (isApprovalProcessing(enquiry)) return 'approval_processing'

  const stage = enquiry.stage
  if (stage === 'completed') return 'completed'
  if (stage === 'dispatch') return 'dispatch'
  if (stage === 'manufacturing' || stage === 'order') return 'manufacturing'
  if (stage === 'design_review') return 'design_review'
  return 'enquiry'
}

export function buildOperationsWorkflowSteps(enquiry: Enquiry): WorkflowStep[] {
  const current = resolveWorkflowDisplayStage(enquiry)
  const currentIdx = DISPLAY_STAGE_ORDER.indexOf(current)

  return OPERATIONS_WORKFLOW.map((def, i) => {
    let status: WorkflowStep['status'] = 'upcoming'
    if (i < currentIdx) status = 'completed'
    else if (i === currentIdx) {
      status = current === 'completed' ? 'completed' : 'current'
    }
    return {
      stage: def.stage,
      label: def.stepperLabel,
      status,
    }
  })
}

export function workflowDisplayLabel(enquiry: Enquiry): string {
  const stage = resolveWorkflowDisplayStage(enquiry)
  return OPERATIONS_WORKFLOW.find((s) => s.stage === stage)?.stepperLabel ?? stage
}

export type OperationsPipelineCounts = Record<WorkflowDisplayStage, number>

/** Count enquiries per operations pipeline stage (same rules as the stepper and list chips). */
export function computeOperationsPipelineCounts(enquiries: Enquiry[]): OperationsPipelineCounts {
  const counts: OperationsPipelineCounts = {
    enquiry: 0,
    design_review: 0,
    approval_processing: 0,
    manufacturing: 0,
    dispatch: 0,
    completed: 0,
  }
  for (const enquiry of enquiries) {
    counts[resolveWorkflowDisplayStage(enquiry)] += 1
  }
  return counts
}
