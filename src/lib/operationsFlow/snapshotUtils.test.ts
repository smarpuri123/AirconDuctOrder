import { describe, expect, it } from 'vitest'
import type { Enquiry } from '@/types/enquiry'
import type { Order } from '@/types'
import {
  compareEnquiryPriority,
  designLaneIndex,
  formatDispatchProgress,
  resolveFlowColumnId,
} from './snapshotUtils'

function baseEnquiry(overrides: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'e1',
    enquiryNo: 'ENQ-001',
    customerName: 'Acme',
    projectName: 'Tower',
    enquiryDate: '2026-01-01',
    priority: 'normal',
    stage: 'design_review',
    designReview: { status: 'in_review', revision: 1 },
    activity: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('compareEnquiryPriority', () => {
  it('orders urgent before low', () => {
    expect(compareEnquiryPriority('urgent', 'low')).toBeLessThan(0)
    expect(compareEnquiryPriority('low', 'urgent')).toBeGreaterThan(0)
  })
})

describe('formatDispatchProgress', () => {
  it('formats duct counts', () => {
    expect(formatDispatchProgress(10, 120)).toBe('10/120')
  })
})

describe('designLaneIndex', () => {
  it('is stable for same assignee', () => {
    const a = designLaneIndex('emp-42', 4)
    const b = designLaneIndex('emp-42', 4)
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(4)
  })
})

describe('resolveFlowColumnId', () => {
  it('places approval processing in accounts column', () => {
    const enquiry = baseEnquiry({
      stage: 'design_review',
      designReview: { status: 'submitted_to_accounts', revision: 1 },
    })
    expect(resolveFlowColumnId(enquiry, undefined).columnId).toBe('approval_processing')
  })

  it('duplicates production tracks when both open', () => {
    const enquiry = baseEnquiry({ stage: 'manufacturing', orderId: 'o1' })
    const order: Order = {
      id: 'o1',
      orderNo: 'ORD-1',
      jobName: 'Job',
      customerId: 'c1',
      customerName: 'Acme',
      productionDate: '2026-01-01',
      totalQuantity: 100,
      totalArea: 50,
      status: 'production',
      revision: 1,
      productionApproved: true,
      straightDuctsCompleted: false,
      plasmaDuctsCompleted: false,
      createdAt: '2026-01-01',
      items: [],
    }
    const { columnId, tracks } = resolveFlowColumnId(enquiry, order)
    expect(columnId).toBe('production')
    expect(tracks).toEqual(['straight_ducts', 'plasma_ducts'])
  })
})
