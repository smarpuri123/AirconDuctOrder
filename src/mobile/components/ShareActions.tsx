import { Download, Mail, MessageCircle } from 'lucide-react'
import {
  generateDispatchPDF,
  generateEmailContent,
  generateWhatsAppMessage,
  shareEmail,
  shareWhatsApp,
} from '@/lib/share'
import type { Dispatch, Order } from '@/types'

interface ShareActionsProps {
  dispatch: Dispatch
  order: Order
  layout?: 'row' | 'grid'
}

export function ShareActions({ dispatch, order, layout = 'grid' }: ShareActionsProps) {
  const gridClass = layout === 'grid' ? 'grid grid-cols-2 gap-3' : 'flex flex-wrap gap-3'

  return (
    <div className={gridClass}>
      <button
        type="button"
        onClick={() => shareWhatsApp(generateWhatsAppMessage(dispatch, order))}
        className="flex items-center justify-center gap-2 min-h-14 px-4 rounded-xl bg-surface border-2 border-border font-semibold text-sm active:bg-background touch-manipulation"
      >
        <MessageCircle className="w-5 h-5 text-success" />
        WhatsApp
      </button>
      <button
        type="button"
        onClick={() => {
          const { subject, body } = generateEmailContent(dispatch, order)
          shareEmail(subject, body)
        }}
        className="flex items-center justify-center gap-2 min-h-14 px-4 rounded-xl bg-surface border-2 border-border font-semibold text-sm active:bg-background touch-manipulation"
      >
        <Mail className="w-5 h-5 text-primary" />
        Email
      </button>
      <button
        type="button"
        onClick={() => generateDispatchPDF(dispatch, order)}
        className="col-span-2 flex items-center justify-center gap-2 min-h-14 px-4 rounded-xl bg-primary text-white font-semibold text-sm active:opacity-90 touch-manipulation"
      >
        <Download className="w-5 h-5" />
        Download PDF
      </button>
    </div>
  )
}
