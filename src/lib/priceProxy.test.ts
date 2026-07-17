import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchLivePrice } from './priceProxy'

function mockFetch(response: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('fetchLivePrice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns a parsed LivePrice on a well-formed response', async () => {
    mockFetch({
      symbol: 'SAP.DE',
      price: 245.6,
      currency: 'EUR',
      asOf: '2026-07-16',
      source: 'yahoo-finance',
    })
    const result = await fetchLivePrice('https://proxy.example.dev', 'SAP.DE')
    expect(result).toEqual({
      symbol: 'SAP.DE',
      price: 245.6,
      currency: 'EUR',
      asOf: '2026-07-16',
      source: 'yahoo-finance',
    })
  })

  it('returns null when res.ok is false', async () => {
    mockFetch({ error: 'upstream 502' }, false)
    const result = await fetchLivePrice('https://proxy.example.dev', 'SAP.DE')
    expect(result).toBeNull()
  })

  it('returns null when price is missing or non-numeric', async () => {
    mockFetch({ symbol: 'SAP.DE', price: 'not-a-number', currency: 'EUR' })
    const result = await fetchLivePrice('https://proxy.example.dev', 'SAP.DE')
    expect(result).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fn)
    const result = await fetchLivePrice('https://proxy.example.dev', 'SAP.DE')
    expect(result).toBeNull()
  })

  it('returns null immediately and does not call fetch when proxyUrl or symbol is empty', async () => {
    const fn = mockFetch({ price: 1 })
    expect(await fetchLivePrice('', 'SAP.DE')).toBeNull()
    expect(await fetchLivePrice('https://proxy.example.dev', '')).toBeNull()
    expect(fn).not.toHaveBeenCalled()
  })

  it('strips trailing slashes and builds the ?symbol= query correctly', async () => {
    const fn = mockFetch({
      symbol: 'SAP.DE',
      price: 245.6,
      currency: 'EUR',
      asOf: '2026-07-16',
      source: 'yahoo-finance',
    })
    await fetchLivePrice('https://proxy.example.dev///', 'SAP.DE')
    expect(fn).toHaveBeenCalledWith('https://proxy.example.dev/?symbol=SAP.DE')
  })
})
