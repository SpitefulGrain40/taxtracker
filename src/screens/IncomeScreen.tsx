import { IncomeRow } from '../components/income/IncomeRow'
import { ForecastSlider } from '../components/income/ForecastSlider'
import { JargonTip } from '../components/ui/JargonTip'
import { useTaxYear } from '../hooks/useTaxYear'
import { storage } from '../lib/storage'
import { summariseTaxYear } from '../lib/incomeSummary'
import { getCurrentTaxYear, getTaxYearLabel } from '../lib/taxYears'

export function IncomeScreen() {
  const profileId = storage.getActiveProfile()
  const { taxYear, loading } = useTaxYear(profileId)

  if (loading || !taxYear) {
    return <div className="text-text-2 text-sm py-8">Loading your income…</div>
  }

  const s = summariseTaxYear(taxYear)
  const key = getCurrentTaxYear()
  const allPayslips = taxYear.employment.flatMap(e => e.payslips)
  const salSac = allPayslips.length
    ? allPayslips[allPayslips.length - 1].salarySacrifice.reduce((sum, li) => sum + li.amount, 0)
    : 0

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Where your income comes from</h1>
        <span className="font-mono text-xs text-text-2">{getTaxYearLabel(key)} · year to date</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-serif text-base">Income sources</h2>
            <span className="font-mono text-[10px] bg-accent-soft text-accent px-2 py-0.5 rounded">YTD</span>
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
        </div>
        <ForecastSlider baseIncome={s.employmentIncome} />
      </div>
      <p className="text-text-2 text-xs mt-4">
        All figures are <JargonTip term="year to date" explanation="The running total since the tax year started on 6 April. Your latest payslip shows this." /> from your uploaded payslips.
      </p>
    </div>
  )
}
