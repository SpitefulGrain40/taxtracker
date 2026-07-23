// Empty means zero. Anything that isn't a clean number is rejected, never coerced.
export function parseMoney(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return 0
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
