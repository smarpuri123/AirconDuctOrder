const STORAGE_KEY = 'ecovent_operations_flow_config'

export interface OperationsFlowConfig {
  designLaneCount: number
  accountsLaneCount: number
  straightLaneCount: number
  plasmaLaneCount: number
  dispatchLaneCount: number
  maxCompletedVisible: number
}

export const DEFAULT_OPERATIONS_FLOW_CONFIG: OperationsFlowConfig = {
  designLaneCount: 4,
  accountsLaneCount: 1,
  straightLaneCount: 1,
  plasmaLaneCount: 1,
  dispatchLaneCount: 1,
  maxCompletedVisible: 5,
}

export function getOperationsFlowConfig(): OperationsFlowConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_OPERATIONS_FLOW_CONFIG
    const parsed = JSON.parse(raw) as Partial<OperationsFlowConfig>
    return { ...DEFAULT_OPERATIONS_FLOW_CONFIG, ...parsed }
  } catch {
    return DEFAULT_OPERATIONS_FLOW_CONFIG
  }
}

export function saveOperationsFlowConfig(config: OperationsFlowConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}
