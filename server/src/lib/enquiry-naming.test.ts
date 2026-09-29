import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatEnquiryNo,
  maxEnquirySequenceFromNumbers,
  enquiryNoPrefix,
} from './enquiry-naming.js'
import { maxDispatchSequenceFromNumbers } from './business-sequence.js'

describe('enquiry numbering helpers', () => {
  it('formats padded enquiry numbers', () => {
    assert.equal(formatEnquiryNo('ACME', 'PRJ1', 42), 'ACME-PRJ1-0042')
  })

  it('finds max suffix under prefix', () => {
    const prefix = enquiryNoPrefix('ACME', 'PRJ1')
    const max = maxEnquirySequenceFromNumbers(
      ['ACME-PRJ1-0001', 'ACME-PRJ1-0010', 'OTHER-0005'],
      prefix,
    )
    assert.equal(max, 10)
  })
})

describe('dispatch numbering helpers', () => {
  it('finds max dispatch sequence for a year', () => {
    const max = maxDispatchSequenceFromNumbers(
      ['D-2026-0003', 'D-2026-0099', 'D-2025-0001'],
      2026,
    )
    assert.equal(max, 99)
  })
})
