"use client"

import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useMarkInvoiceSent } from "@/lib/hooks/useInvoices"
import { InvoiceForm } from "./InvoiceForm"
import type { Invoice } from "@/lib/queries/invoices"
import type { UnbilledJob } from "@/lib/queries/jobs"

interface Props {
  open: boolean
  onClose: () => void
  invoice?: Invoice | null
  prefillJob?: UnbilledJob | null
}

export function InvoiceFormSheet({ open, onClose, invoice, prefillJob }: Props) {
  const router = useRouter()
  const markSent = useMarkInvoiceSent()

  const title = invoice
    ? `Edit ${invoice.invoice_number ?? "Invoice"}`
    : "New Invoice"

  function handleSuccess(invoiceId: string, shouldMarkSent?: boolean) {
    if (shouldMarkSent) {
      markSent.mutate(invoiceId, {
        onSuccess: () => {
          onClose()
          if (!invoice) router.push(`/invoices/${invoiceId}`)
        },
      })
    } else {
      onClose()
      if (!invoice) router.push(`/invoices/${invoiceId}`)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[95dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <InvoiceForm
          invoice={invoice}
          prefillJob={invoice ? null : prefillJob}
          onSuccess={handleSuccess}
          onCancel={onClose}
        />
      </SheetContent>
    </Sheet>
  )
}
