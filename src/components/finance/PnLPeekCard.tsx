"use client"

import { useRouter } from "next/navigation"
import { startOfYear, format } from "date-fns"
import { cn } from "@/lib/utils"
import { useBusinessPnL } from "@/lib/hooks/useTransactions"
import { formatCurrency } from "@/lib/finance/format"
import { Skeleton } from "@/components/ui/skeleton"

function ytdRange() {
  const today = new Date()
  return {
    dateFrom: format(startOfYear(today), "yyyy-MM-dd"),
    dateTo: format(today, "yyyy-MM-dd"),
  }
}

export function PnLPeekCard() {
  const router = useRouter()
  const { dateFrom, dateTo } = ytdRange()
  const { data, isLoading } = useBusinessPnL(dateFrom, dateTo)

  if (isLoading) {
    return (
      <div className="border-b border-border px-4 py-4 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-3 w-48" />
      </div>
    )
  }

  const net = data?.totals.net ?? 0
  const income = data?.totals.income ?? 0
  const expense = data?.totals.expense ?? 0

  return (
    <button
      type="button"
      onClick={() => router.push("/money/reports")}
      className="w-full border-b border-border px-4 py-4 text-left transition-colors active:bg-muted/60 hover:bg-muted/40"
    >
      <p className="text-xs text-muted-foreground mb-1">YTD P&L</p>
      <p className={cn("text-2xl font-bold tabular-nums mb-1", net < 0 ? "text-red-500" : "")}>
        {formatCurrency(net)}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatCurrency(income)} income · {formatCurrency(expense)} expense
      </p>
    </button>
  )
}
