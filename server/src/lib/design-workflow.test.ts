import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DESIGN_STATUSES,
  previousDesignStatus,
  designStatusLabel,
  APPROVAL_PROCESSING_STATUSES,
} from './design-workflow.js'

describe('design-workflow status pipeline', () => {
  it('includes PO_APPROVED between PO_FOR_REVIEW and PO_FOR_APPROVAL', () => {
    assert.equal(DESIGN_STATUSES.PO_APPROVED, 'PO_APPROVED')
    assert.equal(previousDesignStatus(DESIGN_STATUSES.PO_APPROVED), DESIGN_STATUSES.PO_FOR_REVIEW)
    assert.equal(previousDesignStatus(DESIGN_STATUSES.PO_FOR_APPROVAL), DESIGN_STATUSES.PO_APPROVED)
    assert.equal(previousDesignStatus(DESIGN_STATUSES.APPROVED), DESIGN_STATUSES.PO_FOR_APPROVAL)
  })

  it('includes PO_APPROVED in APPROVAL_PROCESSING_STATUSES', () => {
    assert.ok(APPROVAL_PROCESSING_STATUSES.includes(DESIGN_STATUSES.PO_APPROVED))
  })

  it('provides readable status labels for all stages', () => {
    assert.equal(designStatusLabel(DESIGN_STATUSES.PO_FOR_REVIEW), 'Quote review')
    assert.equal(designStatusLabel(DESIGN_STATUSES.PO_APPROVED), 'Quote approved (Supervisor)')
    assert.equal(designStatusLabel(DESIGN_STATUSES.PO_FOR_APPROVAL), 'Quote submitted to client')
    assert.equal(designStatusLabel(DESIGN_STATUSES.APPROVED), 'Quote approved')
  })
})
