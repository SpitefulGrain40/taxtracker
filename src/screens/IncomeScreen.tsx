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
import { FirstPayslipPrompt } from '../components/ui/FirstPayslipPrompt'

export function IncomeScreen() {
  const profileId = storage.getActiveProfile()
  const { year } = useSelectedTaxYear()
  const { taxYear, loading } = useTaxYear(profileId, year)
  const { profile } = useProfile(profileId)
  const { events } = useFutureEvents(profileId)
  const [period, setPeriod] = useState<Period>('ytd')

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
  const salSac = allPayslips.length
    ? allPayslips[allPayslips.length - 1].salarySacrifice.reduce((sum, li) => sum + li.amount, 0)
    : 0

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Where your income comes from</h1>
        <TaxYearSelector />
        <span className="font-mono text-xs text-text-2">
          {period === 'projected' ? 'projected year-end' : 'year to date'}
        </span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <PeriodToggle value={period} onChange={setPeriod} />
        {period === 'month' && (
          <span className="text-text-2 text-xs">Showing year-to-date figures — a monthly breakdown isn't available yet.</span>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-serif text-base">Income sources</h2>
            <span className="font-mono text-[10px] bg-accent-soft text-accent px-2 py-0.5 rounded">{period === 'projected' ? 'PROJECTED' : 'YTD'}</span>
          </div>
          <IncomeRow name="Salary & car allowance" detail={`${taxYear.employment[0]?.employerName ?? 'Employer'} · ${allPayslips.length} payslip${allPayslips.length === 1 ? '' : 's'}`} source="PAYE" amount={s.employmentIncome} />
          {salSac !== 0 && (
            <IncomeRow name="Salary sacrifice" detail="Pension, critical illness etc." source="PAYE" amount={salSac} />
          )}
          <IncomeRow name="Dividends" detail={s.dividendIncome ? undefined : 'Add manually or import'} source="SELF-ASSESS" amount={s.dividendIncome || null} />
          <IncomeRow name="Savings interest" detail={s.savingsIncome ? undefined : 'Add manually'} source="SELF-ASSESS" amount={s.savingsIncome || null} />
          <IncomeRow name="Benefits in kind" detail={s.benefitsInKind ? undefined : 'From your P11D'} source="P11D" amount={s.benefitsInKind || null} />
          <div className="px-5 py-4 flex items-center justify-between border-t border-white/10 bg-surface-2">
            <span className="text-xs font-semibold tracking-wide text-text-2">Taxable total (confirmed)</span>
            <span className="font-serif text-xl">£{Math.round(s.employmentIncome).toLocaleString('en-GB')}</span>
          </div>
          {showProjected && (
            <div className="px-5 py-4 flex items-center justify-between border-t border-white/10">
              <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-text-2">
                Projected employment income
                <span className="font-mono text-[10px] uppercase tracking-wide text-yellow bg-yellow/10 px-2 py-0.5 rounded">Estimate</span>
              </span>
              <span className="font-serif text-xl text-yellow">£{Math.round(projection.projectedGross).toLocaleString('en-GB')}</span>
            </div>
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
        All figures are <JargonTip term="year to date" explanation="The running total since the tax year started on 6 April. Your latest payslip shows this." /> from your uploaded payslips.
        {showProjected && ' The projected figure for year-end is an estimate based on your stated salary and any future pay changes you have logged.'}
      </p>
    </div>
  )
}
