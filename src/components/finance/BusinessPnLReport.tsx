"use client"

import { useState } from "react"
import Link from "next/link"
import { startOfMonth, startOfYear, subDays, subYears, addDays, format } from "date-fns"
import { type DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { useBusinessPnL, type BusinessPnLRow } from "@/lib/hooks/useTransactions"
import { formatCurrency } from "@/lib/finance/format"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import { DateRangePicker } from "./DateRangePicker"

type RangeKey = "MTD" | "YTD" | "90d" | "12mo" | "Custom"

const CHIPS: RangeKey[] = ["MTD", "YTD", "90d", "12mo", "Custom"]

function toDateStr(d: Date) {
  return format(d, "yyyy-MM-dd")
}

function defaultCustomRange(): DateRange {
  const today = new Date()
  return { from: subDays(today, 29), to: today }
}

function resolveRange(key: RangeKey, customRange?: DateRange): { dateFrom: string; dateTo: string } {
  const today = new Date()
  const dateTo = toDateStr(today)
  switch (key) {
    case "MTD":
      return { dateFrom: toDateStr(startOfMonth(today)), dateTo }
    case "YTD":
      return { dateFrom: toDateStr(startOfYear(today)), dateTo }
    case "90d":
      return { dateFrom: toDateStr(subDays(today, 89)), dateTo }
    case "12mo":
      return { dateFrom: toDateStr(addDays(subYears(today, 1), 1)), dateTo }
    case "Custom": {
      const r = customRange ?? defaultCustomRange()
      return {
        dateFrom: toDateStr(r.from ?? subDays(today, 29)),
        dateTo: toDateStr(r.to ?? today),
      }
    }
  }
}

function SummaryBandSkeleton() {
  return (
    <div className="px-3 pt-3">
      <div className="rounded-xl bg-muted/60 px-4 py-4">
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
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="rounded-xl bg-muted/60 p-3 flex items-center gap-3">
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

function ChipRow({ selected, onSelect }: { selected: RangeKey; onSelect: (k: RangeKey) => void }) {
  return (
    <div className="px-4 py-3 flex gap-2">
      <div className="flex rounded-lg border border-border overflow-hidden flex-1">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSelect(chip)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium transition-colors",
              selected === chip
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            )}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

function SummaryBand({ income, expense, net, label }: { income: number; expense: number; net: number; label: string }) {
  return (
    <div className="px-3 pt-3">
      <div className="rounded-xl bg-muted/60 px-4 py-4">
        <div className="mb-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label} Net</p>
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
    </div>
  )
}

function PnLRow({ row, dateFrom, dateTo }: { row: BusinessPnLRow; dateFrom: string; dateTo: string }) {
  const bizParam = row.businessId ?? "personal"
  const href = `/money/transactions?business=${bizParam}&from=${dateFrom}&to=${dateTo}`
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-xl bg-muted/60 transition-colors active:bg-muted hover:bg-muted/80"
    >
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
    </Link>
  )
}

export function BusinessPnLReport() {
  const [range, setRange] = useState<RangeKey>("YTD")
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const { dateFrom, dateTo } = resolveRange(range, customRange)

  const { data, isLoading, error } = useBusinessPnL(dateFrom, dateTo)

  function handleRangeSelect(k: RangeKey) {
    setRange(k)
  }

  function handleCustomSelect(r: DateRange | undefined) {
    setCustomRange(r)
  }

  const pickerValue = range === "Custom" ? (customRange ?? defaultCustomRange()) : undefined

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Reports" backHref="/money" />

      {/* Chip row + inline date picker */}
      <div className="border-b border-border">
        <ChipRow selected={range} onSelect={handleRangeSelect} />
        {range === "Custom" && (
          <div className="pb-3">
            <DateRangePicker
              selected={pickerValue}
              onSelect={handleCustomSelect}
            />
          </div>
        )}
      </div>

      {/* Summary band */}
      {isLoading ? (
        <SummaryBandSkeleton />
      ) : data ? (
        <SummaryBand income={data.totals.income} expense={data.totals.expense} net={data.totals.net} label={range} />
      ) : null}

      {/* Error state */}
      {error && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Failed to load report.
        </div>
      )}

      {/* Rows */}
      <div className="flex-1 pb-6">
        <div className="px-3 space-y-2 mt-3">
          {isLoading ? (
            [...Array(9)].map((_, i) => <RowSkeleton key={i} />)
          ) : (
            data?.rows.map((row) => (
              <PnLRow key={row.businessId ?? "__personal__"} row={row} dateFrom={dateFrom} dateTo={dateTo} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
