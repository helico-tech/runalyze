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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onSave(text)
      setSaved(true)
    }, 400)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [text, onSave])

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-ink-muted">Notes</h3>
        {saved && <span className="text-[10px] text-ok">saved</span>}
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
        placeholder="How did it feel? Conditions, RPE, anything worth remembering."
        className="h-32 w-full resize-y rounded border border-line bg-surface p-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
      />
    </div>
  )
}
