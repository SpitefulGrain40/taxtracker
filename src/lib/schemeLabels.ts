import type { SchemeType } from '../types'

export const SCHEME_TYPE_LABELS: Record<SchemeType, string> = {
  'espp-match': 'ESPP with employer match',
  'espp-discounted': 'ESPP at a discount',
  rsu: 'RSU (free shares that vest over time)',
  csop: 'CSOP (Company Share Option Plan)',
  emi: 'EMI (Enterprise Management Incentive)',
  saye: 'SAYE / Sharesave',
}
