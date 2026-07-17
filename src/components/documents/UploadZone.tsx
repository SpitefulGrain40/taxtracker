import { useRef } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  label: string
  hint?: string
  onFile: (file: File) => void
}

export function UploadZone({ label, hint, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }
  return (
    <>
      <div
        className="border-2 border-dashed border-accent/30 rounded-xl p-6 text-center cursor-pointer hover:border-accent/60 hover:bg-accent/5 transition-all"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        <Upload size={20} className="mx-auto text-accent mb-2" />
        <p className="text-sm font-medium text-accent">{label}</p>
        {hint && <p className="text-xs text-text-2 mt-1">{hint}</p>}
      </div>
      <input ref={inputRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </>
  )
}
