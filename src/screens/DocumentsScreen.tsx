import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { UploadZone } from '../components/documents/UploadZone'
import { ExtractReview } from '../components/documents/ExtractReview'
import { DocumentList, type DocItem } from '../components/documents/DocumentList'
import { AlertStrip } from '../components/ui/AlertStrip'
import { useTaxYear } from '../hooks/useTaxYear'
import { useSelectedTaxYear } from '../hooks/useSelectedTaxYear'
import { TaxYearSelector } from '../components/ui/TaxYearSelector'
import { storage } from '../lib/storage'
import { extractPayslip, extractP11D, extractP60 } from '../lib/claude'
import { getTaxYearKey, getTaxPeriod } from '../lib/taxYears'
import type { TaxYear, Payslip, BenefitEntry } from '../types'

type DocType = 'payslip' | 'p11d' | 'p60'
type State = 'idle' | 'extracting' | 'review' | 'error'

async function fileToBase64(file: File): Promise<{ base64: string; mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' }> {
  const buffer = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  const mediaType = file.type === 'application/pdf' ? 'application/pdf'
    : file.type === 'image/png' ? 'image/png'
    : file.type === 'image/webp' ? 'image/webp'
    : 'image/jpeg'
  return { base64, mediaType }
}

/** Immutably append a payslip to the matching employer, or create a new employment. */
function withPayslip(ty: TaxYear, payslip: Payslip): TaxYear {
  const emp = ty.employment.find(e => e.employerName === payslip.employerName)
  const employment = emp
    ? ty.employment.map(e => (e === emp ? { ...e, payslips: [...e.payslips, payslip] } : e))
    : [...ty.employment, { id: crypto.randomUUID(), employerName: payslip.employerName, payslips: [payslip] }]
  return { ...ty, employment }
}

export function DocumentsScreen() {
  const profileId = storage.getActiveProfile()
  const { year } = useSelectedTaxYear()
  const { taxYear, saveTaxYear, loading } = useTaxYear(profileId, year)

  const [docType, setDocType] = useState<DocType>('payslip')
  const [state, setState] = useState<State>('idle')
  const [reviewFields, setReviewFields] = useState<{ label: string; value: string }[]>([])
  const [pendingApply, setPendingApply] = useState<((ty: TaxYear) => TaxYear) | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  if (loading || !taxYear) return <div className="text-text-2 text-sm py-8">Loading documents…</div>

  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleFile = async (file: File) => {
    const apiKey = storage.getClaudeKey()
    if (!apiKey) { setErrorMsg('Claude API key not found — check setup.'); setState('error'); return }
    setState('extracting')
    try {
      const { base64, mediaType } = await fileToBase64(file)

      if (docType === 'payslip') {
        const r = await extractPayslip(apiKey, base64, mediaType)
        setReviewFields([
          { label: 'Employer', value: r.employerName },
          { label: 'Basic Salary', value: gbp(r.basicSalary) },
          { label: 'Tax Paid', value: gbp(r.taxPaid) },
          { label: 'YTD Gross', value: gbp(r.ytdGross) },
          { label: 'Tax Code', value: r.taxCode },
        ])
        setPendingApply(() => (ty: TaxYear): TaxYear => {
          const payDate = new Date(r.date)
          const payslip: Payslip = {
            ...r, id: crypto.randomUUID(),
            taxPeriod: getTaxPeriod(payDate),
            taxYear: getTaxYearKey(payDate),
          }
          return withPayslip(ty, payslip)
        })
      } else if (docType === 'p11d') {
        const r = await extractP11D(apiKey, base64, mediaType)
        setReviewFields(r.benefits.map(b => ({ label: b.description, value: gbp(b.taxableValue) })))
        setPendingApply(() => (ty: TaxYear): TaxYear => {
          const entries: BenefitEntry[] = r.benefits.map(b => ({
            ...b, id: crypto.randomUUID(), taxYear: ty.key,
          }))
          return { ...ty, benefitsInKind: [...ty.benefitsInKind, ...entries] }
        })
      } else {
        const r = await extractP60(apiKey, base64, mediaType)
        setReviewFields([
          { label: 'Employer', value: r.employerName },
          { label: 'Total Pay', value: gbp(r.totalPay) },
          { label: 'Total Tax', value: gbp(r.totalTaxDeducted) },
          { label: 'Total NI', value: gbp(r.totalEmployeeNI) },
          { label: 'Tax Code', value: r.taxCode },
        ])
        // P60 is a year-end reconciliation — recorded as a single synthetic period-12 payslip
        setPendingApply(() => (ty: TaxYear): TaxYear => {
          const payslip: Payslip = {
            id: crypto.randomUUID(), taxPeriod: 12, taxYear: ty.key, date: ty.endDate,
            basicSalary: 0, carAllowance: 0, otherPayments: [], taxPaid: 0, employeeNI: 0,
            salarySacrifice: [], esppContribution: 0, employerMatch: 0,
            ytdGross: r.totalPay, ytdTaxPaid: r.totalTaxDeducted, ytdEmployeeNI: r.totalEmployeeNI,
            taxCode: r.taxCode, niNumber: '', employerName: r.employerName,
            rawExtracted: { p60: r.rawExtracted },
          }
          return withPayslip(ty, payslip)
        })
      }
      setState('review')
    } catch (e) {
      setErrorMsg(String(e)); setState('error')
    }
  }

  const confirm = async () => {
    if (!pendingApply) return
    setState('extracting')
    try {
      await saveTaxYear(pendingApply(taxYear))
      setState('idle'); setPendingApply(null); setReviewFields([])
    } catch (e) {
      setErrorMsg(String(e)); setState('error')
    }
  }

  // Build the document list from current tax year data
  const payslipCount = taxYear.employment.flatMap(e => e.payslips).filter(p => p.taxPeriod < 12).length
  const hasP60 = taxYear.employment.flatMap(e => e.payslips).some(p => p.taxPeriod === 12)
  const benefitCount = taxYear.benefitsInKind.length
  const docs: DocItem[] = [
    { name: 'Payslips', meta: payslipCount ? `${payslipCount} uploaded` : 'None yet', status: payslipCount ? 'green' : 'gray', kind: 'pdf' },
    { name: 'P11D (benefits)', meta: benefitCount ? `${benefitCount} benefits` : 'Not uploaded', status: benefitCount ? 'green' : 'gray', kind: 'pdf' },
    { name: 'P60 (year-end)', meta: hasP60 ? 'Recorded' : 'Not uploaded', status: hasP60 ? 'green' : 'gray', kind: 'pdf' },
  ]

  const typeLabels: Record<DocType, string> = { payslip: 'payslip', p11d: 'P11D', p60: 'P60' }

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6 pb-5 border-b border-white/[0.06]">
        <h1 className="font-serif text-[28px] tracking-[-0.03em]">Documents</h1>
        <TaxYearSelector />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Upload panel */}
        <div className="bg-surface border border-white/[0.06] rounded-[10px] p-5">
          {state === 'extracting' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-text-2 text-sm">Reading your {typeLabels[docType]}…</p>
            </div>
          )}
          {state === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red/10 border border-red/20">
                <AlertCircle size={16} className="text-red mt-0.5 flex-shrink-0" />
                <p className="text-sm">{errorMsg}</p>
              </div>
              <button onClick={() => setState('idle')} className="text-accent text-sm">Try again</button>
            </div>
          )}
          {state === 'review' && (
            <ExtractReview title={`${typeLabels[docType]} read — check the values`} fields={reviewFields} onConfirm={confirm} onCancel={() => { setState('idle'); setPendingApply(null) }} />
          )}
          {state === 'idle' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {(['payslip', 'p11d', 'p60'] as DocType[]).map(t => (
                  <button key={t} onClick={() => setDocType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${docType === t ? 'bg-accent text-bg' : 'bg-surface-2 text-text-2 hover:text-text-1'}`}>
                    {t === 'payslip' ? 'Payslip' : t === 'p11d' ? 'P11D' : 'P60'}
                  </button>
                ))}
              </div>
              <UploadZone
                label={`Upload a ${typeLabels[docType]}`}
                hint="PDF or photo — AI reads it for you"
                onFile={handleFile}
              />
            </div>
          )}
        </div>

        {/* Document list */}
        <div className="bg-surface border border-white/[0.06] rounded-[10px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="font-serif text-base">This tax year</h2>
          </div>
          <DocumentList items={docs} />
        </div>
      </div>

      {!hasP60 && payslipCount > 0 && (
        <div className="mt-6">
          <AlertStrip variant="accent">
            Upload your <strong>P60</strong> at year end to confirm your final figures, or your <strong>P11D</strong> if you have benefits like medical insurance.
          </AlertStrip>
        </div>
      )}
    </div>
  )
}
