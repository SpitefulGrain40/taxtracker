export interface FxRate {
  from: string
  to: string
  rate: number
  date: string | null
}

export interface LivePrice {
  symbol: string
  price: number
  currency: string | null
  asOf: string | null   // ISO date of the close, e.g. "2026-07-16"
  source: string
  fx?: FxRate | null
}

// Best-effort. Returns null on any failure — callers must have a fallback.
// Pass `fx` to also request a currency conversion rate (e.g. EUR→GBP) so the
// price and rate come back in a single call. GBP is a reference conversion only.
export async function fetchLivePrice(
  proxyUrl: string,
  symbol: string,
  fx?: { from: string; to: string },
): Promise<LivePrice | null> {
  if (!proxyUrl || !symbol) return null
  try {
    const base = proxyUrl.replace(/\/+$/, '')
    let url = `${base}/?symbol=${encodeURIComponent(symbol)}`
    if (fx?.from && fx?.to) {
      url += `&fxFrom=${encodeURIComponent(fx.from)}&fxTo=${encodeURIComponent(fx.to)}`
    }
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data?.price !== 'number' || !Number.isFinite(data.price)) return null
    const rawFx = data?.fx
    const parsedFx: FxRate | null =
      rawFx && typeof rawFx.rate === 'number' && Number.isFinite(rawFx.rate)
        ? {
            from: String(rawFx.from ?? fx?.from ?? ''),
            to: String(rawFx.to ?? fx?.to ?? ''),
            rate: rawFx.rate,
            date: rawFx.date ?? null,
          }
        : null
    return {
      symbol: String(data.symbol ?? symbol),
      price: data.price,
      currency: data.currency ?? null,
      asOf: data.asOf ?? null,
      source: String(data.source ?? 'proxy'),
      fx: parsedFx,
    }
  } catch {
    return null
  }
}
