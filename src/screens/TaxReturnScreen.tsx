import { useState, useEffect } from 'react'
import { Copy, FileDown, Check } from 'lucide-react'
import { ReturnSection } from '../components/taxreturn/ReturnSection'
import { ExportDialog } from '../components/taxreturn/ExportDialog'
import { AlertStrip } from '../components/ui/AlertStrip'
import { useTaxYear } from '../hooks/useTaxYear'
import { useSelectedTaxYear } from '../hooks/useSelectedTaxYear'
import { TaxYearSelector } from '../components/ui/TaxYearSelector'
import { storage } from '../lib/storage'
import { getDataClient } from '../lib/github'
import { readShareLots } from '../lib/dataRepo'
import { buildTaxReturn } from '../lib/taxReturn'
import { CURRENT_RATES as R } from '../lib/taxRates'
import { getCurrentTaxYear, getTaxYearLabel } from '../lib/taxYears'
import type { ShareLot } from '../types'

export function TaxReturnScreen() {
  const profileId = storage.getActiveProfile()
  const { year } = useSelectedTaxYear()
  const { taxYear, loading } = useTaxYear(profileId, year)
  const [lots, setLots] = useState<ShareLot[]>([])
  const [showExport, setShowExport] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const pat = storage.getGithubPat()
    const repo = localStorage.getItem('tt_data_repo')
    if (!pat || !repo) return
    const client = getDataClient(pat, repo)
    readShareLots(client, profileId).then(res => setLots(res?.data ?? [])).catch(() => setLots([]))
  }, [profileId])

  if (loading || !taxYear) return <div className="text-text-2 text-sm py-8">Loading your return…</div>

  const model = buildTaxReturn(taxYear, lots, R)

  // The share-lot register is a running holding with no date filter, so the CGT
  // section always describes TODAY's position. That is fine for the year in
  // progress, but for a past year it would sit next to that year's employment
  // boxes and mislead — so it is flagged on screen and left out of the export.
  const isCurrentYear = year === getCurrentTaxYear()
  const exportSections = isCurrentYear ? model.sections : model.sections.filter(s => s.code !== 'CGT')

  const copyToClipboard = () => {
    // Copy the same sections the export ships: on a past year the CGT figures are
    // today's holdings, not that year's, and these numbers get pasted straight
    // into an HMRC form — so they must not be carried over silently.
    const lines = exportSections.flatMap(s => [
      `## ${s.title}`,
      ...s.boxes.map(b => `${b.box !== '—' ? `Box ${b.box}: ` : ''}${b.label}: ${b.value == null ? '(needs input)' : `£${b.value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}`),
      '',
    ])
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Your Self Assessment</h1>
        <TaxYearSelector />
        <span className="ml-auto font-mono text-xs text-accent bg-accent-soft border border-accent/30 rounded-full px-3 py-1">
          {model.readyCount} of {model.totalSections} sections ready
        </span>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={copyToClipboard} className="flex items-center gap-2 bg-surface border border-white/10 rounded-lg px-4 py-2 text-sm hover:border-accent/30 transition-colors">
          {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy all figures'}
        </button>
        <button onClick={() => setShowExport(true)} className="flex items-center gap-2 bg-accent text-bg font-semibold rounded-lg px-4 py-2 text-sm hover:opacity-90 transition-opacity">
          <FileDown size={14} />
          Export for accountant
        </button>
      </div>

      <AlertStrip variant="accent">
        These figures map to the boxes on the HMRC online Self Assessment form. Copy each number into the matching box — you never need to understand the tax rules behind them.
      </AlertStrip>

      {!isCurrentYear && (
        <div className="mt-4">
          <AlertStrip variant="yellow">
            <strong>Capital gains shown are your current holdings, not scoped to this tax year</strong> — do not use
            these figures for a {getTaxYearLabel(year)} return. They are left out of the encrypted export, so the file
            you send your accountant contains the {getTaxYearLabel(year)} employment, dividend and savings figures only.
          </AlertStrip>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {model.sections.map(s =>
          s.code === 'CGT' && !isCurrentYear ? (
            <div key={s.code} className="space-y-2">
              <ReturnSection section={s} />
              <p className="text-yellow text-xs">
                Today's holdings — not scoped to {getTaxYearLabel(year)}, and excluded from the export.
              </p>
            </div>
          ) : (
            <ReturnSection key={s.code} section={s} />
          )
        )}
      </div>

      {showExport && (
        <ExportDialog
          data={{ taxYear: model.taxYear, generatedFor: profileId, sections: exportSections }}
          filename={`taxtracker-${profileId}-${model.taxYear}.enc.json`}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
