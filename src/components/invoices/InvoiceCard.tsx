"use client"

import { useRouter } from "next/navigation"
import { format, isPast, parseISO } from "date-fns"
import { getBusinessById } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { InvoiceStatusBadge } from "./InvoiceStatusBadge"
import type { InvoiceSummary } from "@/lib/queries/invoices"

interface Props {
  invoice: InvoiceSummary
}

export function InvoiceCard({ invoice }: Props) {
  const router = useRouter()
  const biz = getBusinessById(invoice.business_id)
  const isOverdue = invoice.status === "sent" && isPast(parseISO(invoice.due_date))

  return (
    <button
      type="button"
      onClick={() => router.push(`/invoices/${invoice.id}`)}
      className={cn(
        "w-full rounded-xl border bg-card text-left p-4 active:bg-muted/50 transition-colors",
        isOverdue ? "border-red-200" : "border-border"
      )}
    >
      {/* Top row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-xs text-muted-foreground">
          {invoice.invoice_number ?? "—"}
        </span>
        {biz && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{ backgroundColor: biz.color, color: "#fff" }}
          >
            {biz.name}
          </span>
        )}
        <div className="ml-auto">
          <InvoiceStatusBadge status={isOverdue ? "overdue" : invoice.status} />
        </div>
      </div>

      {/* Client name */}
      <div className={cn("font-semibold text-base leading-snug", isOverdue && "text-red-700")}>
        {invoice.client?.name ?? "Unknown client"}
      </div>
      {invoice.client?.company && (
        <div className="text-xs text-muted-foreground mt-0.5">{invoice.client.company}</div>
      )}

      {/* Bottom row */}
      <div className="flex items-end justify-between mt-2 gap-2">
        <div className="text-xs text-muted-foreground">
          <span>{format(parseISO(invoice.issue_date), "MMM d, yyyy")}</span>
          <span className="mx-1">·</span>
          <span className={cn(isOverdue && "text-red-600 font-medium")}>
            due {format(parseISO(invoice.due_date), "MMM d")}
          </span>
        </div>
        <div className={cn("text-base font-bold tabular-nums", isOverdue && "text-red-700")}>
          ${invoice.total.toFixed(2)}
        </div>
      </div>
    </button>
  )
}
