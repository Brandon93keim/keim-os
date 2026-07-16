"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { format, isToday, isYesterday, parseISO, isSameYear } from "date-fns"
import { cn } from "@/lib/utils"
import { useTransactions, useDrillDownTransactions } from "@/lib/hooks/useTransactions"
import { formatCurrency } from "@/lib/finance/format"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import { TransactionFormSheet } from "@/components/finance/TransactionFormSheet"
import type { TransactionWithRelations } from "@/lib/finance/types"

function formatGroupDate(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  if (isSameYear(d, new Date())) return format(d, "EEE, MMM d")
  return format(d, "MMM d, yyyy")
}

function last30DaysSummary(transactions: TransactionWithRelations[]) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = format(cutoff, "yyyy-MM-dd")

  let income = 0
  let expenses = 0
  for (const t of transactions) {
    if (t.occurred_on < cutoffStr) continue
    if (t.type === "income") income += Number(t.amount)
    else if (t.type === "expense") expenses += Number(t.amount)
  }
  return { income, expenses, net: income - expenses }
}

function drillSummary(transactions: TransactionWithRelations[]) {
  let income = 0
  let expenses = 0
  for (const t of transactions) {
    if (t.type === "income") income += Number(t.amount)
    else if (t.type === "expense") expenses += Number(t.amount)
  }
  return { income, expenses, net: income - expenses }
}

function formatDateRange(from: string, to: string): string {
  const f = parseISO(from)
  const t = parseISO(to)
  const bothThisYear = isSameYear(f, new Date()) && isSameYear(t, new Date())
  const fmt = bothThisYear ? "MMM d" : "MMM d, yyyy"
  return `${format(f, fmt)} – ${format(t, fmt)}`
}

function groupByDate(
  transactions: TransactionWithRelations[]
): { date: string; label: string; items: TransactionWithRelations[] }[] {
  const map = new Map<string, TransactionWithRelations[]>()
  for (const t of transactions) {
    const key = t.occurred_on
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    label: formatGroupDate(date),
    items,
  }))
}

function TransactionRow({
  transaction,
  onTap,
}: {
  transaction: TransactionWithRelations
  onTap: (t: TransactionWithRelations) => void
}) {
  const business = transaction.business_id ? getBusinessById(transaction.business_id) : null
  const amount = Number(transaction.amount)

  return (
    <button
      type="button"
      onClick={() => onTap(transaction)}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/60 hover:bg-muted/40"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {business && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: business.color }}
            />
          )}
          <p className="font-medium truncate">{transaction.description}</p>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {transaction.account?.name ?? "—"}
        </p>
      </div>

      <div className="text-right shrink-0">
        {transaction.type === "income" && (
          <p className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(amount)}
          </p>
        )}
        {transaction.type === "expense" && (
          <p className="text-sm font-medium tabular-nums text-red-500 dark:text-red-400">
            −{formatCurrency(amount)}
          </p>
        )}
        {transaction.type === "transfer" && (
          <>
            <p className="text-sm font-medium tabular-nums text-muted-foreground">
              {formatCurrency(amount)}
            </p>
            {transaction.transfer_to_account && (
              <p className="text-xs text-muted-foreground">
                → {transaction.transfer_to_account.name}
              </p>
            )}
          </>
        )}
      </div>
    </button>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

export default function TransactionsPage() {
  const searchParams = useSearchParams()

  const bizParam = searchParams.get("business")
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")
  const isDrillDown = !!(bizParam && fromParam && toParam)

  const { data: allTransactions = [], isLoading: allLoading, error: allError } = useTransactions()
  const {
    data: drillTransactions = [],
    isLoading: drillLoading,
    error: drillError,
  } = useDrillDownTransactions(bizParam, fromParam ?? "", toParam ?? "")

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TransactionWithRelations | undefined>(undefined)

  function openNew() {
    setEditTarget(undefined)
    setSheetOpen(true)
  }

  function openEdit(t: TransactionWithRelations) {
    setEditTarget(t)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditTarget(undefined)
  }

  const transactions = isDrillDown ? drillTransactions : allTransactions
  const isLoading = isDrillDown ? drillLoading : allLoading
  const error = isDrillDown ? drillError : allError

  const summary = isDrillDown ? drillSummary(drillTransactions) : last30DaysSummary(allTransactions)
  const groups = groupByDate(transactions)

  const drillBusinessName = isDrillDown
    ? bizParam === "personal"
      ? "Personal"
      : (getBusinessById(bizParam!)?.name ?? bizParam!)
    : null

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={isDrillDown ? drillBusinessName : "Transactions"}
        backHref="/money"
        right={isDrillDown ? (
          <Link
            href="/money/transactions"
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors shrink-0"
            aria-label="Clear filter"
          >
            <X size={16} />
          </Link>
        ) : undefined}
      />

      {/* Summary band */}
      <div className="bg-muted/40 border-b border-border px-4 py-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider text-center mb-3">
          {isDrillDown ? formatDateRange(fromParam!, toParam!) : "Last 30 days"}
        </p>
        <div className="flex justify-around">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Income</p>
            <p className="text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {isLoading ? <Skeleton className="h-5 w-20" /> : formatCurrency(summary.income)}
            </p>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Expenses</p>
            <p className="text-base font-semibold tabular-nums text-red-500 dark:text-red-400">
              {isLoading ? <Skeleton className="h-5 w-20" /> : formatCurrency(summary.expenses)}
            </p>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Net</p>
            <p
              className={cn(
                "text-base font-semibold tabular-nums",
                summary.net >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500 dark:text-red-400"
              )}
            >
              {isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                (summary.net >= 0 ? "+" : "−") + formatCurrency(Math.abs(summary.net))
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Failed to load transactions.
        </div>
      )}

      {/* Content */}
      <div className="flex-1 pb-6">
        {isLoading ? (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {[...Array(5)].map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 pt-20 text-center">
            <p className="text-base font-medium text-muted-foreground">
              {isDrillDown ? "No transactions in this range." : "No transactions yet."}
            </p>
            {!isDrillDown && <p className="text-sm text-muted-foreground">Tap + to add one.</p>}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="mt-4">
              <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="divide-y divide-border border-y border-border">
                {group.items.map((t) => (
                  <TransactionRow key={t.id} transaction={t} onTap={openEdit} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB — lifted above BottomNav */}
      <button
        type="button"
        onClick={openNew}
        aria-label="Add transaction"
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(var(--bottom-nav-clearance) + 0.5rem)" }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <TransactionFormSheet open={sheetOpen} onClose={closeSheet} transaction={editTarget} />
    </div>
  )
}
