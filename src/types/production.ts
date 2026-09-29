export type ProductionProcess = 'straight_ducts' | 'plasma_ducts'

export const PRODUCTION_PROCESS_LABELS: Record<ProductionProcess, string> = {
  straight_ducts: 'Straight Ducts',
  plasma_ducts: 'Plasma Ducts',
}

export function productionProcessesComplete(order: {
  straightDuctsCompleted?: boolean
  plasmaDuctsCompleted?: boolean
}): boolean {
  return Boolean(order.straightDuctsCompleted && order.plasmaDuctsCompleted)
}
