// The UI shows discountRate as a PERCENTAGE (user types 15) but ShareSchemeConfig
// stores it as a FRACTION (0.15). Getting this wrong by a factor of 100 would badly
// misstate the taxable discount on a discounted ESPP, so the conversion lives here,
// isolated and unit-tested, rather than inline in the form.

/**
 * Parse a percentage string typed by the user into the fraction that gets stored.
 * Empty string means the field was left blank — returns null so the caller can
 * omit `discountRate` entirely rather than storing 0 (0% is a real, different
 * value from "not set"). Anything that isn't a clean non-negative number is
 * rejected, never coerced.
 */
export function percentToFraction(input: string): number | null {
  const t = input.trim()
  if (t === '') return null
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  // Round away float drift beyond 10 decimal places (e.g. 15/100 computing as
  // 0.15000000000000002) so the stored fraction matches the literal exactly.
  return Math.round((n / 100) * 1e10) / 1e10
}

/** Render a stored fraction back into the percentage string the input shows. */
export function fractionToPercent(f: number | undefined): string {
  if (f === undefined) return ''
  const percent = Math.round(f * 100 * 1e8) / 1e8
  return String(percent)
}
