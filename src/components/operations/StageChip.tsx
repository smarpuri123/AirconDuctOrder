import { Chip } from '@/components/ui/Chip'
import { resolveWorkflowDisplayStage, workflowDisplayLabel } from '@/lib/operationsWorkflow'
import type { Enquiry, EnquiryStage, WorkflowDisplayStage } from '@/types/enquiry'

const labels: Record<EnquiryStage, string> = {
  enquiry: 'Enquiry',
  design_review: 'Design Review',
  order: 'Order',
  manufacturing: 'Manufacturing',
  dispatch: 'Dispatch',
  completed: 'Completed',
}

const variants: Record<EnquiryStage, 'default' | 'success' | 'warning' | 'error' | 'primary' | 'secondary'> = {
  enquiry: 'primary',
  design_review: 'secondary',
  order: 'default',
  manufacturing: 'secondary',
  dispatch: 'primary',
  completed: 'success',
}

export function StageChip({ stage }: { stage: EnquiryStage }) {
  return <Chip variant={variants[stage]}>{labels[stage]}</Chip>
}

const displayVariants: Record<
  WorkflowDisplayStage,
  'default' | 'success' | 'warning' | 'error' | 'primary' | 'secondary'
> = {
  enquiry: 'primary',
  design_review: 'secondary',
  approval_processing: 'warning',
  manufacturing: 'secondary',
  dispatch: 'primary',
  completed: 'success',
}

/** Matches dashboard stat cards and the enquiry workflow stepper. */
export function WorkflowDisplayChip({ enquiry }: { enquiry: Enquiry }) {
  const stage = resolveWorkflowDisplayStage(enquiry)
  return <Chip variant={displayVariants[stage]}>{workflowDisplayLabel(enquiry)}</Chip>
}
