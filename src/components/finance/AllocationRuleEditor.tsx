"use client"

import { useState } from "react"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAllocationRules, useDeleteAllocationRule } from "@/lib/hooks/useAllocationRules"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { AllocationRuleSheet } from "./AllocationRuleSheet"
import type { AllocationRuleWithAccount } from "@/lib/finance/types"

function RuleSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-12" />
    </div>
  )
}

function RuleRow({
  rule,
  onEdit,
  onDelete,
  isDeleting,
}: {
  rule: AllocationRuleWithAccount
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  return (
    <div className="flex items-center">
      <div className="flex flex-1 items-center gap-3 px-4 py-3.5 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{rule.label}</p>
          <p className="text-xs text-muted-foreground truncate">
            {rule.destination_account?.name ?? "Unknown account"}
          </p>
        </div>
        <span className="text-sm font-medium tabular-nums shrink-0">
          {Number(rule.percentage).toFixed(2).replace(/\.00$/, "")}%
        </span>
      </div>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${rule.label}`}
        className="flex h-12 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil size={15} />
      </button>

      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={`Delete ${rule.label}`}
        className="flex h-12 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive transition-colors pr-2"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

export function AllocationRuleEditor() {
  const router = useRouter()
  const { data: rules = [], isLoading } = useAllocationRules()
  const deleteRule = useDeleteAllocationRule()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<AllocationRuleWithAccount | undefined>(undefined)

  const total = rules.reduce((sum, r) => sum + Number(r.percentage), 0)
  const remainder = 100 - total
  const isOver = total > 100

  function openAdd() {
    setEditing(undefined)
    setSheetOpen(true)
  }

  function openEdit(rule: AllocationRuleWithAccount) {
    setEditing(rule)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(undefined)
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors -ml-1"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold flex-1">Income Allocation</h1>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center justify-center text-primary hover:opacity-80 transition-opacity"
          aria-label="Add rule"
        >
          <Plus size={22} />
        </button>
      </div>

      {/* Summary band */}
      <div className="bg-muted/40 border-b border-border px-4 py-4">
        {isLoading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rules yet. Add rules to define how income gets split.
          </p>
        ) : (
          <>
            <p className={`text-sm font-medium ${isOver ? "text-destructive" : ""}`}>
              {total.toFixed(2).replace(/\.00$/, "")}% allocated
              {isOver && " — exceeds 100%"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {remainder >= 0
                ? `${remainder.toFixed(2).replace(/\.00$/, "")}% stays in the source account as operating`
                : `${Math.abs(remainder).toFixed(2).replace(/\.00$/, "")}% over budget — reduce percentages`}
            </p>
          </>
        )}
      </div>

      {/* Rule list */}
      <div className="flex-1 pb-6">
        {isLoading ? (
          <div className="mt-4 divide-y divide-border border-y border-border">
            <RuleSkeleton />
            <RuleSkeleton />
            <RuleSkeleton />
          </div>
        ) : rules.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 px-4">
            <p className="text-sm text-muted-foreground text-center">
              Tap the + button to add your first allocation rule.
            </p>
            <Button variant="outline" onClick={openAdd}>
              Add Rule
            </Button>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onEdit={() => openEdit(rule)}
                onDelete={() => deleteRule.mutate(rule.id)}
                isDeleting={deleteRule.isPending}
              />
            ))}
          </div>
        )}
      </div>

      <AllocationRuleSheet
        open={sheetOpen}
        onClose={closeSheet}
        rule={editing}
        currentTotal={total}
      />
    </div>
  )
}
