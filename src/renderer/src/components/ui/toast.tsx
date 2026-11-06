import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

function ToastProvider({ ...props }: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider {...props} />
}

function ToastViewport({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        'fixed top-12 right-3 z-[60] flex w-80 max-w-[calc(100%-1.5rem)] flex-col gap-2 outline-none',
        className
      )}
      {...props}
    />
  )
}

const toastVariants = cva(
  'pointer-events-auto relative flex w-full items-start gap-2.5 rounded-lg border bg-background p-3 pr-9 shadow-lg',
  {
    variants: {
      level: {
        info: 'border-border',
        success: 'border-emerald-500/50',
        error: 'border-destructive/60'
      }
    },
    defaultVariants: {
      level: 'info'
    }
  }
)

function Toast({
  className,
  level,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>) {
  return <ToastPrimitive.Root data-slot="toast" className={cn(toastVariants({ level }), className)} {...props} />
}

function ToastTitle({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return <ToastPrimitive.Title data-slot="toast-title" className={cn('text-sm font-medium', className)} {...props} />
}

function ToastDescription({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn('text-xs break-words text-muted-foreground', className)}
      {...props}
    />
  )
}

function ToastClose({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      className={cn(
        'absolute top-2 right-2 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className
      )}
      {...props}
    >
      <X className="size-3.5" />
    </ToastPrimitive.Close>
  )
}

export { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport }
