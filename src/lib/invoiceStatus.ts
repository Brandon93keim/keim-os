export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "void"

type InvoiceLike = {
  status: string
  due_date: string
}

/**
 * Returns the effective display status. If the DB status is 'sent' and
 * due_date has passed, returns 'overdue'. Otherwise returns the DB status.
 */
export function getEffectiveStatus(invoice: InvoiceLike): InvoiceStatus {
  if (invoice.status === "sent") {
    const due = new Date(invoice.due_date)
    if (due < new Date()) return "overdue"
  }
  return invoice.status as InvoiceStatus
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:          "Draft",
  sent:           "Sent",
  partially_paid: "Partially Paid",
  paid:           "Paid",
  overdue:        "Overdue",
  cancelled:      "Cancelled",
  void:           "Void",
}

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft:          "#6B7280",
  sent:           "#2563EB",
  partially_paid: "#D97706",
  paid:           "#16A34A",
  overdue:        "#DC2626",
  cancelled:      "#6B7280",
  void:           "#6B7280",
}
