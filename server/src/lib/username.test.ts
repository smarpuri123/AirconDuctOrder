import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeUsername } from './username.js'

describe('normalizeUsername', () => {
  it('lowercases plain username', () => {
    assert.equal(normalizeUsername('Admin'), 'admin')
  })

  it('strips domain from email-style input', () => {
    assert.equal(normalizeUsername('dispatch@ecovent.com'), 'dispatch')
  })
})
