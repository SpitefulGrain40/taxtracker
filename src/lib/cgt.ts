import type { ShareLot } from '../types'
import type { TaxRates } from './taxRates'
import type { Band } from './taxCalc'

export interface Section104 {
  quantity: number
  totalCost: number      // GBP
  averageCost: number    // GBP per share
}

/** Build the Section 104 holding pool from all non-disposed lots. */
export function section104Pool(lots: ShareLot[]): Section104 {
  const held = lots.filter(l => !l.disposalDate)
  const quantity = held.reduce((s, l) => s + l.quantity, 0)
  const totalCost = held.reduce((s, l) => s + l.costBasisGBP, 0)
  return {
    quantity,
    totalCost,
    averageCost: quantity > 0 ? totalCost / quantity : 0,
  }
}

export interface DisposalGain {
  proceeds: number
  costOfSold: number
  gain: number
}

/** Gain from selling `quantity` shares at `pricePerShare`, using pool average cost. */
export function disposalGain(pool: Section104, quantity: number, pricePerShare: number): DisposalGain {
  const proceeds = quantity * pricePerShare
  const costOfSold = quantity * pool.averageCost
  return { proceeds, costOfSold, gain: proceeds - costOfSold }
}

export interface CgtResult {
  taxableGain: number
  tax: number
  exemptionApplied: number
}

/**
 * CGT on a total gain for the year.
 * `exemptionUsed` = annual exempt amount already consumed by other disposals this year.
 * CGT band: shares use 18% (basic) / 24% (higher/additional) for 2025-26.
 */
export function cgtOnDisposal(gain: number, band: Band, exemptionUsed: number, r: TaxRates): CgtResult {
  const remainingExemption = Math.max(0, r.cgtAnnualExempt - exemptionUsed)
  const exemptionApplied = Math.min(gain, remainingExemption)
  const taxableGain = Math.max(0, gain - exemptionApplied)
  const rate = band === 'basic' ? r.cgtBasicRate : r.cgtHigherRate
  return { taxableGain, tax: taxableGain * rate, exemptionApplied }
}
