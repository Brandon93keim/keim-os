"use client"

import { useState } from "react"
import { Plus, ChevronDown, ChevronUp, Wallet, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAllAccounts } from "@/lib/hooks/useAccounts"
import { formatCurrency } from "@/lib/finance/format"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountFormSheet } from "./AccountFormSheet"
import { CommittedOutflowsCard } from "./CommittedOutflowsCard"
import type { AccountWithBalance } from "@/lib/finance/types"

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  cash: "Cash",
  other: "Other",
}

function AccountRow({
  account,
  onTap,
}: {
  account: AccountWithBalance
  onTap: (id: string) => void
}) {
  const business = account.business_id ? getBusinessById(account.business_id) : null
  const isLiability = account.kind === "liability"
  const balance = Number(account.current_balance)

  return (
    <button
      type="button"
      onClick={() => onTap(account.id)}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/60 hover:bg-muted/40"
    >
      {/* Business color dot */}
      {business ? (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: business.color }}
        />
      ) : (
        <span className="h-2.5 w-2.5 shrink-0" />
      )}

      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{account.name}</p>
        <p className="text-xs text-muted-foreground">{TYPE_LABELS[account.type] ?? account.type}</p>
      </div>

      {/* Balance */}
      <span
        className={cn(
          "text-sm font-medium tabular-nums shrink-0",
          isLiability ? "text-red-500/80 dark:text-red-400/80" : "text-foreground"
        )}
      >
        {formatCurrency(Math.abs(balance))}
      </span>
    </button>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-border">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function AccountList() {
  const router = useRouter()
  const { data: accounts, isLoading, error } = useAllAccounts()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [inactiveOpen, setInactiveOpen] = useState(false)

  function openNew() {
    setSheetOpen(true)
  }

  function navigateToLedger(id: string) {
    router.push(`/money/accounts/${id}`)
  }

  const assets = accounts?.filter((a) => a.kind === "asset" && a.is_active) ?? []
  const liabilities = accounts?.filter((a) => a.kind === "liability" && a.is_active) ?? []
  const inactive = accounts?.filter((a) => !a.is_active) ?? []

  const assetsTotal = assets.reduce((sum, a) => sum + Number(a.current_balance), 0)
  const liabilitiesTotal = liabilities.reduce((sum, a) => sum + Number(a.current_balance), 0)
  const netWorth = assetsTotal - liabilitiesTotal

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold">Accounts</h1>
      </div>

      {/* Summary band */}
      <div className="bg-muted/40 border-b border-border px-4 py-4">
        <div className="mb-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Net Worth</p>
          <p className={cn("text-3xl font-bold tabular-nums", netWorth < 0 ? "text-red-500" : "")}>
            {isLoading ? (
              <Skeleton className="h-9 w-36 mx-auto" />
            ) : (
              formatCurrency(netWorth)
            )}
          </p>
        </div>
        <div className="flex justify-around">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Assets</p>
            <p className="text-base font-semibold tabular-nums">
              {isLoading ? <Skeleton className="h-5 w-20" /> : formatCurrency(assetsTotal)}
            </p>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Liabilities</p>
            <p className="text-base font-semibold tabular-nums text-red-500/80 dark:text-red-400/80">
              {isLoading ? <Skeleton className="h-5 w-20" /> : formatCurrency(liabilitiesTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* View all transactions link */}
      <div className="border-b border-border px-4 py-3">
        <Link
          href="/money/transactions"
          className="flex items-center justify-between text-sm font-medium text-primary hover:opacity-80 transition-opacity"
        >
          View all transactions
          <ArrowRight size={16} />
        </Link>
      </div>

      <CommittedOutflowsCard />

      {/* Error state */}
      {error && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Failed to load accounts.
        </div>
      )}

      {/* Content */}
      <div className="flex-1 pb-6">
        {/* Assets section */}
        <div className="mt-4">
          <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Assets
          </p>
          <div className="divide-y divide-border border-y border-border">
            {isLoading ? (
              <SectionSkeleton />
            ) : assets.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No asset accounts.</p>
            ) : (
              assets.map((account) => (
                <AccountRow key={account.id} account={account} onTap={navigateToLedger} />
              ))
            )}
          </div>
        </div>

        {/* Liabilities section */}
        <div className="mt-6">
          <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Liabilities
          </p>
          <div className="divide-y divide-border border-y border-border">
            {isLoading ? (
              <SectionSkeleton />
            ) : liabilities.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No liability accounts.</p>
            ) : (
              liabilities.map((account) => (
                <AccountRow key={account.id} account={account} onTap={navigateToLedger} />
              ))
            )}
          </div>
        </div>

        {/* Inactive section (collapsible) */}
        {(isLoading || inactive.length > 0) && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setInactiveOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 pb-1"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Inactive ({inactive.length})
              </p>
              {inactiveOpen ? (
                <ChevronUp size={14} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={14} className="text-muted-foreground" />
              )}
            </button>
            {inactiveOpen && (
              <div className="divide-y divide-border border-y border-border">
                {inactive.map((account) => (
                  <AccountRow key={account.id} account={account} onTap={navigateToLedger} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state (no accounts at all) */}
        {!isLoading && accounts?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 px-4 pt-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <Wallet size={28} className="text-muted-foreground" />
            </div>
            <p className="font-medium">No accounts yet</p>
            <p className="text-sm text-muted-foreground">Add your first account to get started.</p>
          </div>
        )}
      </div>

      {/* FAB — lifted above BottomNav */}
      <button
        type="button"
        onClick={openNew}
        aria-label="Add account"
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)" }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Add account sheet */}
      <AccountFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
