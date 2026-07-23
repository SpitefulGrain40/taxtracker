import { useState } from 'react'
import { PoundSterling, ShieldCheck, TriangleAlert, TrendingUp } from 'lucide-react'
import { StatCard } from '../components/ui/StatCard'
import { AlertStrip } from '../components/ui/AlertStrip'
import { JargonTip } from '../components/ui/JargonTip'
import { PeriodToggle, type Period } from '../components/ui/PeriodToggle'
import { useTaxYear } from '../hooks/useTaxYear'
import { useProfile } from '../hooks/useProfile'
import { useFutureEvents } from '../hooks/useFutureEvents'
import { storage } from '../lib/storage'
import { summariseTaxYear } from '../lib/incomeSummary'
import { dividendTaxStacked, savingsTaxStacked, marginalBand, parseTaxCode, effectivePersonalAllowance } from '../lib/taxCalc'
import { projectTaxYear } from '../lib/projection'
import { CURRENT_RATES as R } from '../lib/taxRates'
import { getCurrentTaxYear, getTaxYearLabel, monthsIntoTaxYear } from '../lib/taxYears'
import { FirstPayslipPrompt } from '../components/ui/FirstPayslipPrompt'

export function DashboardScreen() {
  const profileId = storage.getActiveProfile()
  const { taxYear, loading } = useTaxYear(profileId)
  const { profile } = useProfile(profileId)
  const { events } = useFutureEvents(profileId)
  const [period, setPeriod] = useState<Period>('ytd')

  if (loading || !taxYear) {
    return <div className="text-text-2 text-sm py-8">Loading your tax position…</div>
  }

  const hasAnyPayslip = taxYear.employment.some(e => e.payslips.length > 0)
  if (!hasAnyPayslip) return <FirstPayslipPrompt />

  const s = summariseTaxYear(taxYear)
  const projection = projectTaxYear({
    taxYear,
    events,
    baseAnnualSalary: profile?.baseAnnualSalary ?? null,
    taxCode: s.taxCode,
    today: new Date(),
    rates: R,
  })
  const band = marginalBand(s.employmentIncome + s.dividendIncome + s.savingsIncome + s.benefitsInKind, R)
  const codeAllowance = s.taxCode ? parseTaxCode(s.taxCode).allowance : null
  const allowance = codeAllowance ?? effectivePersonalAllowance(s.employmentIncome, R)

  // Extra tax owed outside PAYE, using band-aware stacking:
  // savings stack on employment income, dividends stack above savings.
  const savTax = savingsTaxStacked(s.savingsIncome, s.employmentIncome, allowance, R)
  const divTax = dividendTaxStacked(s.dividendIncome, s.employmentIncome + s.savingsIncome, allowance, R)
  const extraOwed = divTax + savTax

  const key = getCurrentTaxYear()
  const monthsIn = monthsIntoTaxYear(new Date())
  const needsSA = s.dividendIncome > R.dividendAllowance || s.savingsIncome > R.psaHigherRate || (profile?.otherIncomeSources.includes('cgt') ?? false)

  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-4 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Your Tax Position</h1>
        <span className="font-mono text-xs text-text-2 tracking-wide">{getTaxYearLabel(key)}</span>
        <span className="ml-auto font-mono text-xs text-accent bg-accent-soft border border-accent/30 rounded-full px-3 py-1">{monthsIn} {monthsIn === 1 ? 'month' : 'months'} in</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <PeriodToggle value={period} onChange={setPeriod} />
        {period === 'month' && (
          <span className="text-text-2 text-xs">Showing year-to-date figures — a monthly breakdown isn't available yet.</span>
        )}
      </div>

      {needsSA && (
        <div className="mb-6">
          <AlertStrip variant="yellow">
            <strong>You'll likely need to file a Self Assessment</strong> — you have{' '}
            <JargonTip term="dividends" explanation="Payments from shares you own. The first £500 a year is tax-free; anything above is taxed." />{' '}
            or{' '}
            <JargonTip term="capital gains" explanation="Profit from selling shares or investments. The first £3,000 a year is tax-free." />{' '}
            outside of PAYE this year. Registration deadline: 5 October.
          </AlertStrip>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Earned this year" value={gbp(s.employmentIncome)} note="from your payslips (YTD)" icon={<PoundSterling size={15} />} />
        <StatCard label="Tax already paid" value={gbp(s.taxPaidToDate)} variant="green" note={<>via <JargonTip term="PAYE" explanation="Pay As You Earn — tax taken from your salary automatically before you're paid." /></>} icon={<ShieldCheck size={15} />} />
        <StatCard label="Extra likely owed" value={extraOwed > 0 ? `~${gbp(extraOwed)}` : '£0'} variant={extraOwed > 0 ? 'yellow' : 'green'} note="dividends + savings outside PAYE" icon={<TriangleAlert size={15} />} />
        <StatCard label="Marginal tax band" value={band === 'basic' ? 'Basic (20%)' : band === 'higher' ? 'Higher (40%)' : 'Additional (45%)'} variant="accent" note={s.taxCode ? `tax code ${s.taxCode}` : 'estimated'} icon={<TrendingUp size={15} />} />
      </div>

      {s.employmentIncome === 0 && (
        <AlertStrip variant="accent">
          No payslip data yet. Head to <strong>Documents</strong> to upload your latest payslip and see your live position.
        </AlertStrip>
      )}

      {projection.available && period === 'projected' && (
        <section className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-serif text-base">Projected year-end</h2>
            <span className="font-mono text-[10px] uppercase tracking-wide text-yellow bg-yellow/10 px-2 py-0.5 rounded">Estimate</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Projected income" value={gbp(projection.projectedGross)} variant="default" />
            <StatCard label="Projected tax + NI" value={gbp(projection.projectedTaxDue)} variant="yellow" />
            <StatCard
              label={projection.shortfall >= 0 ? 'Set aside for April' : 'Likely refund'}
              value={gbp(Math.abs(projection.shortfall))}
              variant={projection.shortfall >= 0 ? 'red' : 'green'}
            />
          </div>
          <ul className="mt-3 space-y-1 list-disc list-inside">
            {projection.assumptions.map((a, i) => (
              <li key={i} className="text-text-2 text-xs">{a}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
