import { describe, expect, it } from 'vitest'
import { buildEnquiryWorkflowRow } from './enquiryTrack'
import {
  computeArcSegmentDots,
  computeFanGeometry,
  computeLinearSegmentDots,
  RADIAL_STAGE_COLUMNS,
  rowLabelAnchor,
  tangentialTextRotation,
} from './radial/workshopLayout'
import type { Enquiry } from '@/types/enquiry'

function baseEnquiry(overrides: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'e1',
    enquiryNo: 'ENQ-100',
    customerName: 'Acme',
    projectName: 'Tower A',
    enquiryDate: '2026-01-01',
    priority: 'normal',
    stage: 'design_review',
    designReview: { status: 'pending', revision: 1 },
    activity: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildEnquiryWorkflowRow', () => {
  it('marks design assignment active when assignee present but work not started', () => {
    const row = buildEnquiryWorkflowRow(
      baseEnquiry({ currentAssigneeId: 'd1', currentAssigneeName: 'Alex' }),
      undefined,
      [],
    )
    const assign = row.cells.find((c) => c.id === 'design_assignment')
    expect(assign?.status).toBe('active')
    expect(assign?.revisionCount).toBe(1)
  })

  it('maps accounts PO stages sequentially and tracks revision counts', () => {
    const row = buildEnquiryWorkflowRow(
      baseEnquiry({
        designReview: { status: 'po_for_review', revision: 3 },
        stage: 'design_review',
      }),
      undefined,
      [],
    )
    expect(row.revision).toBe(3)
    expect(row.cells.find((c) => c.id === 'quotation_prep')?.status).toBe('completed')
    expect(row.cells.find((c) => c.id === 'quotation_prep')?.revisionCount).toBe(3)
    expect(row.cells.find((c) => c.id === 'quotation_approval')?.status).toBe('active')
    expect(row.cells.find((c) => c.id === 'quotation_approval')?.revisionCount).toBe(3)
  })

  it('positions row labels along the horizontal Design start axis without y overlap', () => {
    const rowCount = 6
    const geo = computeFanGeometry(rowCount, 960)
    expect(geo.arcStartDeg).toBe(-90)
    expect(geo.arcEndDeg).toBe(0)
    expect(geo.segmentCount).toBe(RADIAL_STAGE_COLUMNS.length)

    const anchors = Array.from({ length: rowCount }, (_, i) => rowLabelAnchor(geo, i, rowCount))
    for (let i = 1; i < anchors.length; i++) {
      expect(anchors[i].y - anchors[i - 1].y).toBeCloseTo(geo.bandThickness + geo.bandGap, 3)
      expect(anchors[i].x).toBe(anchors[0].x)
    }
  })

  it('produces more circular dots with reduced sizes as revision or dispatch count increases', () => {
    const d1 = computeLinearSegmentDots(0, 0, 70, 0, 22, 1)
    const d2 = computeLinearSegmentDots(0, 0, 70, 0, 22, 2)
    const d4 = computeLinearSegmentDots(0, 0, 70, 0, 22, 4)

    expect(d1).toHaveLength(1)
    expect(d2).toHaveLength(2)
    expect(d4).toHaveLength(4)
    expect(d2[0].r).toBeLessThan(d1[0].r)
    expect(d4[0].r).toBeLessThan(d2[0].r)

    const a1 = computeArcSegmentDots(300, 300, 200, -90, -77, 22, 1)
    const a3 = computeArcSegmentDots(300, 300, 200, -90, -77, 22, 3)
    expect(a1).toHaveLength(1)
    expect(a3).toHaveLength(3)
    expect(a3[0].r).toBeLessThan(a1[0].r)
  })

  it('keeps tangential perimeter labels upright across the 90-degree arc', () => {
    for (let deg = -90; deg <= 0; deg += 15) {
      const rot = tangentialTextRotation(deg)
      expect(rot).toBeGreaterThanOrEqual(-90)
      expect(rot).toBeLessThanOrEqual(90)
    }
  })

  it('keeps order_complete pending when partially dispatched (5/110) and tracks pending count', () => {
    const enquiry = baseEnquiry({
      enquiryNo: 'ABC-CONSTRUCTION-SP123-0001',
      orderId: 'ord-1',
      stage: 'dispatch',
      designReview: { status: 'approved', revision: 1, totalQty: 110 },
    })
    const order = {
      id: 'ord-1',
      orderNo: 'ORD-1',
      jobName: 'ORD-1',
      customerId: 'cust-1',
      customerName: 'ABC Construction',
      productionDate: '2026-01-01',
      totalQuantity: 110,
      totalArea: 113.65,
      status: 'partially_dispatched' as const,
      revision: 1,
      productionApproved: true,
      straightDuctsCompleted: true,
      plasmaDuctsCompleted: true,
      createdAt: '2026-01-01T00:00:00Z',
      items: [
        {
          id: 'item-1',
          orderId: 'ord-1',
          tagNo: 1,
          description: 'ST',
          w1: 500,
          h1: 300,
          w2: 500,
          h2: 300,
          length: 1120,
          orderedQty: 110,
          area: 113.65,
          producedQty: 110,
          readyQty: 110,
          dispatchedQty: 5,
        },
      ],
    }
    const dispatches = [
      {
        id: 'disp-1',
        dispatchNo: 'D-2026-0001',
        orderId: 'ord-1',
        orderNo: 'ORD-1',
        customerName: 'ABC Construction',
        vehicle: {
          vehicleNumber: 'KA-01-1234',
          driverName: 'Driver',
          driverMobile: '9999999999',
          transporter: 'Transporter',
          vehicleType: 'Truck',
          loadingDate: '2026-01-02',
          loadingTime: '10:00',
        },
        items: [],
        totalQuantity: 5,
        totalArea: 5,
        status: 'loaded' as const,
        dispatchDate: '2026-01-02',
        createdAt: '2026-01-02T10:00:00Z',
      },
    ]

    const row = buildEnquiryWorkflowRow(enquiry, order, dispatches)
    expect(row.dispatchedQty).toBe(5)
    expect(row.totalOrderQty).toBe(110)
    expect(row.pendingDispatchQty).toBe(105)
    expect(row.dispatchSummaryStatus).toBe('active')
    expect(row.cells.find((c) => c.id === 'ready_dispatch')?.status).toBe('completed')
    expect(row.cells.find((c) => c.id === 'order_complete')?.status).toBe('pending')
    expect(row.cells.find((c) => c.id === 'order_complete')?.detail).toContain('5/110 dispatched')
  })
})
