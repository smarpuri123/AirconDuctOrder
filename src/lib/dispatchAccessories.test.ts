import { describe, expect, it } from 'vitest'
import { calculateDispatchAccessories } from './dispatchAccessories'
import type { Order } from '@/types'

const mockOrder: Order = {
  id: 'ord-1',
  orderNo: 'ORD-001',
  jobName: 'ORD-001',
  customerId: 'cust-1',
  customerName: 'Acme Corp',
  productionDate: '2026-10-26',
  totalQuantity: 25,
  totalArea: 100,
  status: 'ready',
  revision: 1,
  createdAt: '2026-10-26T00:00:00Z',
  items: [
    {
      id: 'item-1',
      orderId: 'ord-1',
      tagNo: 1,
      description: 'ST',
      w1: 1000,
      h1: 500,
      w2: 1000,
      h2: 500,
      length: 1200,
      orderedQty: 15,
      area: 60,
      producedQty: 15,
      readyQty: 15,
      dispatchedQty: 0,
    },
    {
      id: 'item-2',
      orderId: 'ord-1',
      tagNo: 2,
      description: 'ELBOW',
      w1: 800,
      h1: 400,
      w2: 800,
      h2: 400,
      length: 900,
      orderedQty: 10,
      area: 40,
      producedQty: 10,
      readyQty: 10,
      dispatchedQty: 0,
    },
  ],
}

describe('calculateDispatchAccessories', () => {
  it('calculates CORNNER, N/BOLT, and CLEAT for only the loaded ducts in per_trip mode', () => {
    // Load 10 ducts of item-1 (out of 15)
    const acc = calculateDispatchAccessories(mockOrder, { 'item-1': 10 }, 'per_trip')
    expect(acc.mode).toBe('per_trip')
    // CORNER = 10 * 8 = 80
    expect(acc.corner.quantity).toBe(80)
    expect(acc.corner.included).toBe(true)
    // N/BOLT = 80 / 2 = 40
    expect(acc.nBolt.quantity).toBe(40)
    expect(acc.nBolt.included).toBe(true)
    // CLEAT for item-1 full row = ((1000+500+1000+500)*350)/100000 = 10.5; scaled by 10/15 = 7
    expect(acc.cleat.quantity).toBe(7)
    expect(acc.cleat.included).toBe(true)
  })

  it('calculates CORNNER, N/BOLT, and CLEAT for the entire order batch in entire_batch mode', () => {
    const acc = calculateDispatchAccessories(mockOrder, { 'item-1': 10 }, 'entire_batch')
    expect(acc.mode).toBe('entire_batch')
    // Total ordered qty = 25 => CORNER = 200, N/BOLT = 100
    expect(acc.corner.quantity).toBe(200)
    expect(acc.nBolt.quantity).toBe(100)
    // CLEAT = 10.5 + ((800+400+800+400)*350)/100000 (8.4) = 18.9 => 19
    expect(acc.cleat.quantity).toBe(19)
  })
})
