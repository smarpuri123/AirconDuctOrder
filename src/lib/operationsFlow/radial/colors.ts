import type { WorkflowCellKind, WorkflowCellStatus } from '../enquiryTrack'

export type WorkshopSegmentZone = 'design' | 'quote' | 'production' | 'dispatch' | 'floor'

interface ZonePalette {
  completed: string
  active: string
  headerText: string
  arcStroke: string
}

/**
 * Palette matched to the circular radial matrix reference:
 * - Design: olive / leaf green (#659a24)
 * - Quotation & Commercial: deep river teal (#136f63)
 * - Production: architectural slate grey (#6c7075)
 * - Dispatch & Handover: warm bronze / olive-brown (#5c4d26)
 */
export const ZONE_PALETTES: Record<Exclude<WorkshopSegmentZone, 'floor'>, ZonePalette> = {
  design: {
    completed: '#659a24',
    active: '#84cc16',
    headerText: '#558b1f',
    arcStroke: '#8ab852',
  },
  quote: {
    completed: '#146c68',
    active: '#0d9488',
    headerText: '#115e59',
    arcStroke: '#4f9a94',
  },
  production: {
    completed: '#6b7075',
    active: '#475569',
    headerText: '#525860',
    arcStroke: '#9ca3af',
  },
  dispatch: {
    completed: '#5c4d26',
    active: '#856d33',
    headerText: '#544420',
    arcStroke: '#a19576',
  },
}

function normalizeZone(zone: WorkshopSegmentZone): Exclude<WorkshopSegmentZone, 'floor'> {
  return zone === 'floor' ? 'production' : zone
}

export function workshopSegmentFill(
  status: WorkflowCellStatus,
  zone: WorkshopSegmentZone,
): string {
  const palette = ZONE_PALETTES[normalizeZone(zone)]
  if (status === 'pending') return '#ffffff'
  if (status === 'rejected') return '#dc2626'
  if (status === 'on_hold' || status === 'blocked') return '#d97706'
  if (status === 'active') return palette.active
  return palette.completed
}

export function workshopSegmentStroke(
  status: WorkflowCellStatus,
  zone: WorkshopSegmentZone,
): string {
  const palette = ZONE_PALETTES[normalizeZone(zone)]
  if (status === 'pending') return 'transparent'
  if (status === 'rejected') return '#991b1b'
  if (status === 'on_hold' || status === 'blocked') return '#92400e'
  if (status === 'active') return palette.completed
  return 'transparent'
}

export function workshopSegmentTextFill(
  status: WorkflowCellStatus,
  _zone?: WorkshopSegmentZone,
): string {
  if (status === 'pending') return '#111827'
  return '#ffffff'
}

/** @deprecated legacy radial chip colors */
export function cellFill(status: WorkflowCellStatus, kind: WorkflowCellKind): string {
  const zone: WorkshopSegmentZone =
    kind === 'design'
      ? 'design'
      : kind === 'accounts'
        ? 'quote'
        : kind === 'production'
          ? 'production'
          : 'dispatch'
  return workshopSegmentFill(status, zone)
}

export function cellStroke(status: WorkflowCellStatus): string {
  return workshopSegmentStroke(status, 'quote')
}

export function cellTextFill(status: WorkflowCellStatus): string {
  return workshopSegmentTextFill(status, 'quote')
}

export function dispatchIconFill(status: WorkflowCellStatus): string {
  if (status === 'completed') return '#5c4d26'
  if (status === 'active') return '#856d33'
  return '#9ca3af'
}
