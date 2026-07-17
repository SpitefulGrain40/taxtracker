export interface LivePrice {
  symbol: string
  price: number
  currency: string | null
  asOf: string | null   // ISO date of the close, e.g. "2026-07-16"
  source: string
}

// Best-effort. Returns null on any failure — callers must have a fallback.
export async function fetchLivePrice(proxyUrl: string, symbol: string): Promise<LivePrice | null> {
  if (!proxyUrl || !symbol) return null
  try {
    const base = proxyUrl.replace(/\/+$/, '')
    const url = `${base}/?symbol=${encodeURIComponent(symbol)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data?.price !== 'number' || !Number.isFinite(data.price)) return null
    return {
      symbol: String(data.symbol ?? symbol),
      price: data.price,
      currency: data.currency ?? null,
      asOf: data.asOf ?? null,
      source: String(data.source ?? 'proxy'),
    }
  } catch {
    return null
  }
}
