import { useRef, useState, type DragEvent } from 'react'
import { cn } from '@/lib/utils'

export function ImportDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState(false)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setActive(false)
    onFiles([...e.dataTransfer.files])
  }

  // The input is a SIBLING of the button: nesting it inside would be invalid
  // HTML and input.click() would bubble back into the button's onClick.
  return (
    <div className="h-full">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setActive(true)
        }}
        onDragLeave={() => setActive(false)}
        onDrop={handleDrop}
        className={cn(
          'flex h-full min-h-32 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-center transition-colors',
          active ? 'border-focus bg-surface-2' : 'hover:border-ink-muted hover:bg-surface',
        )}
      >
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">import</span>
        <span className="text-sm text-ink">Drop .fit or .zip files</span>
        <span className="text-xs text-ink-muted">or click to browse</span>
      </button>
      <input
        ref={inputRef}
        data-testid="file-input"
        type="file"
        accept=".fit,.zip"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
    </div>
  )
}
