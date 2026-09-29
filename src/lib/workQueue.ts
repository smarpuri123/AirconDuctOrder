import { getOrderBalanceQty } from '@/lib/calculations'
import { normalizeDispatchStatus } from '@/lib/dispatchWorkflow'
import {
  awaitingDesignStart,
  isApprovalProcessing,
  isDesignReviewWork,
  needsEnquiryIntake,
} from '@/lib/enquiryWorkflow'
import { dispatchService } from '@/services/dispatchService'
import { enquiryService } from '@/services/enquiryService'
import { orderService } from '@/services/orderService'

/** Sidebar nav badges for Orders / Dispatch (re-enable when queues are wired to nav). */
const ORDERS_DISPATCH_NAV_BADGES_ENABLED = false

/**
 * Work-queue KPIs — counts of items waiting for a human action (inbox-style).
 *
 * | KPI | Meaning |
 * |-----|---------|
 * | enquiryNotStarted | Enquiry created; no client drawing yet |
 * | designReviewAction | Design phase needs engineering (extract, revise, submit) |
 * | accountsApprovalAction | With accounts / PO workflow |
 * | productionNotApproved | Order in production; production not approved to start |
 * | productionInProgress | Approved but straight/plasma processes not complete |
 * | ordersReadyToDispatch | Stock ready (not in production status) with qty balance |
 * | dispatchesInProgress | Trips not yet delivered |
 */
export interface WorkQueueBreakdown {
  enquiryNotStarted: number
  designReviewAction: number
  accountsApprovalAction: number
  productionNotApproved: number
  productionInProgress: number
  ordersReadyToDispatch: number
  dispatchesInProgress: number
}

export interface SidebarBadges {
  dashboard: number
  enquiries: number
  orders: number
  dispatch: number
}

export interface WorkQueueSnapshot {
  breakdown: WorkQueueBreakdown
  sidebar: SidebarBadges
}

function enrichedEnquiries() {
  return enquiryService.getEnquiries().map((e) => enquiryService.withEffectiveStage(e))
}

/** Open customer orders used for production / dispatch KPIs (excludes closed-out). */
export function ordersForOperationsKpi() {
  return orderService.getOrders().filter(
    (o) => o.status !== 'fully_dispatched' && o.status !== 'closed',
  )
}

export function computeWorkQueueSnapshot(): WorkQueueSnapshot {
  const enquiries = enrichedEnquiries()

  const enquiryNotStarted = enquiries.filter((e) => needsEnquiryIntake(e)).length
  const designReviewAction = enquiries.filter((e) => isDesignReviewWork(e)).length
  const accountsApprovalAction = enquiries.filter((e) => isApprovalProcessing(e)).length

  const orders = ordersForOperationsKpi()
  const productionNotApproved = orders.filter(
    (o) => o.status === 'production' && !o.productionApproved,
  ).length
  const productionInProgress = orders.filter(
    (o) =>
      o.status === 'production' &&
      Boolean(o.productionApproved) &&
      (!o.straightDuctsCompleted || !o.plasmaDuctsCompleted),
  ).length
  const ordersReadyToDispatch = orders.filter(
    (o) => getOrderBalanceQty(o) > 0 && o.status !== 'production',
  ).length

  const dispatchesInProgress = dispatchService.getDispatches().filter((d) => {
    const s = normalizeDispatchStatus(d.status)
    return s !== 'delivered'
  }).length

  const breakdown: WorkQueueBreakdown = {
    enquiryNotStarted,
    designReviewAction,
    accountsApprovalAction,
    productionNotApproved,
    productionInProgress,
    ordersReadyToDispatch,
    dispatchesInProgress,
  }

  const enquiriesNavBadge = enquiries.filter((e) => awaitingDesignStart(e)).length
  const ordersBadge = ORDERS_DISPATCH_NAV_BADGES_ENABLED
    ? productionNotApproved + productionInProgress
    : 0
  const dispatchBadge = ORDERS_DISPATCH_NAV_BADGES_ENABLED
    ? ordersReadyToDispatch + dispatchesInProgress
    : 0

  const sidebar: SidebarBadges = {
    dashboard: enquiriesNavBadge,
    enquiries: enquiriesNavBadge,
    orders: ordersBadge,
    dispatch: dispatchBadge,
  }

  return { breakdown, sidebar }
}

/** Role-aware sidebar badges (dispatch staff see dispatch queue only, etc.). */
export function sidebarBadgesForRoles(
  snapshot: WorkQueueSnapshot,
  roles: string[],
): SidebarBadges {
  const admin = roles.includes('ADMIN')
  if (admin || roles.length === 0) return snapshot.sidebar

  const b = snapshot.breakdown
  const accounts = roles.includes('ACCOUNTS')
  const dispatch = roles.includes('DISPATCH') || roles.includes('DISPATCHER')
  const designer = roles.includes('DESIGNER')
  const production = roles.includes('PRODUCTION')
  const supervisor = roles.includes('SUPERVISOR')

  if (designer && !accounts && !dispatch) {
    const n = b.designReviewAction
    return { dashboard: 0, enquiries: n, orders: 0, dispatch: 0 }
  }

  if (production && !accounts && !dispatch) {
    const n = b.productionNotApproved + b.productionInProgress
    return { dashboard: 0, enquiries: 0, orders: n, dispatch: 0 }
  }

  if (supervisor && !accounts && !dispatch && !designer && !production) {
    return snapshot.sidebar
  }

  if (dispatch && !accounts) {
    return {
      dashboard: snapshot.sidebar.enquiries,
      enquiries: snapshot.sidebar.enquiries,
      orders: 0,
      dispatch: 0,
    }
  }

  if (accounts && !dispatch) {
    const n = b.accountsApprovalAction
    return {
      dashboard: n,
      enquiries: 0,
      orders: 0,
      dispatch: 0,
    }
  }

  if (accounts && dispatch) {
    return {
      dashboard: b.accountsApprovalAction,
      enquiries: 0,
      orders: 0,
      dispatch: 0,
    }
  }

  return snapshot.sidebar
}

export function productionSubtext(breakdown: WorkQueueBreakdown): string | undefined {
  const { productionNotApproved, productionInProgress } = breakdown
  const total = productionNotApproved + productionInProgress
  if (total <= 0) return undefined
  const parts: string[] = []
  if (productionNotApproved > 0) {
    parts.push(`${productionNotApproved} awaiting production approval`)
  }
  if (productionInProgress > 0) {
    parts.push(`${productionInProgress} in straight/plasma steps`)
  }
  return parts.join(' · ')
}

export function formatBadgeCount(n: number): string {
  if (n <= 0) return ''
  if (n > 99) return '99+'
  return String(n)
}
