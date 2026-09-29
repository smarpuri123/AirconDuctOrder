import { Chip } from '@/components/ui/Chip'
import type { EnquiryStage } from '@/types/enquiry'

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
