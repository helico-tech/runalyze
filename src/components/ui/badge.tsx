import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 h-[22px] text-[11.5px] font-semibold leading-none tracking-[0.01em]',
  {
    variants: {
      variant: {
        outline: 'border border-line text-fg-2',
        neutral: 'bg-fg-3/15 text-fg-2',
        accent: 'bg-accent-soft text-accent',
        ok: 'bg-ok/15 text-ok',
        caution: 'bg-caution/15 text-caution',
        danger: 'bg-danger/15 text-danger',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Show a leading status dot in the current color. Set `pulse` to animate it. */
  dot?: boolean
  pulse?: boolean
}

export function Badge({ className, variant, dot, pulse, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 flex-none rounded-full bg-current"
          style={pulse ? { animation: 'dotpulse 1.5s ease-in-out infinite' } : undefined}
        />
      )}
      {children}
    </span>
  )
}
