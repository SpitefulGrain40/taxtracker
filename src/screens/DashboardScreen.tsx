import { useState } from 'react'
import { PoundSterling, ShieldCheck, TriangleAlert, TrendingUp } from 'lucide-react'
import { StatCard } from '../components/ui/StatCard'
import { AlertStrip } from '../components/ui/AlertStrip'
import { JargonTip } from '../components/ui/JargonTip'
import { PeriodToggle, type Period } from '../components/ui/PeriodToggle'
import { useTaxYear } from '../hooks/useTaxYear'
import { useProfile } from '../hooks/useProfile'
import { useFutureEvents } from '../hooks/useFutureEvents'
import { useSelectedTaxYear } from '../hooks/useSelectedTaxYear'
import { TaxYearSelector } from '../components/ui/TaxYearSelector'
import { storage } from '../lib/storage'
import { summariseTaxYear } from '../lib/incomeSummary'
import { dividendTaxStacked, savingsTaxStacked, marginalBand, parseTaxCode, effectivePersonalAllowance } from '../lib/taxCalc'
import { projectTaxYear } from '../lib/projection'
import { CURRENT_RATES as R } from '../lib/taxRates'
import { monthsIntoTaxYear, getCurrentTaxYear, taxPeriodMonthLabel } from '../lib/taxYears'
import { payslipPeriodFigures } from '../lib/payslipFigures'
import { FirstPayslipPrompt } from '../components/ui/FirstPayslipPrompt'

export function DashboardScreen() {
  const profileId = storage.getActiveProfile()
  const { year } = useSelectedTaxYear()
  const { taxYear, loading } = useTaxYear(profileId, year)
  const { profile } = useProfile(profileId)
  const { events } = useFutureEvents(profileId)
  const [period, setPeriod] = useState<Period>('ytd')
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null)

  if (loading || !taxYear) {
    return <div className="text-text-2 text-sm py-8">Loading your tax position…</div>
  }

  const hasAnyPayslip = taxYear.employment.some(e => e.payslips.length > 0)
  if (!hasAnyPayslip) return <FirstPayslipPrompt />

  // Monthly view: payslips in this tax year, oldest first, defaulting to the latest.
  const hasMultipleEmployers = taxYear.employment.length > 1
  const monthlyPayslips = taxYear.employment.flatMap(e => e.payslips).sort((a, b) => a.taxPeriod - b.taxPeriod)
  const latestMonthlyPayslip = monthlyPayslips[monthlyPayslips.length - 1]
  const selectedPayslip = monthlyPayslips.find(p => p.id === selectedPayslipId) ?? latestMonthlyPayslip
  const monthFigures = payslipPeriodFigures(selectedPayslip)

  const s = summariseTaxYear(taxYear)
  const projection = projectTaxYear({
    taxYear,
    events,
    baseAnnualSalary: profile?.baseAnnualSalary ?? null,
    taxCode: s.taxCode,
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

  // The "months in" pill only means something for the year in progress; a past
  // year is complete, so say so rather than showing today's position against it.
  const isCurrentYear = year === getCurrentTaxYear()
  const monthsIn = monthsIntoTaxYear(new Date())
  const needsSA = s.dividendIncome > R.dividendAllowance || s.savingsIncome > R.psaHigherRate || (profile?.otherIncomeSources.includes('cgt') ?? false)

  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-4 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Your Tax Position</h1>
        <TaxYearSelector />
        <span className="ml-auto font-mono text-xs text-accent bg-accent-soft border border-accent/30 rounded-full px-3 py-1">
          {isCurrentYear ? `${monthsIn} ${monthsIn === 1 ? 'month' : 'months'} in` : 'complete year'}
        </span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <PeriodToggle value={period} onChange={setPeriod} />
        {period === 'month' && (
          <select
            value={selectedPayslip.id}
            onChange={e => setSelectedPayslipId(e.target.value)}
            className="bg-surface border border-white/10 rounded-lg text-text-1 font-mono text-xs px-2 py-1"
          >
            {monthlyPayslips.map(p => (
              <option key={p.id} value={p.id}>
                {hasMultipleEmployers ? `${taxPeriodMonthLabel(p.taxPeriod)} · ${p.employerName}` : taxPeriodMonthLabel(p.taxPeriod)}
              </option>
            ))}
          </select>
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

      {period === 'month' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <StatCard label="Gross this month" value={gbp(monthFigures.gross)} note={taxPeriodMonthLabel(selectedPayslip.taxPeriod)} icon={<PoundSterling size={15} />} />
          <StatCard label="Tax this month" value={gbp(monthFigures.tax)} variant="red" note="income tax withheld" icon={<TriangleAlert size={15} />} />
          <StatCard label="NI this month" value={gbp(monthFigures.ni)} variant="blue" note={<JargonTip term="NI" explanation="National Insurance — a separate tax on your earnings that funds the state pension and some benefits." />} icon={<ShieldCheck size={15} />} />
        </div>
      )}

      {period === 'ytd' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Earned this year" value={gbp(s.employmentIncome)} note="from your payslips (YTD)" icon={<PoundSterling size={15} />} />
          <StatCard label="Tax already paid" value={gbp(s.taxPaidToDate)} variant="green" note={<>via <JargonTip term="PAYE" explanation="Pay As You Earn — tax taken from your salary automatically before you're paid." /></>} icon={<ShieldCheck size={15} />} />
          <StatCard label="Extra likely owed" value={extraOwed > 0 ? `~${gbp(extraOwed)}` : '£0'} variant={extraOwed > 0 ? 'yellow' : 'green'} note="dividends + savings outside PAYE" icon={<TriangleAlert size={15} />} />
          <StatCard label="Marginal tax band" value={band === 'basic' ? 'Basic (20%)' : band === 'higher' ? 'Higher (40%)' : 'Additional (45%)'} variant="accent" note={s.taxCode ? `tax code ${s.taxCode}` : 'estimated'} icon={<TrendingUp size={15} />} />
        </div>
      )}

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
            <StatCard label="Projected income" value={gbp(projection.projectedGross)} variant="yellow" />
            <StatCard label="Projected tax + NI" value={gbp(projection.projectedTaxDue)} variant="yellow" note={<JargonTip term="NI" explanation="National Insurance — a separate tax on your earnings that funds the state pension and some benefits." />} />
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
          <details className="mt-4">
            <summary className="cursor-pointer text-text-2 hover:text-text-1 text-xs select-none">
              How this is worked out
            </summary>
            <div className="mt-3 space-y-1.5 bg-surface border border-white/[0.06] rounded-[10px] p-4">
              {projection.breakdown.items.map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs gap-4">
                  <span className="text-text-2">{item.label}</span>
                  <span className="font-mono tabular-nums text-text-1 text-right">{gbp(item.amount)}</span>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}
    </div>
  )
}
