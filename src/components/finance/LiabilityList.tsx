"use client"

import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { useAllAccounts } from "@/lib/hooks/useAccounts"
import { useLastReconciliations } from "@/lib/hooks/useTransactions"
import { formatCurrency } from "@/lib/finance/format"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import { MoneyCube } from "./MoneyCube"
import type { AccountWithBalance } from "@/lib/finance/types"

const TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  cash: "Cash",
  other: "Other",
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[...Array(2)].map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

function LiabilitySection({
  title,
  note,
  accounts,
  sublabelFor,
  onTap,
}: {
  title: string
  note?: string
  accounts: AccountWithBalance[]
  sublabelFor: (account: AccountWithBalance) => string | undefined
  onTap: (id: string) => void
}) {
  if (accounts.length === 0) return null

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {accounts.map((account) => {
          const business = account.business_id ? getBusinessById(account.business_id) : null
          return (
            <MoneyCube
              key={account.id}
              label={account.name}
              value={
                <span className="text-red-500/80 dark:text-red-400/80">
                  {formatCurrency(Math.abs(Number(account.current_balance)))}
                </span>
              }
              sublabel={sublabelFor(account)}
              colorDot={business?.color}
              onClick={() => onTap(account.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

export function LiabilityList() {
  const router = useRouter()
  const { data: accounts, isLoading } = useAllAccounts()

  const liabilities = accounts?.filter((a) => a.kind === "liability" && a.is_active) ?? []
  const total = liabilities.reduce((sum, a) => sum + Math.abs(Number(a.current_balance)), 0)

  // Financing plans pay down on a schedule, so their balance is trustworthy.
  // Revolving cards only ever get payments recorded, so what's shown is a
  // floor that drifts until it's reconciled against a statement.
  const financing = liabilities.filter(
    (a) => a.type === "credit_card" && a.credit_subtype === "financing"
  )
  const revolving = liabilities.filter(
    (a) => a.type === "credit_card" && a.credit_subtype === "revolving"
  )
  const other = liabilities.filter(
    (a) => a.type !== "credit_card" || a.credit_subtype === null
  )

  const { data: lastReconciled = {} } = useLastReconciliations(revolving.map((a) => a.id))

  function navigateToLedger(id: string) {
    router.push(`/money/accounts/${id}`)
  }

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Liabilities" backHref="/money" />

      <div className="px-3 pt-3 pb-3 space-y-3">
        {/* Total-owed hero */}
        {isLoading ? (
          <Skeleton className="h-[5.5rem] rounded-xl" />
        ) : (
          <div className="w-full rounded-xl bg-muted/60 px-4 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total owed</p>
            <p className="text-3xl font-bold tabular-nums text-red-500/80 dark:text-red-400/80">
              {formatCurrency(total)}
            </p>
          </div>
        )}

        {/* Liability cubes, grouped by how much the balance can be trusted */}
        {isLoading ? (
          <GridSkeleton />
        ) : liabilities.length === 0 ? (
          <div className="flex items-center justify-center pt-16">
            <p className="text-sm text-muted-foreground">No liabilities</p>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            <LiabilitySection
              title="Financing plans"
              accounts={financing}
              sublabelFor={() => undefined}
              onTap={navigateToLedger}
            />
            <LiabilitySection
              title="Revolving cards"
              note="estimates"
              accounts={revolving}
              sublabelFor={(account) => {
                const on = lastReconciled[account.id]
                return on
                  ? `Last reconciled ${format(parseISO(on), "MMM d")}`
                  : "Estimate"
              }}
              onTap={navigateToLedger}
            />
            <LiabilitySection
              title={financing.length || revolving.length ? "Other" : "Accounts"}
              accounts={other}
              sublabelFor={(account) => TYPE_LABELS[account.type] ?? account.type}
              onTap={navigateToLedger}
            />
          </div>
        )}
      </div>
    </div>
  )
}
