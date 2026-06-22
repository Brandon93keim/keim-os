"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, PiggyBank } from "lucide-react"
import { startOfMonth, subMonths, addMonths } from "date-fns"
import { cn } from "@/lib/utils"
import { useBudgets, type BudgetRow } from "@/lib/hooks/useBudgets"
import { formatCurrency } from "@/lib/finance/format"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/PageHeader"

function BudgetRowItem({ row }: { row: BudgetRow }) {
  const isOver = row.spent > row.limit
  const barPct = Math.min(row.pct, 1) * 100

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {row.color && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
          )}
          <p className="font-medium truncate">{row.name}</p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground shrink-0">
          {formatCurrency(row.spent)} of {formatCurrency(row.limit)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", isOver ? "bg-destructive" : "bg-primary")}
          style={{ width: `${barPct}%` }}
        />
      </div>

      <p
        className={cn(
          "mt-1.5 text-xs tabular-nums",
          isOver ? "text-destructive font-medium" : "text-muted-foreground"
        )}
      >
        {isOver
          ? `${formatCurrency(row.spent - row.limit)} over budget`
          : `${formatCurrency(row.remaining)} remaining`}
      </p>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
      <Skeleton className="mt-1.5 h-3 w-20" />
    </div>
  )
}

export function BudgetList() {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))
  const { data, isLoading, error } = useBudgets(monthDate)

  const rows = data?.rows ?? []
  const budgeted = data?.totals.budgeted ?? 0
  const spent = data?.totals.spent ?? 0

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Budgets" backHref="/money" />

      {/* Month navigator */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMonthDate((d) => subMonths(d, 1))}
          aria-label="Previous month"
          className="p-1 rounded-md hover:bg-muted/60 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="flex-1 text-center text-sm font-medium tabular-nums">
          {data?.monthLabel ?? <Skeleton className="h-4 w-24 mx-auto" />}
        </span>
        <button
          type="button"
          onClick={() => setMonthDate((d) => addMonths(d, 1))}
          aria-label="Next month"
          className="p-1 rounded-md hover:bg-muted/60 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Summary band */}
      <div className="bg-muted/40 border-b border-border px-4 py-4">
        {isLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          <p className="text-sm font-medium">
            {formatCurrency(spent)} of {formatCurrency(budgeted)} spent this month
          </p>
        )}
      </div>

      {error && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Failed to load budgets.
        </div>
      )}

      {/* Budget rows */}
      <div className="flex-1 pb-6">
        {isLoading ? (
          <div className="mt-4 divide-y divide-border border-y border-border">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-4 pt-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <PiggyBank size={28} className="text-muted-foreground" />
            </div>
            <p className="font-medium">No budgeted categories</p>
            <p className="text-sm text-muted-foreground">
              Set a monthly budget on a category to track spending here. Manage categories
              from settings.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {rows.map((row) => (
              <BudgetRowItem key={row.categoryId} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
