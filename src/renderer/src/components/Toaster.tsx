import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from '@/components/ui/toast'
import { useToasts } from '@/hooks/useToast'
import { dismissToast } from '@/lib/toast-store'
import type { NotificationLevel } from '@shared/notification'

const ICONS = { info: Info, success: CheckCircle2, error: AlertCircle }
const ICON_COLORS: Record<NotificationLevel, string> = {
  info: 'text-muted-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-destructive'
}

export function Toaster() {
  const { t } = useTranslation()
  const toasts = useToasts()

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((item) => {
        const level = item.level ?? 'info'
        const Icon = ICONS[level]
        return (
          <Toast
            key={item.id}
            level={level}
            duration={item.duration}
            onOpenChange={(open) => {
              if (!open) dismissToast(item.id)
            }}
          >
            <Icon className={`mt-0.5 size-4 shrink-0 ${ICON_COLORS[level]}`} aria-hidden />
            <div className="grid min-w-0 gap-0.5">
              <ToastTitle>{item.title}</ToastTitle>
              {item.description ? <ToastDescription>{item.description}</ToastDescription> : null}
            </div>
            <ToastClose aria-label={t('notify.close')} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
