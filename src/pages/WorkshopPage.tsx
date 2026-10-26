import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useApiData } from '@/hooks/useApiData'
import { loadEnquiryWorkflowBoard } from '@/lib/operationsFlow/loadWorkflowBoard'
import { resolveWorkflowDisplayStage } from '@/lib/operationsWorkflow'
import { enquiryService } from '@/services/enquiryService'
import { EnquiryWorkflowRadial } from '@/components/operationsFlow/EnquiryWorkflowRadial'
import {
  EnquiryWorkflowStagePanel,
  type WorkflowPanelSelection,
} from '@/components/operationsFlow/EnquiryWorkflowStagePanel'

/** Live floor snapshot — radial enquiry tracks (separate from the KPI dashboard). */
export function WorkshopPage() {
  const dataTick = useApiData()
  const [refreshKey, setRefreshKey] = useState(0)
  const [panelSelection, setPanelSelection] = useState<WorkflowPanelSelection>(null)

  const workflowBoard = useMemo(() => {
    const board = loadEnquiryWorkflowBoard()
    const rows = board.rows.filter((row) => {
      const enquiry = enquiryService.getEnquiryById(row.enquiryId)
      if (!enquiry) return false
      return resolveWorkflowDisplayStage(enquiry) !== 'completed'
    })
    return { ...board, rows }
  }, [dataTick, refreshKey])

  const isEmpty = workflowBoard.rows.length === 0

  return (
    <div className="space-y-2 pb-2">
      {isEmpty ? (
        <Card className="py-16 text-center text-text-secondary">No active enquiries on the floor.</Card>
      ) : (
        <EnquiryWorkflowRadial board={workflowBoard} onSelect={setPanelSelection} />
      )}

      <p className="text-[11px] text-text-secondary">
        Updated {new Date(workflowBoard.generatedAt).toLocaleString()} · {workflowBoard.rows.length}{' '}
        ring{workflowBoard.rows.length === 1 ? '' : 's'}
      </p>

      <EnquiryWorkflowStagePanel
        selection={panelSelection}
        onClose={() => setPanelSelection(null)}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
