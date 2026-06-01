"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllocationRules } from "@/lib/hooks/useAllocationRules"
import { useDistribution, useCreateDistribution, useUndoDistribution } from "@/lib/hooks/useDistribution"
import { formatCurrency } from "@/lib/finance/format"
import type { TransactionWithRelations, AllocationRuleWithAccount } from "@/lib/finance/types"
import type { DistributionLine } from "@/lib/queries/finance"

type LineState = DistributionLine & {
  destination_name: string
  amountStr: string
}

// Integer-cent rounding: each rule gets Math.round(incomeCents * pct / 100) cents,
// and the last rule absorbs any remainder so lines sum exactly to totalCents.
function computeLines(
  incomeAmount: number,
  rules: AllocationRuleWithAccount[]
): LineState[] {
  if (!rules.length) return []

  const incomeCents = Math.round(incomeAmount * 100)
  const totalPct = rules.reduce((s, r) => s + Number(r.percentage), 0)
  const totalCents = Math.round((incomeCents * totalPct) / 100)

  const lines: LineState[] = []
  let sumCents = 0

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]
    const isLast = i === rules.length - 1
    const cents = isLast
      ? totalCents - sumCents
      : Math.round((incomeCents * Number(rule.percentage)) / 100)
    const amount = cents / 100

    lines.push({
      label: rule.label,
      destination_account_id: rule.destination_account_id,
      destination_name: rule.destination_account?.name ?? "Unknown",
      amount,
      amountStr: amount.toFixed(2),
    })

    sumCents += cents
  }

  return lines
}

interface Props {
  open: boolean
  onClose: () => void
  income: TransactionWithRelations
}

export function DistributeDialog({ open, onClose, income }: Props) {
  const { data: rules = [], isLoading: rulesLoading } = useAllocationRules()
  const { data: existing = [], isLoading: distLoading } = useDistribution(income.id)
  const createDist = useCreateDistribution()
  const undoDist = useUndoDistribution()

  const [lines, setLines] = useState<LineState[]>([])
  const [initialized, setInitialized] = useState(false)

  // Reset when the income changes (dialog reused for a different transaction)
  useEffect(() => {
    setInitialized(false)
    setLines([])
  }, [income.id])

  // Initialize editable lines once rules are available
  useEffect(() => {
    if (initialized || !rules.length) return
    setLines(computeLines(Number(income.amount), rules))
    setInitialized(true)
  }, [initialized, rules, income.amount])

  const isLoading = rulesLoading || distLoading
  const isDistributed = !distLoading && existing.length > 0

  const incomeAmount = Number(income.amount)
  const totalDistributed = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100
  const remainder = Math.round((incomeAmount - totalDistributed) * 100) / 100

  function updateAmount(index: number, raw: string) {
    const parsed = parseFloat(raw)
    const amount = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, amount, amountStr: raw } : l))
    )
  }

  function blurAmount(index: number) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, amountStr: l.amount.toFixed(2) } : l
      )
    )
  }

  async function handleDistribute() {
    await createDist.mutateAsync({
      income: {
        id: income.id,
        account_id: income.account_id,
        occurred_on: income.occurred_on,
      },
      lines: lines.map((l) => ({
        label: l.label,
        destination_account_id: l.destination_account_id,
        amount: l.amount,
      })),
    })
    onClose()
  }

  async function handleUndo() {
    await undoDist.mutateAsync(income.id)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>Distribute Funds</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <LoadingView />
        ) : isDistributed ? (
          <AlreadyDistributedView
            income={income}
            existing={existing}
            onUndo={handleUndo}
            onClose={onClose}
            isUndoing={undoDist.isPending}
          />
        ) : rules.length === 0 ? (
          <NoRulesView onClose={onClose} />
        ) : (
          <DistributeFormView
            income={income}
            lines={lines}
            remainder={remainder}
            totalDistributed={totalDistributed}
            onUpdateAmount={updateAmount}
            onBlurAmount={blurAmount}
            onDistribute={handleDistribute}
            onCancel={onClose}
            isDistributing={createDist.isPending}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function LoadingView() {
  return (
    <div className="flex-1 px-4 py-6 space-y-5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  )
}

function NoRulesView({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-3">
        <p className="text-base font-medium">No allocation rules</p>
        <p className="text-sm text-muted-foreground">
          Set up rules in Money settings to distribute income automatically.
        </p>
      </div>
      <div className="shrink-0 border-t border-border px-4 py-4">
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  )
}

function DistributeFormView({
  income,
  lines,
  remainder,
  totalDistributed,
  onUpdateAmount,
  onBlurAmount,
  onDistribute,
  onCancel,
  isDistributing,
}: {
  income: TransactionWithRelations
  lines: LineState[]
  remainder: number
  totalDistributed: number
  onUpdateAmount: (index: number, raw: string) => void
  onBlurAmount: (index: number) => void
  onDistribute: () => void
  onCancel: () => void
  isDistributing: boolean
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Income summary */}
        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <p className="text-xs text-muted-foreground mb-0.5 truncate">{income.description}</p>
          <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(Number(income.amount))}
          </p>
        </div>

        {/* Allocation lines */}
        <div className="divide-y divide-border">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{line.label}</p>
                <p className="text-xs text-muted-foreground truncate">{line.destination_name}</p>
              </div>
              <div className="relative w-28 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="pl-7 text-right"
                  value={line.amountStr}
                  onChange={(e) => onUpdateAmount(i, e.target.value)}
                  onBlur={() => onBlurAmount(i)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="px-4 py-4 border-t border-border space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total distributed</span>
            <span className="font-medium tabular-nums">{formatCurrency(totalDistributed)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Remains in {income.account?.name ?? "source"}
            </span>
            <span
              className={cn(
                "font-medium tabular-nums",
                remainder < 0 ? "text-destructive" : ""
              )}
            >
              {remainder < 0 ? `−${formatCurrency(Math.abs(remainder))} (over)` : formatCurrency(remainder)}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 py-4 flex gap-3"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isDistributing}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={onDistribute}
          disabled={isDistributing || lines.length === 0}
        >
          {isDistributing ? "Distributing…" : "Distribute"}
        </Button>
      </div>
    </>
  )
}

function AlreadyDistributedView({
  income,
  existing,
  onUndo,
  onClose,
  isUndoing,
}: {
  income: TransactionWithRelations
  existing: TransactionWithRelations[]
  onUndo: () => void
  onClose: () => void
  isUndoing: boolean
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Status banner */}
        <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Already distributed
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
            {existing.length} transfer{existing.length !== 1 ? "s" : ""} created from this income
          </p>
        </div>

        {/* Existing transfers */}
        <div className="divide-y divide-border">
          {existing.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{tx.description}</p>
                {tx.transfer_to_account && (
                  <p className="text-xs text-muted-foreground truncate">
                    → {tx.transfer_to_account.name}
                  </p>
                )}
              </div>
              <p className="text-sm font-medium tabular-nums text-muted-foreground ml-3 shrink-0">
                {formatCurrency(Number(tx.amount))}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="shrink-0 border-t border-border px-4 py-4 flex gap-3"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          onClick={onUndo}
          disabled={isUndoing}
        >
          {isUndoing ? "Undoing…" : "Undo"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
          disabled={isUndoing}
        >
          Done
        </Button>
      </div>
    </>
  )
}
