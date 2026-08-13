"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import {
  useIncomeReview,
  type IncomePeriod,
} from "@/lib/hooks/useTransactions"
import { formatCurrency } from "@/lib/finance/format"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALL_BUSINESSES = "all"

const CURRENT_YEAR = new Date().getFullYear()

// Axis ticks only — the tooltip carries the exact figure via formatCurrency.
const axisUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})

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

function ChartSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-[220px] w-full rounded-xl" />
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  )
}

function PeriodTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: IncomePeriod }[]
}) {
  if (!active || !payload?.length) return null
  const period = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{period.label}</p>
      <p className="text-sm font-semibold tabular-nums text-popover-foreground">
        {formatCurrency(period.total)}
      </p>
    </div>
  )
}

// One fill for the whole series: the bars are a single business (its own color)
// or every business summed (brand green), never a mix. Periods arrive pre-seeded
// (all 12 months, or every year in all-time mode), so months with no income sit
// flat on the baseline instead of dropping out of the axis.
function PeriodBarChart({ periods, fill }: { periods: IncomePeriod[]; fill: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={periods} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          interval={0}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          width={52}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => axisUsd.format(value)}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          content={<PeriodTooltip />}
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
        />
        <Bar
          dataKey="total"
          fill={fill}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function IncomeReview() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [allTime, setAllTime] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<string>(ALL_BUSINESSES)

  const today = format(new Date(), "yyyy-MM-dd")

  const from = allTime ? "2024-01-01" : `${year}-01-01`
  const to = allTime ? today : year === CURRENT_YEAR ? today : `${year}-12-31`
  const granularity: "month" | "year" = allTime ? "year" : "month"

  const { data, isLoading, error } = useIncomeReview(from, to, granularity)

  // A business stays selected across year changes even if it earned nothing that
  // year, so the empty chart reads as "no income here", not a silent reset.
  const series = data ? data.byBusiness[selectedBusiness] : undefined
  const periods = series ? series.periods : data?.periods
  const total = series ? series.total : data?.total
  const fill = series ? series.color : "var(--chart-income)"

  return (
    <>
      {/* Year stepper + All-time chip */}
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-2">
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

      {/* Hero — reflects the selected series, not always the grand total */}
      <div className="shrink-0">
        {isLoading ? (
          <HeroSkeleton />
        ) : data ? (
          <div className="px-3 pt-3">
            <div className="rounded-xl bg-muted/60 px-4 py-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                {series ? series.businessName : "Income"}
              </p>
              <p className="text-3xl font-bold tabular-nums">{formatCurrency(total ?? 0)}</p>
            </div>
          </div>
        ) : null}

        {/* Error */}
        {error && (
          <div className="py-8 text-center text-sm text-muted-foreground">Failed to load.</div>
        )}
      </div>

      {/* Chart + business selector */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-6">
        <div className="px-3 space-y-2 mt-3">
          {isLoading ? (
            <ChartSkeleton />
          ) : !data || !periods ? null : (
            <>
              {total === 0 ? (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No income in this period.</p>
                </div>
              ) : (
                <PeriodBarChart periods={periods} fill={fill} />
              )}
              <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BUSINESSES}>All Businesses</SelectItem>
                  {Object.values(data.byBusiness).map((biz) => (
                    <SelectItem key={biz.businessId} value={biz.businessId}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: biz.color }}
                        />
                        {biz.businessName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>
    </>
  )
}
