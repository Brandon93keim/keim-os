"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIncomeReview } from "@/lib/hooks/useTransactions"
import { formatCurrency } from "@/lib/finance/format"
import { Skeleton } from "@/components/ui/skeleton"

type Axis = "combined" | "stream"

const CURRENT_YEAR = new Date().getFullYear()

function HeroSkeleton() {
  return (
    <div className="px-3 pt-3">
      <div className="rounded-xl bg-muted/60 px-4 py-4 text-center">
        <Skeleton className="h-3 w-12 mx-auto mb-1" />
        <Skeleton className="h-9 w-32 mx-auto" />
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="rounded-xl bg-muted/60 p-3 flex items-center justify-between">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

export function IncomeReview() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [allTime, setAllTime] = useState(false)
  const [axis, setAxis] = useState<Axis>("combined")

  const today = format(new Date(), "yyyy-MM-dd")

  const from = allTime ? "2024-01-01" : `${year}-01-01`
  const to = allTime ? today : year === CURRENT_YEAR ? today : `${year}-12-31`
  const granularity: "month" | "year" = allTime ? "year" : "month"

  const { data, isLoading, error } = useIncomeReview(from, to, granularity)

  return (
    <>
      {/* Year stepper + All-time chip */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          disabled={allTime}
          className="p-1 rounded-md hover:bg-muted/60 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="flex-1 text-center text-sm font-medium tabular-nums">
          {allTime ? "All time" : year}
        </span>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          disabled={allTime || year >= CURRENT_YEAR}
          className="p-1 rounded-md hover:bg-muted/60 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => setAllTime((v) => !v)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
            allTime
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          All-time
        </button>
      </div>

      {/* Axis toggle */}
      <div className="px-4 py-3 flex gap-2">
        <div className="flex rounded-lg border border-border overflow-hidden flex-1">
          {(["combined", "stream"] as Axis[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setAxis(opt)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium transition-colors",
                axis === opt
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted/50"
              )}
            >
              {opt === "combined" ? "Combined" : "By stream"}
            </button>
          ))}
        </div>
      </div>

      {/* Hero */}
      {isLoading ? (
        <HeroSkeleton />
      ) : data ? (
        <div className="px-3 pt-0">
          <div className="rounded-xl bg-muted/60 px-4 py-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Income</p>
            <p className="text-3xl font-bold tabular-nums">{formatCurrency(data.total)}</p>
          </div>
        </div>
      ) : null}

      {/* Error */}
      {error && (
        <div className="py-8 text-center text-sm text-muted-foreground">Failed to load.</div>
      )}

      {/* Rows */}
      <div className="flex-1 pb-6">
        <div className="px-3 space-y-2 mt-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => <RowSkeleton key={i} />)
          ) : !data || data.total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No income in this period.</p>
          ) : axis === "combined" ? (
            data.periods.map((period) => (
              <div
                key={period.key}
                className="flex items-center justify-between rounded-xl bg-muted/60 p-3"
              >
                <span className="text-sm font-medium">{period.label}</span>
                <span className="text-sm tabular-nums">{formatCurrency(period.total)}</span>
              </div>
            ))
          ) : (
            data.streams.map((stream) => {
              const bizParam = stream.businessId ?? "personal"
              const href = `/money/transactions?business=${bizParam}&from=${from}&to=${to}`
              return (
                <Link
                  key={stream.businessId ?? "__personal__"}
                  href={href}
                  className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 transition-colors active:bg-muted hover:bg-muted/80"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stream.color }}
                  />
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">{stream.businessName}</span>
                  <span className="text-sm tabular-nums">{formatCurrency(stream.income)}</span>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
