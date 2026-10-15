"use client"

import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarClock, ExternalLink, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/finance/format"
import { useAccounts } from "@/lib/hooks/useAccounts"
import {
  useDeleteTaxPayment,
  useRecordTaxPayment,
  useTaxBase,
  useTaxPayments,
  useTaxSettings,
  useUpdateTaxSettings,
} from "@/lib/hooks/useTaxes"
import { hasOfficialYear, taxYear } from "@/lib/tax/constants"
import {
  estimateTax,
  federalRequiredAnnual,
  installmentPlan,
  yearFraction,
  type Installment,
} from "@/lib/tax/estimate"

const IRS_PAY = "https://www.irs.gov/payments/direct-pay"
const LA_PAY = "https://latap.revenue.louisiana.gov"

function todayStr() {
  return format(new Date(), "yyyy-MM-dd")
}
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-muted/60 px-4 py-4", className)}>{children}</div>
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 text-sm", muted && "text-muted-foreground", bold && "font-semibold")}>
      <span className="min-w-0">{label}</span>
      <span className="tabular-nums shrink-0">{value}</span>
    </div>
  )
}

const STATUS_LABEL: Record<Installment["status"], string> = {
  paid: "Paid",
  caught_up: "Paid late",
  late: "Missed",
  due: "Next",
  upcoming: "Upcoming",
}
const STATUS_CLASS: Record<Installment["status"], string> = {
  paid: "text-green-600 dark:text-green-400",
  caught_up: "text-green-600 dark:text-green-400",
  late: "text-red-600 dark:text-red-400",
  due: "text-amber-600 dark:text-amber-400 font-semibold",
  upcoming: "text-muted-foreground",
}

function Installments({ plan }: { plan: Installment[] }) {
  return (
    <div className="mt-2 divide-y divide-border/60">
      {plan.map((q) => (
        <div key={q.n} className="flex items-center justify-between py-1.5 text-sm">
          <span>
            Q{q.n} · {format(parseISO(q.due), "MMM d, yyyy")}
          </span>
          <span className="flex items-center gap-3">
            <span className="tabular-nums text-muted-foreground">{formatCurrency(q.cumulativeRequired)} total</span>
            <span className={cn("w-16 text-right text-xs", STATUS_CLASS[q.status])}>{STATUS_LABEL[q.status]}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  onCommit,
  hint,
  max,
}: {
  id: string
  label: string
  value: number | null
  onCommit: (v: number | null) => void
  hint?: string
  max?: number
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value))
  useEffect(() => setDraft(value == null ? "" : String(value)), [value])
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = draft === "" ? null : Math.max(0, Number(draft))
          if (n !== value && (n == null || Number.isFinite(n))) onCommit(n)
        }}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function PaymentSheet({
  open,
  onClose,
  year,
  defaults,
}: {
  open: boolean
  onClose: () => void
  year: number
  defaults: { jurisdiction: "federal" | "louisiana"; amount: number }
}) {
  const { data: accounts = [] } = useAccounts()
  const record = useRecordTaxPayment()
  const assetAccounts = accounts.filter((a) => a.kind === "asset" && a.is_active)
  const [jurisdiction, setJurisdiction] = useState(defaults.jurisdiction)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayStr())
  const [accountId, setAccountId] = useState("")
  useEffect(() => {
    if (!open) return
    setJurisdiction(defaults.jurisdiction)
    setAmount(defaults.amount > 0 ? String(Math.ceil(defaults.amount)) : "")
    setDate(todayStr())
  }, [open, defaults])
  useEffect(() => {
    if (!accountId && assetAccounts[0]) setAccountId(assetAccounts.find((a) => /operating/i.test(a.name))?.id ?? assetAccounts[0].id)
  }, [assetAccounts, accountId])
  const amt = Number(amount)
  const valid = amt > 0 && date && accountId
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[92dvh] rounded-t-2xl p-0 gap-0 flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>Log estimated payment</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["federal", "louisiana"] as const).map((j) => (
              <Button key={j} variant={jurisdiction === j ? "default" : "outline"} onClick={() => setJurisdiction(j)}>
                {j === "federal" ? "IRS" : "Louisiana"}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tp-amt">Amount</Label>
              <Input id="tp-amt" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp-date">Date paid</Label>
              <Input id="tp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Paid from</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                {assetAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Pay first at {jurisdiction === "federal" ? "IRS Direct Pay (reason: Estimated Tax, Form 1040-ES)" : "Louisiana Taxpayer Access Point"}, then log it here.
            It&apos;s recorded as money out of that account, kept off your business P&amp;L.
          </p>
        </div>
        <div className="border-t border-border px-4 py-3 flex gap-2" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!valid || record.isPending}
            onClick={async () => {
              await record.mutateAsync({ year, jurisdiction, paid_on: date, amount: amt, account_id: accountId })
              onClose()
            }}
          >
            Log payment
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function TaxPlanner() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const today = todayStr()
  const asOf = year === thisYear ? today : `${year}-12-31`
  const c = taxYear(year)

  const { data: settings, isLoading: sLoading } = useTaxSettings(year)
  const { data: base, isLoading: bLoading } = useTaxBase(year, asOf)
  const { data: payments = [] } = useTaxPayments(year)
  const updateSettings = useUpdateTaxSettings(year)
  const delPayment = useDeleteTaxPayment()
  const [basis, setBasis] = useState<"projected" | "ytd">("projected")
  const [paySheet, setPaySheet] = useState<{ jurisdiction: "federal" | "louisiana"; amount: number } | null>(null)

  const calc = useMemo(() => {
    if (!settings || !base) return null
    const frac = year === thisYear ? yearFraction(year, today) : 1
    const projectedProfit = base.netProfit / frac
    const profit = basis === "projected" ? projectedProfit : base.netProfit
    const interest = basis === "projected" ? base.interestIncome / frac : base.interestIncome
    const inputs = {
      year,
      filingStatus: settings.filing_status,
      otherOrdinaryIncome: interest,
      solo401kDeferral: Number(settings.solo401k_deferral),
      solo401kEmployer: Number(settings.solo401k_employer),
    }
    const est = estimateTax({ ...inputs, netProfit: profit })
    const noRetirement = estimateTax({ ...inputs, netProfit: profit, solo401kDeferral: 0, solo401kEmployer: 0 })
    // Required estimates are always based on the projected full year.
    const projected = estimateTax({ ...inputs, netProfit: projectedProfit, otherOrdinaryIncome: base.interestIncome / frac })
    const fedReq = federalRequiredAnnual({
      projectedFederalTotal: projected.federalTotal,
      priorYearTax: settings.prior_year_federal_tax != null ? Number(settings.prior_year_federal_tax) : null,
      priorYearAgiOver150k: settings.prior_year_agi_over_150k,
    })
    const laRequired = projected.laTax > c.la.estimateThreshold[settings.filing_status] ? projected.laTax * 0.9 : 0
    const fedPayments = payments.filter((p) => p.jurisdiction === "federal").map((p) => ({ paid_on: p.paid_on, amount: Number(p.amount) }))
    const laPayments = payments.filter((p) => p.jurisdiction === "louisiana").map((p) => ({ paid_on: p.paid_on, amount: Number(p.amount) }))
    const fedPlan = installmentPlan({ requiredAnnual: fedReq.required, dueDates: c.dueDates, payments: fedPayments, today })
    const laPlan = installmentPlan({ requiredAnnual: laRequired, dueDates: c.dueDates, payments: laPayments, today })
    const fedPaid = fedPayments.reduce((s, p) => s + p.amount, 0)
    const laPaid = laPayments.reduce((s, p) => s + p.amount, 0)
    const nextIdx = c.dueDates.findIndex((d) => d >= today)
    const nextDue = nextIdx >= 0 ? c.dueDates[nextIdx] : null
    const fedNow = nextIdx >= 0 ? fedPlan[nextIdx].shortfall : 0
    const laNow = nextIdx >= 0 ? laPlan[nextIdx].shortfall : 0
    return {
      frac,
      projectedProfit,
      profit,
      est,
      projected,
      noRetirement,
      fedReq,
      laRequired,
      fedPlan,
      laPlan,
      fedPaid,
      laPaid,
      nextDue,
      fedNow,
      laNow,
      aprilBalance: Math.max(0, projected.totalTax - Math.max(fedPaid, fedReq.required) - Math.max(laPaid, laRequired)),
      setAside: Math.ceil(projected.effectiveRate * 100),
    }
  }, [settings, base, payments, basis, year, thisYear, today, c])

  const loading = sLoading || bLoading || !calc || !settings || !base

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Taxes"
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
        {!hasOfficialYear(year) && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {year} brackets aren&apos;t loaded yet, so this uses the latest year&apos;s figures.
          </p>
        )}

        {loading ? (
          <>
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </>
        ) : (
          <>
            {/* Next payment */}
            {calc.nextDue && (calc.fedNow > 0 || calc.laNow > 0) && (
              <Card className="bg-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock size={16} />
                  <p className="text-xs uppercase tracking-wider font-semibold">
                    Pay by {format(parseISO(calc.nextDue), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="space-y-2">
                  {calc.fedNow > 0 && (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-2xl font-bold tabular-nums">{formatCurrency(Math.ceil(calc.fedNow))}</p>
                        <p className="text-xs text-muted-foreground">
                          IRS
                          {calc.fedPlan.some((q) => q.status === "late") ? " · includes missed earlier quarters" : ""}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" asChild>
                          <a href={IRS_PAY} target="_blank" rel="noreferrer">
                            Pay <ExternalLink size={12} />
                          </a>
                        </Button>
                        <Button size="sm" onClick={() => setPaySheet({ jurisdiction: "federal", amount: calc.fedNow })}>
                          Log
                        </Button>
                      </div>
                    </div>
                  )}
                  {calc.laNow > 0 && (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-2xl font-bold tabular-nums">{formatCurrency(Math.ceil(calc.laNow))}</p>
                        <p className="text-xs text-muted-foreground">Louisiana</p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" asChild>
                          <a href={LA_PAY} target="_blank" rel="noreferrer">
                            Pay <ExternalLink size={12} />
                          </a>
                        </Button>
                        <Button size="sm" onClick={() => setPaySheet({ jurisdiction: "louisiana", amount: calc.laNow })}>
                          Log
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Projected tax */}
            <Card>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {basis === "projected" ? `Projected ${year} tax` : `Tax on profit so far`}
                </p>
                <div className="flex rounded-md bg-background p-0.5 text-xs">
                  {(["projected", "ytd"] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBasis(b)}
                      className={cn("rounded px-2 py-0.5", basis === b ? "bg-muted font-semibold" : "text-muted-foreground")}
                    >
                      {b === "projected" ? "Full year" : "So far"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums">{formatCurrency(calc.est.totalTax)}</p>
              <p className="text-xs text-muted-foreground mb-3">
                on {formatCurrency(calc.profit)} profit · {pct(calc.est.effectiveRate)} effective ·{" "}
                {Math.round(calc.est.marginalFederalRate * 100)}% federal bracket
              </p>
              <div className="space-y-1">
                <Row label="Self-employment tax (Social Security + Medicare)" value={formatCurrency(calc.est.seTax)} />
                <Row label="Federal income tax" value={formatCurrency(calc.est.federalIncomeTax)} />
                <Row label="Louisiana (3%)" value={formatCurrency(calc.est.laTax)} />
              </div>
              <div className="mt-3 rounded-lg bg-background px-3 py-2 text-sm">
                Set aside <span className="font-semibold">{calc.setAside}%</span> of every payment you receive to cover this.
              </div>
            </Card>

            {/* Quarterly plan */}
            <Card>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">IRS estimated payments</p>
              <p className="text-sm mt-1">
                Required for {year}: <span className="font-semibold">{formatCurrency(calc.fedReq.required)}</span>
                <span className="text-muted-foreground">
                  {calc.fedReq.basis === "prior-year"
                    ? ` (100%${settings.prior_year_agi_over_150k ? "+10%" : ""} of last year's tax, the penalty-proof minimum)`
                    : " (90% of this year's projected tax)"}
                </span>
              </p>
              <Installments plan={calc.fedPlan} />
              {calc.laRequired > 0 && (
                <>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-4">Louisiana estimated payments</p>
                  <p className="text-sm mt-1">
                    Target {formatCurrency(calc.laRequired)}
                    <span className="text-muted-foreground"> (90% of projected LA tax; required once it tops $1,000)</span>
                  </p>
                  <Installments plan={calc.laPlan} />
                </>
              )}
              <div className="mt-3 rounded-lg bg-background px-3 py-2 text-sm">
                Expect about <span className="font-semibold">{formatCurrency(calc.aprilBalance)}</span> more due with your return in April
                {year + 1}, after the minimum estimates above. Paying more each quarter shrinks it.
              </div>
            </Card>

            {/* Retirement */}
            <Card>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Retirement</p>
              <Row label="Roth IRA contributed this year" value={`${formatCurrency(base.rothContributed)} of ${formatCurrency(c.iraLimit)}`} />
              <div className="mt-1 h-1.5 rounded-full bg-background overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (base.rothContributed / c.iraLimit) * 100)}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {year} contributions are allowed until April 15, {year + 1}. Roth money grows tax-free but doesn&apos;t lower this year&apos;s tax.
                {calc.est.agi > c.rothPhaseOut[settings.filing_status][0] ? " Your income is in the Roth phase-out range; check the limit." : ""}
              </p>

              <p className="text-sm font-semibold mt-4">Solo 401(k) for {year}</p>
              <p className="text-[11px] text-muted-foreground mb-2">
                A sole proprietor can open the plan as late as April 15, {year + 1} and still contribute for {year} (SECURE 2.0). Unlike Roth,
                these lower your income tax.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  id="k-def"
                  label="Employee deferral"
                  value={Number(settings.solo401k_deferral)}
                  max={c.k401DeferralLimit}
                  hint={`Up to ${formatCurrency(c.k401DeferralLimit)}`}
                  onCommit={(v) => updateSettings.mutate({ solo401k_deferral: v ?? 0 })}
                />
                <NumberField
                  id="k-emp"
                  label="Employer contribution"
                  value={Number(settings.solo401k_employer)}
                  hint={`Up to ~${formatCurrency(calc.projected.maxEmployerContribution)}`}
                  onCommit={(v) => updateSettings.mutate({ solo401k_employer: v ?? 0 })}
                />
              </div>
              {calc.est.retirementDeduction > 0 && (
                <p className="text-sm mt-2">
                  Saves about{" "}
                  <span className="font-semibold">{formatCurrency(calc.noRetirement.totalTax - calc.est.totalTax)}</span> in{" "}
                  {year} tax.
                </p>
              )}
            </Card>

            {/* Profit build-up */}
            <Card>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Business profit so far ({format(parseISO(base.to), "MMM d")})
              </p>
              <div className="space-y-1">
                {base.businesses.map((b) => (
                  <Row key={b.businessId} label={b.name} value={formatCurrency(b.net)} />
                ))}
                <div className="border-t border-border my-1" />
                <Row label="Income" value={formatCurrency(base.grossIncome)} muted />
                <Row label="Expenses" value={`−${formatCurrency(base.expenses)}`} muted />
                {base.fuelAddedBack > 0 && (
                  <Row label="Business gas (covered by mileage rate)" value={`+${formatCurrency(base.fuelAddedBack)}`} muted />
                )}
                <Row
                  label={`Mileage: ${base.businessMiles.toLocaleString("en-US", { maximumFractionDigits: 0 })} mi × $${base.mileageRate}`}
                  value={`−${formatCurrency(base.mileageDeduction)}`}
                  muted
                />
                <Row label="Schedule C profit" value={formatCurrency(base.netProfit)} bold />
                {basis === "projected" && year === thisYear && (
                  <Row label={`Projected full year (${pct(calc.frac)} of year elapsed)`} value={formatCurrency(calc.projectedProfit)} muted />
                )}
              </div>
              {base.milesNeedingReview > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                  {Math.round(base.milesNeedingReview)} miles are waiting for review in Mileage and aren&apos;t counted yet.
                </p>
              )}
              {base.golfNet !== 0 && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Golf ({formatCurrency(base.golfNet)}) is left out; it only counts as a business if it&apos;s run for profit.
                </p>
              )}
            </Card>

            {/* Settings */}
            <Card>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Your {year} settings</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(["single", "mfj"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={settings.filing_status === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateSettings.mutate({ filing_status: s })}
                    >
                      {s === "single" ? "Single" : "Married, joint"}
                    </Button>
                  ))}
                </div>
                <NumberField
                  id="prior-tax"
                  label={`Total tax on your ${year - 1} return`}
                  value={settings.prior_year_federal_tax != null ? Number(settings.prior_year_federal_tax) : null}
                  hint="Form 1040, “total tax” line. Sets the penalty-proof minimum."
                  onCommit={(v) => updateSettings.mutate({ prior_year_federal_tax: v })}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.prior_year_agi_over_150k}
                    onChange={(e) => updateSettings.mutate({ prior_year_agi_over_150k: e.target.checked })}
                  />
                  Last year&apos;s AGI was over $150,000
                </label>
              </div>
            </Card>

            {/* Payment log */}
            <Card>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Payments logged</p>
                <Button size="sm" variant="outline" onClick={() => setPaySheet({ jurisdiction: "federal", amount: calc.fedNow })}>
                  Log payment
                </Button>
              </div>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No estimated payments yet for {year}.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                      <span>
                        {format(parseISO(p.paid_on), "MMM d")} · {p.jurisdiction === "federal" ? "IRS" : "Louisiana"}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{formatCurrency(Number(p.amount))}</span>
                        <button
                          type="button"
                          aria-label="Remove payment"
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => {
                            if (confirm("Remove this payment and its transaction?")) delPayment.mutate(p)
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <p className="px-1 text-[11px] text-muted-foreground">
              Planning estimate: standard deduction, 20% QBI deduction, and half of SE tax; no credits or other income besides interest.
              Louisiana uses the 2025 $12,500 standard deduction (it&apos;s CPI-indexed for {year}, so LA is slightly overstated). Confirm
              with your preparer before filing.
            </p>
          </>
        )}
      </div>

      {paySheet && <PaymentSheet open onClose={() => setPaySheet(null)} year={year} defaults={paySheet} />}
    </div>
  )
}
