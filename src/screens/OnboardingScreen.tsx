import { useState } from 'react'
import { StepPayslip } from '../components/onboarding/StepPayslip'
import { StepProfile } from '../components/onboarding/StepProfile'
import { StepScheme } from '../components/onboarding/StepScheme'
import { StepSalary } from '../components/onboarding/StepSalary'
import { StepIncome } from '../components/onboarding/StepIncome'
import { useProfile } from '../hooks/useProfile'
import { useTaxYear } from '../hooks/useTaxYear'
import { useFutureEvents } from '../hooks/useFutureEvents'
import { storage } from '../lib/storage'
import { getCurrentTaxYear, getTaxPeriod } from '../lib/taxYears'
import { buildOnboardingData } from '../lib/onboardingData'
import type { ShareSchemeConfig, Profile, Payslip } from '../types'

type Step = 'payslip' | 'profile' | 'scheme' | 'salary' | 'income' | 'saving'

interface ProfileData { firstName: string; niNumber: string; taxCode: string; employerName: string }
type ExtractedPayslip = Omit<Payslip, 'id' | 'taxPeriod' | 'taxYear' | 'rawExtracted'> & { rawExtracted: Record<string, string> }

interface Props { onComplete: () => void }

const STEP_LABELS = ['Payslip', 'Profile', 'Schemes', 'Salary', 'Income']
const STEPS: Step[] = ['payslip', 'profile', 'scheme', 'salary', 'income']

export function OnboardingScreen({ onComplete }: Props) {
  const profileId = storage.getActiveProfile()
  const { saveProfile } = useProfile(profileId)
  const { saveTaxYear } = useTaxYear(profileId)
  const { saveEvents } = useFutureEvents(profileId)

  const [step, setStep] = useState<Step>('payslip')
  const [payslip, setPayslip] = useState<ExtractedPayslip | null>(null)
  const [payslipPrefill, setPayslipPrefill] = useState<Partial<ProfileData>>({})
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [schemes, setSchemes] = useState<ShareSchemeConfig[]>([])
  const [salary, setSalary] = useState<{ baseAnnualSalary: number | null; bonus: { amount: number; effectiveDate: string } | null }>({ baseAnnualSalary: null, bonus: null })
  const [error, setError] = useState('')

  const stepIndex = STEPS.indexOf(step)

  const handlePayslipExtracted = (fields: ExtractedPayslip) => {
    setPayslip(fields)
    setPayslipPrefill({ employerName: fields.employerName, taxCode: fields.taxCode, niNumber: fields.niNumber })
    setStep('profile')
  }

  const handleProfileNext = (data: ProfileData) => { setProfileData(data); setStep('scheme') }
  const handleSchemeNext = (s: ShareSchemeConfig[]) => { setSchemes(s); setStep('salary') }
  const handleSalaryNext = (data: typeof salary) => { setSalary(data); setStep('income') }

  const handleIncomeNext = async (sources: Profile['otherIncomeSources']) => {
    if (!profileData) return
    setStep('saving')
    setError('')
    try {
      const key = getCurrentTaxYear()
      const fullPayslip: Payslip | null = payslip
        ? { ...payslip, id: `payslip-${key}-${Date.now()}`, taxPeriod: getTaxPeriod(new Date()), taxYear: key }
        : null

      const { profile, taxYear, futureEvents } = buildOnboardingData({
        profileId,
        firstName: profileData.firstName,
        niNumber: profileData.niNumber,
        taxCode: profileData.taxCode,
        pinHash: storage.getPinHash(profileId) ?? '',
        pinSalt: storage.getPinSalt(profileId) ?? '',
        schemes,
        otherIncomeSources: sources,
        key,
        payslip: fullPayslip,
        baseAnnualSalary: salary.baseAnnualSalary,
        bonus: salary.bonus,
      })

      await saveProfile(profile)
      await saveTaxYear(taxYear)
      if (futureEvents.length) await saveEvents(futureEvents)
      onComplete()
    } catch (e) {
      setError(String(e))
      setStep('income')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="font-serif text-[28px] tracking-[-0.03em] mb-1">Tax<span className="text-accent">Tracker</span></h1>
        <p className="text-text-2 text-sm mb-6">Let's set up your profile — takes 2 minutes</p>

        <div className="flex items-center gap-1.5 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5 flex-1">
              <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${i === stepIndex ? 'text-accent' : i < stepIndex ? 'text-green' : 'text-text-3'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${i === stepIndex ? 'bg-accent text-bg' : i < stepIndex ? 'bg-green text-bg' : 'bg-surface-3 text-text-3'}`}>
                  {i < stepIndex ? <span aria-hidden>&#10003;</span> : i + 1}
                </div>
                <span className="hidden sm:inline whitespace-nowrap">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (<div className={`h-px flex-1 min-w-[8px] ${i < stepIndex ? 'bg-green' : 'bg-surface-3'}`} />)}
            </div>
          ))}
        </div>

        {error && (<div className="mb-4 p-3 bg-red/10 border border-red/20 rounded-lg text-sm text-red">{error} — please try again.</div>)}

        {step === 'payslip' && <StepPayslip onExtracted={handlePayslipExtracted} onSkip={() => setStep('profile')} />}
        {step === 'profile' && <StepProfile profileId={profileId} prefill={payslipPrefill} onNext={handleProfileNext} />}
        {step === 'scheme' && profileData && <StepScheme employerName={profileData.employerName} onNext={handleSchemeNext} onSkip={() => handleSchemeNext([])} />}
        {step === 'salary' && <StepSalary onNext={handleSalaryNext} onSkip={() => handleSalaryNext({ baseAnnualSalary: null, bonus: null })} />}
        {step === 'income' && <StepIncome onNext={handleIncomeNext} />}
        {step === 'saving' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-text-2 text-sm">Saving your profile...</p>
          </div>
        )}
      </div>
    </div>
  )
}
