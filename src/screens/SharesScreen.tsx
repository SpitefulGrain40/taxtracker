import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw, TrendingUp, Settings2 } from 'lucide-react'
import { LotTable } from '../components/shares/LotTable'
import { SellCalculator } from '../components/shares/SellCalculator'
import { UploadZone } from '../components/documents/UploadZone'
import { StatCard } from '../components/ui/StatCard'
import { AlertStrip } from '../components/ui/AlertStrip'
import { JargonTip } from '../components/ui/JargonTip'
import { useProfile } from '../hooks/useProfile'
import { useTaxYear } from '../hooks/useTaxYear'
import { storage } from '../lib/storage'
import { getDataClient } from '../lib/github'
import { readShareLots, writeShareLots } from '../lib/dataRepo'
import { parsePortfolioFile } from '../lib/portfolioImport'
import { section104Pool } from '../lib/cgt'
import { summariseTaxYear } from '../lib/incomeSummary'
import { marginalBand } from '../lib/taxCalc'
import { CURRENT_RATES as R } from '../lib/taxRates'
import { fetchLivePrice, type LivePrice } from '../lib/priceProxy'
import type { ShareLot } from '../types'

const DEFAULT_SYMBOL = 'SAP.DE'

export function SharesScreen() {
  const profileId = storage.getActiveProfile()
  const { profile } = useProfile(profileId)
  const { taxYear } = useTaxYear(profileId)

  const [lots, setLots] = useState<ShareLot[] | null>(null)
  const [sha, setSha] = useState<string | undefined>(undefined)
  const [state, setState] = useState<'idle' | 'importing' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Live-price feature state
  const [livePrice, setLivePrice] = useState<LivePrice | null>(null)
  const [manualPrice, setManualPrice] = useState<number | null>(null)
  const [priceState, setPriceState] = useState<'idle' | 'loading' | 'ok' | 'unavailable'>('idle')
  const [showPriceSettings, setShowPriceSettings] = useState(false)
  const [proxyUrl, setProxyUrl] = useState(storage.getPriceProxyUrl() ?? '')
  const [symbol, setSymbol] = useState(storage.getPriceSymbol(profileId) ?? DEFAULT_SYMBOL)

  // Load lots from data repo
  useEffect(() => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) { setLots([]); return }
    const client = getDataClient(pat, repo)
    readShareLots(client, profileId)
      .then(res => { setLots(res?.data ?? []); setSha(res?.sha) })
      .catch(() => setLots([]))
  }, [profileId])

  // Best-effort live price fetch once lots have loaded.
  useEffect(() => {
    if (lots === null) return
    const url = storage.getPriceProxyUrl()
    const sym = storage.getPriceSymbol(profileId) || DEFAULT_SYMBOL
    if (!url || !sym) { setPriceState('idle'); return }
    let cancelled = false
    setPriceState('loading')
    fetchLivePrice(url, sym)
      .then(res => {
        if (cancelled) return
        if (res) { setLivePrice(res); setPriceState('ok') }
        else { setLivePrice(null); setPriceState('unavailable') }
      })
      .catch(() => { if (!cancelled) { setLivePrice(null); setPriceState('unavailable') } })
    return () => { cancelled = true }
  }, [lots, profileId])

  const refreshPrice = () => {
    const url = storage.getPriceProxyUrl()
    const sym = storage.getPriceSymbol(profileId) || DEFAULT_SYMBOL
    if (!url || !sym) { setPriceState('idle'); return }
    setPriceState('loading')
    fetchLivePrice(url, sym)
      .then(res => {
        if (res) { setLivePrice(res); setPriceState('ok') }
        else { setLivePrice(null); setPriceState('unavailable') }
      })
      .catch(() => { setLivePrice(null); setPriceState('unavailable') })
  }

  const savePriceSettings = () => {
    const trimmedUrl = proxyUrl.trim()
    const trimmedSymbol = (symbol.trim() || DEFAULT_SYMBOL).toUpperCase()
    storage.setPriceProxyUrl(trimmedUrl)
    storage.setPriceSymbol(profileId, trimmedSymbol)
    setSymbol(trimmedSymbol)
    setShowPriceSettings(false)
    refreshPrice()
  }

  if (lots === null) return <div className="text-text-2 text-sm py-8">Loading your shares…</div>

  const pool = section104Pool(lots)
  const scheme = profile?.schemes[0]
  const lastLotPrice = lots.length ? (lots[lots.length - 1].acquisitionPriceGBP) : 0
  // Only use the live price in the £ headline if it's in GBP (or currency unknown).
  // A EUR price (e.g. SAP.DE on XETRA) would overstate the GBP figure, so skip it.
  const usableLive = livePrice && (livePrice.currency == null || livePrice.currency === 'GBP') ? livePrice.price : null
  // Fallback chain: manual override → usable (GBP) live price → last-lot price
  const effectivePrice = manualPrice ?? usableLive ?? lastLotPrice
  const currentValue = pool.quantity * effectivePrice
  const unrealised = currentValue - pool.totalCost

  const hasProxy = Boolean(storage.getPriceProxyUrl())
  const currencyMismatch = priceState === 'ok' && livePrice?.currency != null && livePrice.currency !== 'GBP'

  // Which price source is actually driving the effective price?
  const priceSource: 'manual' | 'live' | 'fallback' =
    manualPrice != null ? 'manual' : (usableLive != null ? 'live' : 'fallback')

  const band = taxYear ? marginalBand(summariseTaxYear(taxYear).employmentIncome, R) : 'higher'
  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

  const handleImport = async (file: File) => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo || !scheme) { setErrorMsg('Configure a share scheme in onboarding first.'); setState('error'); return }
    setState('importing')
    try {
      const imported = await parsePortfolioFile(file, scheme.id, scheme.employerName)
      const merged = [...lots, ...imported]
      const client = getDataClient(pat, repo)
      await writeShareLots(client, profileId, merged, sha)
      // refetch sha
      const res = await readShareLots(client, profileId)
      setLots(res?.data ?? merged); setSha(res?.sha)
      setState('idle')
    } catch (e) {
      setErrorMsg(String(e)); setState('error')
    }
  }

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Share Schemes</h1>
        {scheme && <span className="font-mono text-xs text-text-2">{scheme.employerName} · {scheme.currency}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Shares held" value={pool.quantity.toFixed(2)} note={`${lots.filter(l => !l.disposalDate).length} lots`} />
        <StatCard label="Est. current value" value={gbp(currentValue)} variant="green" note={`at £${effectivePrice.toFixed(2)}/share`} />
        <StatCard label="Unrealised gain" value={gbp(unrealised)} variant={unrealised >= 0 ? 'yellow' : 'red'} note="if sold at current price" />
      </div>

      {/* Price source control */}
      <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent-soft text-accent">
              <TrendingUp size={16} />
            </span>
            <div>
              <div className="font-mono text-sm text-text-1">£{effectivePrice.toFixed(2)}<span className="text-text-2 text-xs"> /share</span></div>
              <div className="text-[12px] text-text-2">
                {priceSource === 'live' && `Previous close${livePrice?.asOf ? ` · ${livePrice.asOf}` : ''}`}
                {priceSource === 'manual' && 'Manual price'}
                {priceSource === 'fallback' && 'Estimated from last purchase'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasProxy && (
              <button
                onClick={refreshPrice}
                disabled={priceState === 'loading'}
                className="flex items-center gap-1.5 text-[12px] text-accent hover:underline disabled:opacity-50 disabled:no-underline"
              >
                <RefreshCw size={13} className={priceState === 'loading' ? 'animate-spin' : ''} />
                {priceState === 'loading' ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
            <button
              onClick={() => setShowPriceSettings(v => !v)}
              className="flex items-center gap-1.5 text-[12px] text-text-2 hover:text-text-1"
            >
              <Settings2 size={13} />
              Price settings
            </button>
          </div>
        </div>

        {!hasProxy && (
          <p className="text-[12px] text-text-2 mt-3">
            Add a price source to see live values — see <span className="font-mono text-text-1">price-proxy/README.md</span>. Until then, values are estimated from your last purchase.
          </p>
        )}

        {priceState === 'unavailable' && hasProxy && (
          <p className="text-[12px] text-yellow mt-3">
            Couldn't reach the live price source. Showing an estimated price — you can set one manually below.
          </p>
        )}

        {currencyMismatch && (
          <div className="mt-3">
            <AlertStrip variant="yellow">
              This price is in {livePrice?.currency}. SAP shares on your statement are in GBP — enter the GBP price manually for an accurate figure.
            </AlertStrip>
          </div>
        )}

        {/* Manual price override */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-xs text-text-2 flex-1">Set price manually (GBP per share)</span>
          <span className="font-mono text-xs text-text-2">£</span>
          <input
            type="number"
            step={0.01}
            min={0}
            value={manualPrice ?? ''}
            placeholder={effectivePrice.toFixed(2)}
            onChange={e => {
              const v = e.target.value
              setManualPrice(v === '' ? null : Math.max(0, parseFloat(v) || 0))
            }}
            className="w-28 bg-bg border border-white/10 rounded px-2 py-1 text-sm font-mono text-right focus:outline-none focus:border-accent/50"
          />
          {manualPrice != null && (
            <button onClick={() => setManualPrice(null)} className="text-[12px] text-text-2 hover:text-text-1">
              Clear
            </button>
          )}
        </div>

        {/* Price settings (proxy URL + symbol) */}
        {showPriceSettings && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
            <div>
              <label className="block text-xs text-text-2 mb-1">Price proxy URL</label>
              <input
                type="text"
                value={proxyUrl}
                placeholder="https://taxtracker-price-proxy.<subdomain>.workers.dev"
                onChange={e => setProxyUrl(e.target.value)}
                className="w-full bg-bg border border-white/10 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs text-text-2 mb-1">
                <JargonTip term="Ticker symbol" explanation="The code that identifies a share on a stock exchange, e.g. SAP.DE for SAP on the German XETRA exchange." />
              </label>
              <input
                type="text"
                value={symbol}
                placeholder={DEFAULT_SYMBOL}
                onChange={e => setSymbol(e.target.value)}
                className="w-full bg-bg border border-white/10 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={savePriceSettings}
                className="text-[12px] font-medium text-accent hover:underline"
              >
                Save price settings
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-serif text-base">Lot register</h2>
            <span className="font-mono text-[10px] text-text-2">{lots.filter(l => !l.disposalDate).length} holdings</span>
          </div>
          <LotTable lots={lots} />
          <div className="p-5 border-t border-white/[0.06]">
            {state === 'importing' && <p className="text-text-2 text-sm">Importing portfolio…</p>}
            {state === 'error' && (
              <div className="flex items-start gap-2 text-sm text-red mb-3">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{errorMsg}
              </div>
            )}
            {state !== 'importing' && (
              <UploadZone label="Import portfolio export (.xlsx)" hint="From your broker — Fidelity, SAP, etc." onFile={handleImport} />
            )}
          </div>
        </div>

        <SellCalculator lots={lots} currentPrice={effectivePrice} band={band} />
      </div>

      {!scheme && (
        <div className="mt-6">
          <AlertStrip variant="accent">No share scheme configured. Add one in Settings to import your portfolio.</AlertStrip>
        </div>
      )}
    </div>
  )
}
