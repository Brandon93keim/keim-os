"use client"

import { useState } from "react"
import { Plus, ChevronDown, ChevronUp, Wallet } from "lucide-react"
import { useRouter } from "next/navigation"
import { startOfYear, format } from "date-fns"
import { cn } from "@/lib/utils"
import { useAllAccounts } from "@/lib/hooks/useAccounts"
import { useBusinessPnL } from "@/lib/hooks/useTransactions"
import { useCommittedOutflowsThisMonth } from "@/lib/hooks/useBills"
import { formatCurrency } from "@/lib/finance/format"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import { AccountFormSheet } from "./AccountFormSheet"
import { MoneyCube } from "./MoneyCube"
import type { AccountWithBalance } from "@/lib/finance/types"

function ytdRange() {
  const today = new Date()
  return {
    dateFrom: format(startOfYear(today), "yyyy-MM-dd"),
    dateTo: format(today, "yyyy-MM-dd"),
  }
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
      {business ? (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: business.color }} />
      ) : (
        <span className="h-2.5 w-2.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{account.name}</p>
      </div>
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

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

export function AccountList() {
  const router = useRouter()
  const { data: accounts, isLoading, error } = useAllAccounts()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [inactiveOpen, setInactiveOpen] = useState(false)

  const { dateFrom, dateTo } = ytdRange()
  const { data: pnlData, isLoading: ytdLoading } = useBusinessPnL(dateFrom, dateTo)
  const { data: billsData, isLoading: billsLoading } = useCommittedOutflowsThisMonth()

  function navigateToLedger(id: string) {
    router.push(`/money/accounts/${id}`)
  }

  const assets = accounts?.filter((a) => a.kind === "asset" && a.is_active) ?? []
  const liabilities = accounts?.filter((a) => a.kind === "liability" && a.is_active) ?? []
  const inactive = accounts?.filter((a) => !a.is_active) ?? []

  const assetsTotal = assets.reduce((sum, a) => sum + Number(a.current_balance), 0)
  const liabilitiesTotal = liabilities.reduce((sum, a) => sum + Math.abs(Number(a.current_balance)), 0)

  const ytdNet = pnlData?.totals.net ?? 0
  const ytdIncome = pnlData?.totals.income ?? 0
  const ytdExpense = pnlData?.totals.expense ?? 0
  const billsTotal = billsData?.total ?? 0

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Money" gearGutter />

      {error && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Failed to load accounts.
        </div>
      )}

      {/* Top zone */}
      <div className="px-3 pt-3 pb-3 space-y-3">
        {/* YTD hero */}
        {ytdLoading ? (
          <Skeleton className="h-[5.5rem] rounded-xl" />
        ) : (
          <button
            type="button"
            onClick={() => router.push("/money/reports")}
            className="w-full rounded-xl bg-muted/60 px-4 py-4 text-left transition-colors active:bg-muted hover:bg-muted/80"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Year to date</p>
            <p className={cn("text-3xl font-bold tabular-nums mb-1", ytdNet < 0 ? "text-red-500" : "")}>
              {formatCurrency(ytdNet)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(ytdIncome)} in · {formatCurrency(ytdExpense)} out
            </p>
          </button>
        )}

        {/* Action cubes */}
        <div className="grid grid-cols-2 gap-3">
          {billsLoading || isLoading ? (
            <>
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </>
          ) : (
            <>
              <MoneyCube
                label="Bills"
                value={formatCurrency(billsTotal)}
                sublabel="committed this month"
                onClick={() => router.push("/money/bills")}
              />
              <MoneyCube
                label="Transactions"
                onClick={() => router.push("/money/transactions")}
              />
              <MoneyCube
                label="Liabilities"
                value={
                  <span className="text-red-500/80 dark:text-red-400/80">
                    {formatCurrency(liabilitiesTotal)}
                  </span>
                }
                sublabel="owed"
                onClick={() => router.push("/money/liabilities")}
              />
              <MoneyCube
                label="Budgets"
                onClick={() => router.push("/money/budgets")}
              />
            </>
          )}
        </div>
      </div>

      {/* Account grid */}
      <div className="flex-1 pb-6">
        {/* Assets */}
        <div className="px-3 mt-2">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assets</p>
            {!isLoading && (
              <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                {formatCurrency(assetsTotal)}
              </p>
            )}
          </div>
          {isLoading ? (
            <GridSkeleton />
          ) : assets.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No asset accounts.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {assets.map((account) => {
                const business = account.business_id ? getBusinessById(account.business_id) : null
                return (
                  <MoneyCube
                    key={account.id}
                    label={account.name}
                    value={formatCurrency(Math.abs(Number(account.current_balance)))}
                    colorDot={business?.color}
                    onClick={() => navigateToLedger(account.id)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Inactive (collapsible rows) */}
        {(isLoading || inactive.length > 0) && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setInactiveOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 pb-1"
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

        {/* Empty state */}
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

      {/* FAB */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Add account"
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(var(--bottom-nav-clearance) + 0.5rem)" }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <AccountFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
