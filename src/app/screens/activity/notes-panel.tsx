import { useEffect, useRef, useState } from 'react'

export function NotesPanel({
  initialText,
  onSave,
}: {
  initialText: string
  onSave: (text: string) => void
}) {
  const [text, setText] = useState(initialText)
  const [saved, setSaved] = useState(false)
  // Track the last-persisted value so we never save unchanged text — robust to
  // StrictMode's double-invoked mount effect (a "first run" flag is not).
  const lastSaved = useRef(initialText)

  useEffect(() => {
    if (text === lastSaved.current) return
    const timer = setTimeout(() => {
      onSave(text)
      lastSaved.current = text
      setSaved(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [text, onSave])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">Notes</h3>
        {saved && <span className="text-[10.5px] font-medium text-ok">saved</span>}
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
        placeholder="How did it feel? Conditions, RPE, anything worth remembering."
        className="h-32 w-full resize-y rounded-xl border border-line bg-panel p-3 text-sm text-fg placeholder:text-fg-3 focus:outline-none"
      />
    </div>
  )
}
