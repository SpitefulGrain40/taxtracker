// TaxTracker price proxy — fetches previous trading day's close from Yahoo Finance.
// Runs server-side so the static PWA isn't blocked by CORS. No API key needed.

const ALLOWED_ORIGINS = [
  'https://spitefulgrain40.github.io',
  'http://localhost:5173',
]

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || ''
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }
    const url = new URL(request.url)
    const symbol = (url.searchParams.get('symbol') || 'SAP.DE').toUpperCase()
    // Basic allowlist so this can't be used as an open proxy
    if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol)) {
      return json({ error: 'invalid symbol' }, 400, origin)
    }
    try {
      const yurl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
      const r = await fetch(yurl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!r.ok) return json({ error: `upstream ${r.status}` }, 502, origin)
      const data = await r.json()
      const result = data?.chart?.result?.[0]
      const meta = result?.meta
      const closes = result?.indicators?.quote?.[0]?.close || []
      const timestamps = result?.timestamp || []
      // Walk backwards to the most recent non-null close (previous trading day).
      let price = null, asOf = null
      for (let i = closes.length - 1; i >= 0; i--) {
        if (closes[i] != null) { price = closes[i]; asOf = timestamps[i]; break }
      }
      if (price == null) price = meta?.regularMarketPrice ?? null
      if (price == null) return json({ error: 'no price' }, 404, origin)
      return json({
        symbol,
        price,
        currency: meta?.currency ?? null,
        asOf: asOf ? new Date(asOf * 1000).toISOString().slice(0, 10) : null,
        source: 'yahoo-finance',
      }, 200, origin)
    } catch (e) {
      return json({ error: String(e) }, 500, origin)
    }
  },
}

function json(obj, status, origin) {
  // Cache successful lookups for an hour; never cache errors so a transient
  // upstream failure doesn't stick around after recovery.
  const cache = status === 200 ? 'public, max-age=3600' : 'no-store'
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache, ...corsHeaders(origin) },
  })
}
