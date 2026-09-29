export type OrderStatus =
  | 'draft'
  | 'imported'
  | 'production'
  | 'ready'
  | 'partially_dispatched'
  | 'fully_dispatched'
  | 'closed'
  | 'cancelled'

export type DispatchStatus =
  | 'draft'
  | 'loading'
  | 'loaded'
  | 'dispatched'
  | 'delivered'

export interface Customer {
  id: string
  name: string
  contact?: string
}

export interface OrderItem {
  id: string
  orderId: string
  tagNo: string | number
  description: string
  w1: number
  h1: number
  w2: number
  h2: number
  length: number
  orderedQty: number
  area: number
  producedQty: number
  readyQty: number
  dispatchedQty: number
}

export interface Order {
  id: string
  orderNo: string
  jobName: string
  customerId: string
  customerName: string
  productionDate: string
  invoiceDate?: string
  totalQuantity: number
  totalArea: number
  status: OrderStatus
  revision: number
  productionApproved?: boolean
  productionApprovedBy?: string
  productionApprovedDate?: string
  straightDuctsCompleted?: boolean
  straightDuctsCompletedAt?: string
  straightDuctsCompletedBy?: string
  plasmaDuctsCompleted?: boolean
  plasmaDuctsCompletedAt?: string
  plasmaDuctsCompletedBy?: string
  createdAt: string
  items: OrderItem[]
}

export interface VehicleDetails {
  vehicleNumber: string
  driverName: string
  driverMobile: string
  transporter: string
  vehicleType: string
  loadingDate: string
  loadingTime: string
  lrNumber?: string
  ewayBillNumber?: string
  driverId?: string
  transporterContact?: string
  destination?: string
  remarks?: string
}

export interface DispatchItem {
  orderItemId: string
  tagNo: string | number
  description: string
  w1: number
  h1: number
  w2: number
  h2: number
  length: number
  quantity: number
  area: number
}

export interface Dispatch {
  id: string
  dispatchNo: string
  orderId: string
  orderNo: string
  customerName: string
  vehicle: VehicleDetails
  items: DispatchItem[]
  totalQuantity: number
  totalArea: number
  status: DispatchStatus
  dispatchDate: string
  createdAt: string
}

export interface DashboardStats {
  totalOrders: number
  readyOrders: number
  dispatchedOrders: number
  todayDispatches: number
  todayDispatchQty: number
  pendingOrders: number
  partiallyDispatched: number
  fullyDispatched: number
  totalDuctQty: number
  totalArea: number
}

export interface CreateDispatchDraft {
  orderId: string
  quantities: Record<string, number>
  vehicle: VehicleDetails
}

export type OrderFilter = 'all' | 'ready' | 'partial' | 'fully_dispatched' | 'today' | 'overdue'
