"use client"

import { useRouter } from "next/navigation"
import { useAllAccounts } from "@/lib/hooks/useAccounts"
import { formatCurrency } from "@/lib/finance/format"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import { MoneyCube } from "./MoneyCube"

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

export function LiabilityList() {
  const router = useRouter()
  const { data: accounts, isLoading } = useAllAccounts()

  const liabilities = accounts?.filter((a) => a.kind === "liability" && a.is_active) ?? []
  const total = liabilities.reduce((sum, a) => sum + Math.abs(Number(a.current_balance)), 0)

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

        {/* Liability cubes */}
        {isLoading ? (
          <GridSkeleton />
        ) : liabilities.length === 0 ? (
          <div className="flex items-center justify-center pt-16">
            <p className="text-sm text-muted-foreground">No liabilities</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {liabilities.map((account) => {
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
                  sublabel={TYPE_LABELS[account.type] ?? account.type}
                  colorDot={business?.color}
                  onClick={() => router.push(`/money/accounts/${account.id}`)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
