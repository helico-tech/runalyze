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
        'rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
        armed
          ? 'border-danger/50 bg-danger/10 text-danger'
          : 'border-line text-fg-3 hover:border-line-2 hover:text-fg-2',
        className,
      )}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
