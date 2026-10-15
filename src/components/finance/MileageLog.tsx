"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { AlertTriangle, Download, Plus, RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { INVOICE_REMIT, getBusinessById } from "@/lib/constants"
import { formatCurrency } from "@/lib/finance/format"
import { mileageRateFor } from "@/lib/mileage/rates"
import {
  useMileageSettings,
  useSaveHomeAddress,
  useSyncTrips,
  useTrips,
  type MileageTrip,
  type SyncProgress,
} from "@/lib/hooks/useMileage"
import { MileageTripSheet } from "./MileageTripSheet"

function today() {
  return format(new Date(), "yyyy-MM-dd")
}

const fmtMiles = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function HomeSetup({ initial, onSaved }: { initial?: string; onSaved?: () => void }) {
  const save = useSaveHomeAddress()
  const [address, setAddress] = useState(initial ?? INVOICE_REMIT.address)
  return (
    <div className="rounded-xl bg-muted/60 p-4 space-y-3">
      <div>
        <p className="font-semibold">Where do your drives start?</p>
        <p className="text-sm text-muted-foreground">
          Every day&apos;s route starts and ends here. Use your home office address.
        </p>
      </div>
      <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      <Button className="w-full" disabled={!address.trim() || save.isPending} onClick={() => save.mutate(address, { onSuccess: onSaved })}>
        {save.isPending ? "Looking up address..." : "Save home address"}
      </Button>
    </div>
  )
}

function exportCsv(trips: MileageTrip[], year: number, rate: number) {
  const counted = trips.filter((t) => t.status !== "excluded").sort((a, b) => a.trip_date.localeCompare(b.trip_date))
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [
    ["Date", "Business", "Business purpose", "From", "Destination", "Returned home", "Miles", "Status"].join(","),
    ...counted.map((t) =>
      [
        t.trip_date,
        esc(getBusinessById(t.business_id ?? "")?.name ?? ""),
        esc(t.purpose),
        esc(t.from_label ?? "Home"),
        esc(t.destination),
        t.includes_return ? "yes" : "no",
        Number(t.miles).toFixed(1),
        t.status,
      ].join(",")
    ),
  ]
  const total = counted.filter((t) => t.status === "ok").reduce((s, t) => s + Number(t.miles), 0)
  lines.push("", `Total confirmed business miles,${total.toFixed(1)}`, `IRS rate ${year},${rate}`, `Deduction,${(total * rate).toFixed(2)}`)
  const blob = new Blob([lines.join("\n")], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `mileage-log-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function MileageLog() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const from = `${year}-01-01`
  const to = year === thisYear ? today() : `${year}-12-31`

  const { data: settings, isLoading: settingsLoading } = useMileageSettings()
  const { data: trips = [], isLoading: tripsLoading } = useTrips(from, to)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const sync = useSyncTrips(setProgress)
  const [sheetTrip, setSheetTrip] = useState<MileageTrip | undefined>(undefined)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingHome, setEditingHome] = useState(false)

  const { rate, official } = mileageRateFor(year)

  const stats = useMemo(() => {
    const ok = trips.filter((t) => t.status === "ok")
    const miles = ok.reduce((s, t) => s + Number(t.miles), 0)
    const reviewMiles = trips.filter((t) => t.status === "review").reduce((s, t) => s + Number(t.miles), 0)
    const byBiz = new Map<string, number>()
    for (const t of ok) byBiz.set(t.business_id ?? "", (byBiz.get(t.business_id ?? "") ?? 0) + Number(t.miles))
    return {
      miles,
      reviewMiles,
      reviewCount: trips.filter((t) => t.status === "review").length,
      byBiz: [...byBiz.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [trips])

  const byDay = useMemo(() => {
    const m = new Map<string, MileageTrip[]>()
    for (const t of trips) m.set(t.trip_date, [...(m.get(t.trip_date) ?? []), t])
    return [...m.entries()]
  }, [trips])

  const openTrip = (t?: MileageTrip) => {
    setSheetTrip(t)
    setSheetOpen(true)
  }

  const syncLabel = !sync.isPending
    ? "Sync from calendar"
    : progress?.phase === "addresses" && progress.total > 0
      ? `Finding addresses ${progress.done}/${progress.total}`
      : progress?.phase === "routes"
        ? `Mapping routes ${progress.done}/${progress.total}`
        : "Saving..."

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Mileage"
        backHref="/money"
        right={
          <div className="flex gap-1">
            {[thisYear - 1, thisYear].map((y) => (
              <Button key={y} size="sm" variant={y === year ? "default" : "ghost"} onClick={() => setYear(y)}>
                {y}
              </Button>
            ))}
          </div>
        }
      />

      <div className="px-3 pt-3 pb-24 space-y-3">
        {settingsLoading ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : !settings || editingHome ? (
          <HomeSetup initial={settings?.home_address} onSaved={() => setEditingHome(false)} />
        ) : (
          <>
            {/* Hero */}
            <div className="rounded-xl bg-muted/60 px-4 py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{year} deduction</p>
              {tripsLoading ? (
                <Skeleton className="h-9 w-40" />
              ) : (
                <p className="text-3xl font-bold tabular-nums">{formatCurrency(stats.miles * rate)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {fmtMiles(stats.miles)} business miles × ${rate.toFixed(3)}/mi
                {official ? " IRS rate" : " (last year's IRS rate, update when announced)"}
              </p>
              {stats.byBiz.length > 0 && (
                <div className="mt-3 space-y-1">
                  {stats.byBiz.map(([id, miles]) => {
                    const b = getBusinessById(id)
                    return (
                      <div key={id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b?.color ?? "#999" }} />
                          <span className="truncate">{b?.name ?? "Unassigned"}</span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">{fmtMiles(miles)} mi</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {stats.reviewCount > 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {stats.reviewCount} trip{stats.reviewCount === 1 ? "" : "s"} ({fmtMiles(stats.reviewMiles)} mi) need a look
                  before they count. Tap the flagged ones below.
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="secondary"
                className="col-span-3"
                disabled={sync.isPending}
                onClick={() => sync.mutate({ from, to })}
              >
                <RefreshCw size={16} className={cn(sync.isPending && "animate-spin")} />
                {syncLabel}
              </Button>
              <Button variant="outline" onClick={() => openTrip()}>
                <Plus size={16} /> Trip
              </Button>
              <Button variant="outline" disabled={!trips.length} onClick={() => exportCsv(trips, year, rate)}>
                <Download size={16} /> CSV
              </Button>
              <Button variant="outline" onClick={() => setEditingHome(true)}>
                Home
              </Button>
            </div>

            <p className="text-xs text-muted-foreground px-1">
              Sync reads job and meeting events that have a location and a business. Each day is routed
              Home → stops in calendar order → Home, so stacked jobs aren&apos;t counted as separate round trips.
            </p>

            {/* Trip list */}
            {tripsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : byDay.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No trips yet. Tap “Sync from calendar” to build {year}&apos;s log.
              </p>
            ) : (
              <div className="space-y-4">
                {byDay.map(([day, list]) => {
                  const dayMiles = list.filter((t) => t.status === "ok").reduce((s, t) => s + Number(t.miles), 0)
                  return (
                    <div key={day}>
                      <div className="flex items-baseline justify-between px-1 mb-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {format(parseISO(day), "EEE, MMM d")}
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">{fmtMiles(dayMiles)} mi</p>
                      </div>
                      <div className="space-y-1.5">
                        {list.map((t) => {
                          const b = getBusinessById(t.business_id ?? "")
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => openTrip(t)}
                              className={cn(
                                "w-full flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5 text-left transition-colors active:bg-muted hover:bg-muted/80",
                                t.status === "excluded" && "opacity-50",
                                t.status === "review" && "ring-1 ring-amber-500/60"
                              )}
                            >
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b?.color ?? "#999" }} />
                              <div className="min-w-0 flex-1">
                                <p className={cn("text-sm font-medium truncate", t.status === "excluded" && "line-through")}>
                                  {t.purpose}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {t.from_label ?? "Home"} → {t.destination}
                                  {t.includes_return ? " → Home" : ""}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold tabular-nums">{fmtMiles(Number(t.miles))}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {t.status === "review" ? "review" : t.status === "excluded" ? "excluded" : t.source === "manual" ? "manual" : t.miles_overridden ? "edited" : "mi"}
                                </p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
        {editingHome && settings && (
          <Button variant="ghost" className="w-full" onClick={() => setEditingHome(false)}>
            Cancel
          </Button>
        )}
      </div>

      <MileageTripSheet open={sheetOpen} onClose={() => setSheetOpen(false)} trip={sheetTrip} />
    </div>
  )
}

