import type { ShareLot, SchemeType } from '../types'

export interface ManualLotInput {
  schemeId: string
  employerName: string
  schemeType: SchemeType
  acquisitionDate: string        // ISO yyyy-mm-dd
  quantity: number
  marketPricePerShare: number    // in the scheme currency, at acquisition
  discountRate?: number          // fraction (0.15 = 15%), for espp-discounted; taken from the scheme config
  fxToGBP: number                // scheme currency -> GBP rate ON THE ACQUISITION DATE (1 for GBP)
}

export interface BuiltLot {
  lot: ShareLot
  marketValueGBP: number         // = costBasisGBP; the full value the CGT basis uses
  taxableIncomeGBP: number       // discount (espp-discounted) / full vest value (rsu) / 0
  pricePaidGBP: number           // what the holder actually paid, for information
}

/**
 * Build a ShareLot from manually-entered figures for any scheme type.
 *
 * The CGT cost basis is always the FULL market value at acquisition (in GBP at
 * the acquisition-date FX rate). For a discounted ESPP the discount is recorded
 * as taxable income (taxed via PAYE at purchase); for an RSU the whole market
 * value is the taxable-at-vest income. Employer-match ESPP records no discount
 * income here (the match is handled through PAYE).
 */
export function buildManualLot(input: ManualLotInput): BuiltLot {
  const { schemeType, quantity, marketPricePerShare, fxToGBP } = input
  const marketPerShareGBP = marketPricePerShare * fxToGBP
  const marketValueGBP = marketPerShareGBP * quantity

  let taxableIncomeGBP = 0
  let pricePaidGBP = marketValueGBP

  if (schemeType === 'espp-discounted') {
    const rate = input.discountRate ?? 0
    taxableIncomeGBP = marketPerShareGBP * rate * quantity
    pricePaidGBP = marketValueGBP - taxableIncomeGBP
  } else if (schemeType === 'rsu') {
    taxableIncomeGBP = marketValueGBP
    pricePaidGBP = 0
  }

  const lot: ShareLot = {
    id: crypto.randomUUID(),
    schemeId: input.schemeId,
    employerName: input.employerName,
    schemeType,
    acquisitionDate: input.acquisitionDate,
    acquisitionPriceOriginal: marketPricePerShare,
    acquisitionPriceFX: fxToGBP,
    acquisitionPriceGBP: marketPerShareGBP,
    quantity,
    costBasisGBP: marketValueGBP,
    ...(taxableIncomeGBP > 0 ? { taxableIncomeGBP } : {}),
  }

  return { lot, marketValueGBP, taxableIncomeGBP, pricePaidGBP }
}
