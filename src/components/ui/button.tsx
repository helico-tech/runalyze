import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-sans font-semibold transition-[background-color,border-color,color,filter] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:brightness-110',
        default: 'bg-fg text-bg hover:bg-fg/90',
        outline: 'border border-line bg-panel-2 text-fg hover:bg-sunk',
        ghost: 'text-fg-2 hover:bg-sunk hover:text-fg',
      },
      size: {
        default: 'h-9 px-4 text-[13px]',
        sm: 'h-8 px-3 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
