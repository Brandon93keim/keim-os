"use client"

import { cn } from "@/lib/utils"
import { useBusinessPnL, type BusinessPnLRow } from "@/lib/hooks/useTransactions"
import { formatCurrency } from "@/lib/finance/format"
import { Skeleton } from "@/components/ui/skeleton"

function SummaryBandSkeleton() {
  return (
    <div className="bg-muted/40 border-b border-border px-4 py-4">
      <div className="mb-3 text-center">
        <Skeleton className="h-3 w-8 mx-auto mb-1" />
        <Skeleton className="h-9 w-32 mx-auto" />
      </div>
      <div className="flex justify-around">
        <div className="text-center space-y-1">
          <Skeleton className="h-3 w-12 mx-auto" />
          <Skeleton className="h-5 w-20 mx-auto" />
        </div>
        <div className="w-px bg-border" />
        <div className="text-center space-y-1">
          <Skeleton className="h-3 w-12 mx-auto" />
          <Skeleton className="h-5 w-20 mx-auto" />
        </div>
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  )
}

function SummaryBand({ income, expense, net }: { income: number; expense: number; net: number }) {
  return (
    <div className="bg-muted/40 border-b border-border px-4 py-4">
      <div className="mb-3 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">YTD Net</p>
        <p className={cn("text-3xl font-bold tabular-nums", net < 0 ? "text-red-500" : "")}>
          {formatCurrency(net)}
        </p>
      </div>
      <div className="flex justify-around">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Income</p>
          <p className="text-base font-semibold tabular-nums">{formatCurrency(income)}</p>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Expenses</p>
          <p className="text-base font-semibold tabular-nums text-red-500/80 dark:text-red-400/80">
            {formatCurrency(expense)}
          </p>
        </div>
      </div>
    </div>
  )
}

function PnLRow({ row }: { row: BusinessPnLRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: row.color }}
      />
      <p className="flex-1 min-w-0 text-sm font-medium truncate">{row.businessName}</p>
      <div className="flex gap-3 shrink-0">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">In</p>
          <p className="text-xs tabular-nums">{formatCurrency(row.income)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Out</p>
          <p className="text-xs tabular-nums">{formatCurrency(row.expense)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className={cn("text-xs font-medium tabular-nums", row.net < 0 ? "text-red-500" : "")}>
            {formatCurrency(row.net)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function BusinessPnLReport() {
  const today = new Date().toISOString().split("T")[0]
  const dateFrom = `${today.slice(0, 4)}-01-01`
  const dateTo = today

  const { data, isLoading, error } = useBusinessPnL(dateFrom, dateTo)

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold">Reports</h1>
      </div>

      {/* Summary band */}
      {isLoading ? (
        <SummaryBandSkeleton />
      ) : data ? (
        <SummaryBand income={data.totals.income} expense={data.totals.expense} net={data.totals.net} />
      ) : null}

      {/* Error state */}
      {error && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Failed to load report.
        </div>
      )}

      {/* Rows */}
      <div className="flex-1 pb-6">
        <div className="divide-y divide-border border-b border-border mt-4">
          {isLoading ? (
            [...Array(9)].map((_, i) => <RowSkeleton key={i} />)
          ) : (
            data?.rows.map((row) => (
              <PnLRow key={row.businessId ?? "__personal__"} row={row} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
