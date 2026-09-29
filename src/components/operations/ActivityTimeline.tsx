import { PHASE_LABELS } from '@/lib/activity'

import { formatDate } from '@/lib/calculations'

import { downloadEnquiryDocument } from '@/lib/enquiryDocuments'

import { isApiMode } from '@/lib/api'

import type { ActivityEntry, ActivityPhase, EnquiryDesignDocument } from '@/types/enquiry'



const PHASE_COLORS: Record<ActivityPhase, string> = {

  enquiry: 'bg-blue-500',

  design: 'bg-violet-500',

  order: 'bg-amber-500',

  production: 'bg-orange-500',

  dispatch: 'bg-secondary',

}



function formatTimestamp(ts: string): string {

  try {

    const d = new Date(ts)

    return d.toLocaleString('en-IN', {

      day: '2-digit',

      month: 'short',

      year: 'numeric',

      hour: '2-digit',

      minute: '2-digit',

    })

  } catch {

    return formatDate(ts)

  }

}



interface ActivityTimelineProps {

  entries: ActivityEntry[]

  groupByPhase?: boolean

  documents?: EnquiryDesignDocument[]

}



function activityDownloadDocuments(
  entry: ActivityEntry,
  documents: EnquiryDesignDocument[],
): EnquiryDesignDocument[] {
  const byId = new Map(documents.map((d) => [d.id, d]))
  const fromIds = (entry.metadata?.documentIds ?? [])
    .map((id) => byId.get(id))
    .filter((d): d is EnquiryDesignDocument => Boolean(d))
  if (fromIds.length > 0) return fromIds

  const ductDocs = documents.filter((d) => d.category === 'duct_schedule')
  const fileName = entry.metadata?.excelFileName
  if (fileName) {
    const match = ductDocs.find((d) => d.fileName === fileName)
    if (match) return [match]
  }

  if (entry.title.startsWith('Duct schedule imported') && ductDocs.length > 0) {
    return [ductDocs[0]]
  }

  if (
    entry.title.startsWith('Submitted to accounts') &&
    entry.detail?.toLowerCase().includes('duct extraction') &&
    ductDocs.length > 0
  ) {
    return [ductDocs[0]]
  }

  return []
}

export function ActivityTimeline({ entries, groupByPhase = true, documents = [] }: ActivityTimelineProps) {

  if (entries.length === 0) {

    return <p className="text-sm text-text-secondary">No activity recorded yet.</p>

  }



  if (!groupByPhase) {

    return (

      <div className="space-y-4">

        {entries.map((entry) => (

          <ActivityRow key={entry.id} entry={entry} documents={documents} />

        ))}

      </div>

    )

  }



  const phases: ActivityPhase[] = ['enquiry', 'design', 'order', 'production', 'dispatch']

  const grouped = phases

    .map((phase) => ({

      phase,

      items: entries.filter((e) => e.phase === phase),

    }))

    .filter((g) => g.items.length > 0)



  return (

    <div className="space-y-6">

      {grouped.map(({ phase, items }) => (

        <div key={phase}>

          <div className="flex items-center gap-2 mb-3">

            <span className={`w-2 h-2 rounded-full ${PHASE_COLORS[phase]}`} />

            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">

              {PHASE_LABELS[phase]}

            </h4>

            <span className="text-xs text-text-secondary">({items.length})</span>

          </div>

          <div className="space-y-3 pl-4 border-l-2 border-border ml-0.5">

            {items.map((entry) => (

              <ActivityRow key={entry.id} entry={entry} compact documents={documents} />

            ))}

          </div>

        </div>

      ))}

    </div>

  )

}



function ActivityRow({

  entry,

  compact = false,

  documents,

}: {

  entry: ActivityEntry

  compact?: boolean

  documents: EnquiryDesignDocument[]

}) {

  const linkedDocs = activityDownloadDocuments(entry, documents)



  return (

    <div className={`flex gap-3 text-sm ${compact ? '' : 'pb-3 border-b border-border last:border-0'}`}>

      <div className={`w-2 h-2 rounded-full ${PHASE_COLORS[entry.phase]} mt-2 shrink-0`} />

      <div className="flex-1 min-w-0">

        <div className="flex flex-wrap items-center gap-2">

          <p className="font-medium">{entry.title}</p>

          {entry.revision != null && (

            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-background text-text-secondary border border-border">

              #{entry.revision}

            </span>

          )}

        </div>

        {entry.detail && <p className="text-text-secondary mt-0.5">{entry.detail}</p>}

        {linkedDocs.length > 0 && (

          <ul className="mt-2 space-y-1">

            {linkedDocs.map((doc) => (

              <li key={doc.id}>

                <button

                  type="button"

                  className="text-xs text-primary hover:underline text-left"

                  onClick={() => downloadEnquiryDocument(doc, isApiMode)}

                >

                  Download {doc.fileName}

                  {doc.inputRevision ? ` (Rev ${String(doc.inputRevision).padStart(2, '0')})` : ''}

                </button>

              </li>

            ))}

          </ul>

        )}

        <p className="text-xs text-text-secondary mt-1">

          <span className="font-medium text-text-primary">{entry.actor}</span>

          <span className="mx-1">·</span>

          {formatTimestamp(entry.timestamp)}

        </p>

      </div>

    </div>

  )

}


