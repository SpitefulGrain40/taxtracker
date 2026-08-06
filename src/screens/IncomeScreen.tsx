import { useState } from 'react'
import { IncomeRow } from '../components/income/IncomeRow'
import { ForecastSlider } from '../components/income/ForecastSlider'
import { JargonTip } from '../components/ui/JargonTip'
import { PeriodToggle, type Period } from '../components/ui/PeriodToggle'
import { useTaxYear } from '../hooks/useTaxYear'
import { useProfile } from '../hooks/useProfile'
import { useFutureEvents } from '../hooks/useFutureEvents'
import { useSelectedTaxYear } from '../hooks/useSelectedTaxYear'
import { TaxYearSelector } from '../components/ui/TaxYearSelector'
import { storage } from '../lib/storage'
import { summariseTaxYear } from '../lib/incomeSummary'
import { projectTaxYear } from '../lib/projection'
import { CURRENT_RATES as R } from '../lib/taxRates'
import { getCurrentTaxYear, taxPeriodMonthLabel } from '../lib/taxYears'
import { payslipPeriodFigures } from '../lib/payslipFigures'
import { FirstPayslipPrompt } from '../components/ui/FirstPayslipPrompt'

export function IncomeScreen() {
  const profileId = storage.getActiveProfile()
  const { year } = useSelectedTaxYear()
  const { taxYear, loading } = useTaxYear(profileId, year)
  const { profile } = useProfile(profileId)
  const { events } = useFutureEvents(profileId)
  const [period, setPeriod] = useState<Period>('ytd')
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null)

  if (loading || !taxYear) {
    return <div className="text-text-2 text-sm py-8">Loading your income…</div>
  }

  const hasAnyPayslip = taxYear.employment.some(e => e.payslips.length > 0)
  if (!hasAnyPayslip) return <FirstPayslipPrompt />

  const s = summariseTaxYear(taxYear)
  const projection = projectTaxYear({
    taxYear,
    events,
    baseAnnualSalary: profile?.baseAnnualSalary ?? null,
    taxCode: s.taxCode,
    rates: R,
  })
  const showProjected = period === 'projected' && projection.available
  const allPayslips = taxYear.employment.flatMap(e => e.payslips)

  // Monthly view: payslips in this tax year, oldest first, defaulting to the latest.
  const hasMultipleEmployers = taxYear.employment.length > 1
  const monthlyPayslips = allPayslips.slice().sort((a, b) => a.taxPeriod - b.taxPeriod)
  const latestMonthlyPayslip = monthlyPayslips[monthlyPayslips.length - 1]
  const selectedPayslip = monthlyPayslips.find(p => p.id === selectedPayslipId) ?? latestMonthlyPayslip
  const monthFigures = payslipPeriodFigures(selectedPayslip)
  const monthLabel = taxPeriodMonthLabel(selectedPayslip.taxPeriod)
  const showMonth = period === 'month'

  // Salary sacrifice is a per-period figure, so it has to come from the payslip
  // actually on screen — the selected month's in Monthly view, the latest by tax
  // period otherwise (flatMap order is not chronological).
  const salSacSource = showMonth ? selectedPayslip : latestMonthlyPayslip
  const salSac = salSacSource ? salSacSource.salarySacrifice.reduce((sum, li) => sum + li.amount, 0) : 0

  // A past year is finished: nothing is being projected and no figure is "to date".
  const isCurrentYear = year === getCurrentTaxYear()
  const periodLabel = period === 'projected'
    ? (isCurrentYear ? 'projected year-end' : 'full year')
    : showMonth
      ? monthLabel
      : (isCurrentYear ? 'year to date' : 'full year')

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Where your income comes from</h1>
        <TaxYearSelector />
        <span className="font-mono text-xs text-text-2">{periodLabel}</span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <PeriodToggle value={period} onChange={setPeriod} />
        {showMonth && (
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-serif text-base">Income sources</h2>
            <span className="font-mono text-[10px] bg-accent-soft text-accent px-2 py-0.5 rounded">
              {showMonth ? monthLabel.toUpperCase() : !isCurrentYear ? 'FULL YEAR' : period === 'projected' ? 'PROJECTED' : 'YTD'}
            </span>
          </div>
          {showProjected ? (
            <div className="px-5 py-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-text-2">
                {isCurrentYear ? 'Projected employment income' : 'Full year employment income'}
                {isCurrentYear ? (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-yellow bg-yellow/10 px-2 py-0.5 rounded">Estimate</span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-2 bg-surface-2 px-2 py-0.5 rounded">Full year</span>
                )}
              </span>
              <span className={`font-serif text-xl ${isCurrentYear ? 'text-yellow' : 'text-text-1'}`}>£{Math.round(projection.projectedGross).toLocaleString('en-GB')}</span>
            </div>
          ) : (
            <>
              <IncomeRow
                name="Salary & car allowance"
                detail={`${taxYear.employment[0]?.employerName ?? 'Employer'} · ${allPayslips.length} payslip${allPayslips.length === 1 ? '' : 's'}`}
                source="PAYE"
                amount={showMonth ? monthFigures.gross : s.employmentIncome}
              />
              {salSac !== 0 && (
                <IncomeRow name="Salary sacrifice" detail="Pension, critical illness etc." source="PAYE" amount={salSac} />
              )}
              <IncomeRow name="Dividends" detail={s.dividendIncome ? undefined : 'Add manually or import'} source="SELF-ASSESS" amount={s.dividendIncome || null} />
              <IncomeRow name="Savings interest" detail={s.savingsIncome ? undefined : 'Add manually'} source="SELF-ASSESS" amount={s.savingsIncome || null} />
              <IncomeRow name="Benefits in kind" detail={s.benefitsInKind ? undefined : 'From your P11D'} source="P11D" amount={s.benefitsInKind || null} />
              <div className="px-5 py-4 flex items-center justify-between border-t border-white/10 bg-surface-2">
                <span className="text-xs font-semibold tracking-wide text-text-2">
                  {showMonth ? `Total for ${monthLabel}` : 'Taxable total (confirmed)'}
                </span>
                <span className="font-serif text-xl">£{Math.round(showMonth ? monthFigures.gross : s.employmentIncome).toLocaleString('en-GB')}</span>
              </div>
            </>
          )}
        </div>
        <div>
          <ForecastSlider baseIncome={projection.available ? projection.projectedGross : s.employmentIncome} />
          {projection.available && (
            <p className="text-text-2 text-xs mt-2">
              This "what if" starts from your projected full-year income — an estimate, not a confirmed figure.
            </p>
          )}
        </div>
      </div>
      <p className="text-text-2 text-xs mt-4">
        {showProjected ? (
          isCurrentYear
            ? 'The projected figure for year-end is an estimate based on your stated salary and any future pay changes you have logged.'
            : 'This tax year is over — the full-year figure comes from the payslips you have uploaded for it.'
        ) : showMonth ? (
          <>Salary figures shown are for <strong>{monthLabel}</strong> only, from that month's payslip. The other income sources above are shown {isCurrentYear ? 'year to date' : 'for the full year'}.</>
        ) : isCurrentYear ? (
          <>All figures are <JargonTip term="year to date" explanation="The running total since the tax year started on 6 April. Your latest payslip shows this." /> from your uploaded payslips.</>
        ) : (
          'This tax year is over — all figures are the full-year totals from the payslips you have uploaded for it.'
        )}
      </p>
    </div>
  )
}
