import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { WorkflowDisplayChip } from '@/components/operations/StageChip'
import type { FlowWorkCard } from '@/lib/operationsFlow/types'
import { enquiryService } from '@/services/enquiryService'
import { formatDate } from '@/lib/calculations'

type Props = {
  card: FlowWorkCard | null
  onClose: () => void
}

export function FlowDetailModal({ card, onClose }: Props) {
  const navigate = useNavigate()
  if (!card) return null

  const enquiry = enquiryService.getEnquiryById(card.enquiryId)

  return (
    <Modal
      open={Boolean(card)}
      onClose={onClose}
      title={`${card.enquiryNo} · ${card.projectName}`}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          <Button type="button" onClick={() => navigate(`/enquiries/${card.enquiryId}`)}>
            Open enquiry
          </Button>
          {card.orderId && (
            <Button type="button" variant="secondary" onClick={() => navigate(`/orders/${card.orderId}`)}>
              Open order
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {enquiry && (
          <div>
            <WorkflowDisplayChip enquiry={enquiry} />
          </div>
        )}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <dt className="text-text-secondary text-xs">Client</dt>
            <dd className="font-medium">{card.clientName}</dd>
          </div>
          <div>
            <dt className="text-text-secondary text-xs">Priority</dt>
            <dd className="font-medium capitalize">{card.priority}</dd>
          </div>
          {card.assigneeName && (
            <div>
              <dt className="text-text-secondary text-xs">Assigned</dt>
              <dd className="font-medium">{card.assigneeName}</dd>
            </div>
          )}
          {card.startedAt && (
            <div>
              <dt className="text-text-secondary text-xs">Started</dt>
              <dd className="font-medium">{formatDate(card.startedAt)}</dd>
            </div>
          )}
          {card.totalQty != null && (
            <div>
              <dt className="text-text-secondary text-xs">Quantity</dt>
              <dd className="font-medium tabular-nums">{card.totalQty}</dd>
            </div>
          )}
          {card.totalArea != null && (
            <div>
              <dt className="text-text-secondary text-xs">Area</dt>
              <dd className="font-medium tabular-nums">{card.totalArea} m²</dd>
            </div>
          )}
          {card.progressLabel && (
            <div>
              <dt className="text-text-secondary text-xs">Dispatch progress</dt>
              <dd className="font-medium font-mono">{card.progressLabel}</dd>
            </div>
          )}
        </dl>
        {card.detailLines.length > 0 && (
          <ul className="text-text-secondary text-xs space-y-1 border-t border-border pt-3">
            {card.detailLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
