import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isDevSeedActive, seedProfile, seedShareLots, seedTaxYear } from './devSeed'
import { section104Pool } from './cgt'

describe('devSeed gating', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllEnvs())

  it('is active only when DEV build and flag set', () => {
    vi.stubEnv('DEV', true)
    localStorage.setItem('tt_dev_seed', '1')
    expect(isDevSeedActive()).toBe(true)
  })

  it('is inactive when the flag is not set', () => {
    vi.stubEnv('DEV', true)
    expect(isDevSeedActive()).toBe(false)
  })

  it('SAFETY: never activates in a production build, even with the flag set', () => {
    vi.stubEnv('DEV', false)
    localStorage.setItem('tt_dev_seed', '1')
    expect(isDevSeedActive()).toBe(false)
  })
})

describe('devSeed data', () => {
  it('produces a valid profile with a scheme', () => {
    const p = seedProfile('mike')
    expect(p.id).toBe('mike')
    expect(p.schemes[0].currency).toBe('EUR')
  })

  it('produces a tax year keyed to the requested year with income', () => {
    const ty = seedTaxYear('2025-26')
    expect(ty.key).toBe('2025-26')
    expect(ty.employment[0].payslips[0].ytdGross).toBeGreaterThan(0)
  })

  it('produces share lots that pool into a positive holding', () => {
    const pool = section104Pool(seedShareLots())
    expect(pool.quantity).toBeGreaterThan(0)
    expect(pool.totalCost).toBeGreaterThan(0)
  })
})
