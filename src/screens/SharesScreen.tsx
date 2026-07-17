import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { LotTable } from '../components/shares/LotTable'
import { SellCalculator } from '../components/shares/SellCalculator'
import { UploadZone } from '../components/documents/UploadZone'
import { StatCard } from '../components/ui/StatCard'
import { AlertStrip } from '../components/ui/AlertStrip'
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
import type { ShareLot } from '../types'

export function SharesScreen() {
  const profileId = storage.getActiveProfile()
  const { profile } = useProfile(profileId)
  const { taxYear } = useTaxYear(profileId)

  const [lots, setLots] = useState<ShareLot[] | null>(null)
  const [sha, setSha] = useState<string | undefined>(undefined)
  const [state, setState] = useState<'idle' | 'importing' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

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

  if (lots === null) return <div className="text-text-2 text-sm py-8">Loading your shares…</div>

  const pool = section104Pool(lots)
  const scheme = profile?.schemes[0]
  // Market price: take the most recent lot's implied market or fall back to average cost
  const marketPrice = lots.length ? (lots[lots.length - 1].acquisitionPriceGBP) : 0
  const currentValue = pool.quantity * marketPrice
  const unrealised = currentValue - pool.totalCost

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
        <StatCard label="Est. current value" value={gbp(currentValue)} variant="green" note={`at £${marketPrice.toFixed(2)}/share`} />
        <StatCard label="Unrealised gain" value={gbp(unrealised)} variant={unrealised >= 0 ? 'yellow' : 'red'} note="if sold at current price" />
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

        <SellCalculator lots={lots} currentPrice={marketPrice} band={band} />
      </div>

      {!scheme && (
        <div className="mt-6">
          <AlertStrip variant="accent">No share scheme configured. Add one in Settings to import your portfolio.</AlertStrip>
        </div>
      )}
    </div>
  )
}
