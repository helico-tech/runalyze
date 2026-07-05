import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (armed) {
          onConfirm()
          setArmed(false)
        } else {
          setArmed(true)
        }
      }}
      className={cn(
        'rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        armed ? 'border-danger/60 text-danger' : 'border-line text-ink-muted hover:text-ink',
        className,
      )}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
