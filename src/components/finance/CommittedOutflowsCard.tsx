"use client"

import { useRouter } from "next/navigation"
import { useCommittedOutflowsThisMonth } from "@/lib/hooks/useBills"
import { formatCurrency } from "@/lib/finance/format"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"

export function CommittedOutflowsCard() {
  const router = useRouter()
  const { data, isLoading } = useCommittedOutflowsThisMonth()

  if (isLoading) {
    return (
      <div className="border-b border-border px-4 py-4 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-3 w-52" />
        <div className="pt-3 border-t border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full shrink-0" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full shrink-0" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      </div>
    )
  }

  const empty = !data || (data.total === 0 && data.variableCount === 0)

  return (
    <button
      type="button"
      onClick={() => router.push("/money/bills")}
      className="w-full border-b border-border px-4 py-4 text-left transition-colors active:bg-muted/60 hover:bg-muted/40"
    >
      <p className="text-xs text-muted-foreground mb-1">Committed this month</p>

      {empty ? (
        <p className="text-sm text-muted-foreground">Nothing committed this month.</p>
      ) : (
        <>
          <p className="text-2xl font-bold tabular-nums mb-1">
            {formatCurrency(data!.total)}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            {formatCurrency(data!.paid)} paid · {formatCurrency(data!.remaining)} remaining
            {data!.variableCount > 0 && ` · +${data!.variableCount} variable`}
          </p>

          {data!.byBusiness.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              {data!.byBusiness.map((row) => {
                const business = row.businessId ? getBusinessById(row.businessId) : null
                const label = business?.name ?? "Personal"
                const amountStr = row.amount > 0 ? formatCurrency(row.amount) : ""
                const varStr = row.variableCount > 0 ? `+${row.variableCount} var` : ""
                const right = [amountStr, varStr].filter(Boolean).join(" ")

                return (
                  <div
                    key={row.businessId ?? "__personal__"}
                    className="flex items-center gap-2"
                  >
                    {business ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: business.color }}
                      />
                    ) : (
                      <span className="h-2 w-2 shrink-0" />
                    )}
                    <span className="flex-1 text-sm text-left truncate">{label}</span>
                    <span className="text-sm font-medium tabular-nums text-muted-foreground shrink-0">
                      {right}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </button>
  )
}
