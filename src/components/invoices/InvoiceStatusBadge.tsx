import { cn } from "@/lib/utils"

interface Props {
  status: string
  className?: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:          { label: "Draft",          className: "bg-muted text-muted-foreground border border-border" },
  sent:           { label: "Sent",           className: "bg-blue-50 text-blue-700 border border-blue-200" },
  partially_paid: { label: "Partial",        className: "bg-amber-50 text-amber-700 border border-amber-200" },
  paid:           { label: "Paid",           className: "bg-green-50 text-green-700 border border-green-200" },
  overdue:        { label: "Overdue",        className: "bg-red-50 text-red-700 border border-red-200" },
  cancelled:      { label: "Cancelled",      className: "bg-muted text-muted-foreground border border-border line-through" },
  void:           { label: "Void",           className: "bg-muted text-muted-foreground border border-border line-through" },
}

export function InvoiceStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground" }
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", config.className, className)}>
      {config.label}
    </span>
  )
}
