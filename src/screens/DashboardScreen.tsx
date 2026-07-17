import { PoundSterling, ShieldCheck, TriangleAlert, TrendingUp } from 'lucide-react'
import { StatCard } from '../components/ui/StatCard'
import { AlertStrip } from '../components/ui/AlertStrip'
import { JargonTip } from '../components/ui/JargonTip'
import { useTaxYear } from '../hooks/useTaxYear'
import { useProfile } from '../hooks/useProfile'
import { storage } from '../lib/storage'
import { summariseTaxYear } from '../lib/incomeSummary'
import { dividendTaxStacked, savingsTaxStacked, marginalBand, parseTaxCode, effectivePersonalAllowance } from '../lib/taxCalc'
import { CURRENT_RATES as R } from '../lib/taxRates'
import { getCurrentTaxYear, getTaxYearLabel, monthsIntoTaxYear } from '../lib/taxYears'

export function DashboardScreen() {
  const profileId = storage.getActiveProfile()
  const { taxYear, loading } = useTaxYear(profileId)
  const { profile } = useProfile(profileId)

  if (loading || !taxYear) {
    return <div className="text-text-2 text-sm py-8">Loading your tax position…</div>
  }

  const s = summariseTaxYear(taxYear)
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
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Your Tax Position</h1>
        <span className="font-mono text-xs text-text-2 tracking-wide">{getTaxYearLabel(key)}</span>
        <span className="ml-auto font-mono text-xs text-accent bg-accent-soft border border-accent/30 rounded-full px-3 py-1">{monthsIn} {monthsIn === 1 ? 'month' : 'months'} in</span>
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
    </div>
  )
}
