import { describe, it, expect } from 'vitest'
import { hashPin, verifyPin } from './auth'

describe('hashPin', () => {
  it('returns a hash and salt', async () => {
    const result = await hashPin('1234')
    expect(result.hash).toBeTruthy()
    expect(result.salt).toBeTruthy()
    expect(result.hash).not.toBe('1234')
  })

  it('produces different salts each time', async () => {
    const a = await hashPin('1234')
    const b = await hashPin('1234')
    expect(a.salt).not.toBe(b.salt)
  })
})

describe('verifyPin', () => {
  it('returns true for correct PIN', async () => {
    const { hash, salt } = await hashPin('5678')
    expect(await verifyPin('5678', hash, salt)).toBe(true)
  })

  it('returns false for wrong PIN', async () => {
    const { hash, salt } = await hashPin('5678')
    expect(await verifyPin('9999', hash, salt)).toBe(false)
  })
})
