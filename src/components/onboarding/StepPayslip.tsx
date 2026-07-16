import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { extractPayslip } from '../../lib/claude'
import { storage } from '../../lib/storage'
import type { Payslip } from '../../types'

type ExtractedFields = Omit<Payslip, 'id' | 'taxPeriod' | 'taxYear' | 'rawExtracted'> & { rawExtracted: Record<string, string> }

interface Props {
  onExtracted: (fields: ExtractedFields) => void
  onSkip: () => void
}

type State = 'idle' | 'extracting' | 'review' | 'error'

export function StepPayslip({ onExtracted, onSkip }: Props) {
  const [state, setState] = useState<State>('idle')
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    const apiKey = storage.getClaudeKey()
    if (!apiKey) { setErrorMsg('Claude API key not found. Please go back to setup.'); setState('error'); return }

    const mediaType = file.type === 'application/pdf'
      ? 'application/pdf'
      : file.type === 'image/png' ? 'image/png'
      : file.type === 'image/webp' ? 'image/webp'
      : 'image/jpeg'

    setState('extracting')
    try {
      const buffer = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      const result = await extractPayslip(apiKey, base64, mediaType as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp')
      setExtracted(result)
      setState('review')
    } catch (e) {
      setErrorMsg(String(e))
      setState('error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleConfirm = () => {
    if (extracted) onExtracted(extracted)
  }

  if (state === 'extracting') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-text-2 text-sm">Reading your payslip...</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red/10 border border-red/20">
          <AlertCircle size={16} className="text-red mt-0.5 flex-shrink-0" />
          <p className="text-sm text-text-1">{errorMsg}</p>
        </div>
        <button onClick={() => setState('idle')} className="text-accent text-sm">Try again</button>
        <button onClick={onSkip} className="block text-text-2 text-sm">Skip for now</button>
      </div>
    )
  }

  if (state === 'review' && extracted) {
    const fields: { label: string; value: string }[] = [
      { label: 'Employer', value: extracted.employerName },
      { label: 'Basic Salary', value: `£${extracted.basicSalary.toFixed(2)}` },
      { label: 'Car Allowance', value: `£${extracted.carAllowance.toFixed(2)}` },
      { label: 'Tax Paid', value: `£${extracted.taxPaid.toFixed(2)}` },
      { label: 'Employee NI', value: `£${extracted.employeeNI.toFixed(2)}` },
      { label: 'ESPP Contribution', value: `£${extracted.esppContribution.toFixed(2)}` },
      { label: 'Employer Match', value: `£${extracted.employerMatch.toFixed(2)}` },
      { label: 'YTD Gross', value: `£${extracted.ytdGross.toFixed(2)}` },
      { label: 'Tax Code', value: extracted.taxCode },
      { label: 'NI Number', value: extracted.niNumber || '—' },
    ]

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green" />
          <p className="text-sm font-medium">Payslip read — check the values below</p>
        </div>
        <div className="bg-surface rounded-lg overflow-hidden border border-white/[0.06]">
          <div className="divide-y divide-white/[0.04]">
            {fields.map(f => (
              <div key={f.label} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-text-2">{f.label}</span>
                <span className="font-mono text-text-1">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            Looks right — continue
            <ChevronRight size={14} />
          </button>
          <button onClick={() => setState('idle')} className="px-4 border border-white/10 rounded-lg text-sm text-text-2 hover:text-text-1">
            Re-upload
          </button>
        </div>
      </div>
    )
  }

  // idle state
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg mb-1">Upload your most recent payslip</h3>
        <p className="text-text-2 text-sm">We'll read it automatically to pre-fill your profile. PDF or photo.</p>
      </div>
      <div
        className="border-2 border-dashed border-accent/30 rounded-xl p-8 text-center cursor-pointer hover:border-accent/60 hover:bg-accent/5 transition-all"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        <Upload size={24} className="mx-auto text-accent mb-3" />
        <p className="text-sm font-medium text-accent">Choose file or drag here</p>
        <p className="text-xs text-text-2 mt-1">PDF, JPG, PNG or WebP — max 10MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <button onClick={onSkip} className="w-full text-text-2 text-sm py-2 hover:text-text-1 transition-colors">
        Skip for now — I'll add a payslip later
      </button>
    </div>
  )
}
