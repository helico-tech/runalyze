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
          'flex h-full min-h-36 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-center transition-colors',
          active
            ? 'border-accent bg-accent-soft'
            : 'border-line-2 hover:border-fg-3 hover:bg-panel',
        )}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">
          Import
        </span>
        <span className="text-[15px] font-medium text-fg">Drop .fit or .zip files</span>
        <span className="text-xs text-fg-3">or click to browse</span>
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
