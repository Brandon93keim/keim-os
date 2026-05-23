"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Pencil } from "lucide-react"
import { format, isToday, isYesterday, parseISO, isSameYear } from "date-fns"
import { cn } from "@/lib/utils"
import { useAllAccounts } from "@/lib/hooks/useAccounts"
import { useAccountTransactions } from "@/lib/hooks/useTransactions"
import { formatCurrency } from "@/lib/finance/format"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountFormSheet } from "./AccountFormSheet"
import { TransactionFormSheet } from "./TransactionFormSheet"
import type { AccountWithBalance, TransactionWithRelations } from "@/lib/finance/types"

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  cash: "Cash",
  other: "Other",
}

type TransactionWithRunning = TransactionWithRelations & { runningAfter: number }

function formatGroupDate(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  if (isSameYear(d, new Date())) return format(d, "EEE, MMM d")
  return format(d, "MMM d, yyyy")
}

function computeRunningBalances(
  transactions: TransactionWithRelations[],
  accountId: string,
  startingBalance: number
): TransactionWithRunning[] {
  // Sort oldest first for accumulation
  const sorted = [...transactions].sort((a, b) => {
    if (a.occurred_on !== b.occurred_on) return a.occurred_on.localeCompare(b.occurred_on)
    return a.created_at.localeCompare(b.created_at)
  })

  let running = Number(startingBalance)
  const withRunning: TransactionWithRunning[] = sorted.map((t) => {
    const amount = Number(t.amount)
    const isSource = t.account_id === accountId
    const isDest = t.transfer_to_account_id === accountId

    if (isSource) {
      if (t.type === "income") running += amount
      else if (t.type === "expense") running -= amount
      else if (t.type === "transfer") running -= amount
    } else if (isDest && t.type === "transfer") {
      running += amount
    }

    return { ...t, runningAfter: running }
  })

  // Return newest first for display
  return withRunning.reverse()
}

function groupByDate(
  transactions: TransactionWithRunning[]
): { date: string; label: string; items: TransactionWithRunning[] }[] {
  const map = new Map<string, TransactionWithRunning[]>()
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
  accountId,
  onTap,
}: {
  transaction: TransactionWithRunning
  accountId: string
  onTap: (t: TransactionWithRelations) => void
}) {
  const isSource = transaction.account_id === accountId
  const isDest = transaction.transfer_to_account_id === accountId
  const amount = Number(transaction.amount)
  const business = transaction.business_id ? getBusinessById(transaction.business_id) : null

  return (
    <button
      type="button"
      onClick={() => onTap(transaction)}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/60 hover:bg-muted/40"
    >
      {/* Left: description + transfer context */}
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
        {transaction.type === "transfer" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSource
              ? `to ${transaction.transfer_to_account?.name ?? "—"}`
              : `from ${transaction.account?.name ?? "—"}`}
          </p>
        )}
      </div>

      {/* Right: amount + running balance */}
      <div className="text-right shrink-0">
        {isSource && transaction.type === "income" && (
          <p className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(amount)}
          </p>
        )}
        {isSource && transaction.type === "expense" && (
          <p className="text-sm font-medium tabular-nums text-red-500 dark:text-red-400">
            −{formatCurrency(amount)}
          </p>
        )}
        {isSource && transaction.type === "transfer" && (
          <p className="text-sm font-medium tabular-nums text-muted-foreground">
            −{formatCurrency(amount)}
          </p>
        )}
        {isDest && transaction.type === "transfer" && (
          <p className="text-sm font-medium tabular-nums text-muted-foreground">
            +{formatCurrency(amount)}
          </p>
        )}
        <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
          {formatCurrency(transaction.runningAfter)}
        </p>
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
      <div className="text-right space-y-1.5">
        <Skeleton className="h-4 w-16 ml-auto" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
    </div>
  )
}

export function AccountLedger({ id }: { id: string }) {
  const router = useRouter()
  const { data: allAccounts = [], isLoading: accountsLoading } = useAllAccounts()
  const { data: transactions = [], isLoading: txLoading, error } = useAccountTransactions(id)

  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [txSheetOpen, setTxSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TransactionWithRelations | undefined>(undefined)

  const account = allAccounts.find((a) => a.id === id) as AccountWithBalance | undefined
  const isLoading = accountsLoading || txLoading

  const transactionsWithRunning = useMemo(() => {
    if (!account) return []
    return computeRunningBalances(transactions, id, Number(account.starting_balance))
  }, [transactions, id, account])

  const groups = useMemo(() => groupByDate(transactionsWithRunning), [transactionsWithRunning])

  function openEditTx(t: TransactionWithRelations) {
    setEditTarget(t)
    setTxSheetOpen(true)
  }

  function openNewTx() {
    setEditTarget(undefined)
    setTxSheetOpen(true)
  }

  function closeTxSheet() {
    setTxSheetOpen(false)
    setEditTarget(undefined)
  }

  const balance = account ? Number(account.current_balance) : 0
  const isLiability = account?.kind === "liability"
  const business = account?.business_id ? getBusinessById(account.business_id) : null

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/money")}
          className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors -ml-1 shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold flex-1 truncate min-w-0">
          {accountsLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            account?.name ?? "Account"
          )}
        </h1>
        <button
          type="button"
          onClick={() => setEditSheetOpen(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition-opacity shrink-0"
          aria-label="Edit account"
        >
          <Pencil size={15} />
          Edit
        </button>
      </div>

      {/* Account summary card */}
      <div className="bg-muted/40 border-b border-border px-4 py-4">
        <div className="text-center mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Current Balance
          </p>
          {accountsLoading ? (
            <Skeleton className="h-9 w-36 mx-auto" />
          ) : (
            <p
              className={cn(
                "text-3xl font-bold tabular-nums",
                isLiability ? "text-red-500/80 dark:text-red-400/80" : ""
              )}
            >
              {formatCurrency(Math.abs(balance))}
            </p>
          )}
        </div>

        {/* Type + business */}
        {!accountsLoading && account && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <p className="text-sm text-muted-foreground">
              {TYPE_LABELS[account.type] ?? account.type}
            </p>
            {business && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: business.color }}
                />
                {business.name}
              </span>
            )}
          </div>
        )}

        {/* Starting balance + tx count */}
        {!isLoading && account && (
          <p className="text-xs text-muted-foreground text-center">
            Starting balance: {formatCurrency(Number(account.starting_balance))}
            {" · "}
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Failed to load transactions.
        </div>
      )}

      {/* Transaction list */}
      <div className="flex-1 pb-6">
        {isLoading ? (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {[...Array(4)].map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 pt-20 text-center">
            <p className="text-base font-medium text-muted-foreground">
              No transactions for {account?.name ?? "this account"} yet.
            </p>
            <p className="text-sm text-muted-foreground">Tap + to add the first one.</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="mt-4">
              <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="divide-y divide-border border-y border-border">
                {group.items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    accountId={id}
                    onTap={openEditTx}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={openNewTx}
        aria-label="Add transaction"
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)" }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Edit account sheet */}
      <AccountFormSheet
        open={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        account={account}
      />

      {/* Add / edit transaction sheet */}
      <TransactionFormSheet
        open={txSheetOpen}
        onClose={closeTxSheet}
        transaction={editTarget}
        defaultAccountId={id}
      />
    </div>
  )
}
