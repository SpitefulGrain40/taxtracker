import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

export function FirstPayslipPrompt() {
  return (
    <div className="flex flex-col items-center text-center py-16 gap-4">
      <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center">
        <FileText size={22} className="text-accent" />
      </div>
      <div>
        <h2 className="font-serif text-xl mb-1">Add your first payslip</h2>
        <p className="text-text-2 text-sm max-w-xs">Upload a payslip and we'll read your figures automatically. Until then there's nothing to show — no guessed numbers.</p>
      </div>
      <Link to="/documents" className="bg-accent text-bg font-semibold px-4 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity">Upload a payslip</Link>
    </div>
  )
}
