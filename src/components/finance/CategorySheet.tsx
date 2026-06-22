"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateCategory, useUpdateCategory } from "@/lib/hooks/useCategories"
import { cn } from "@/lib/utils"
import type { Category, CategoryInput, TransactionType } from "@/lib/finance/types"

const KIND_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
}

interface Props {
  open: boolean
  onClose: () => void
  category: Category | undefined
  allCategories: Category[]
}

export function CategorySheet({ open, onClose, category, allCategories }: Props) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<TransactionType>("expense")
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null)
  const [color, setColor] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const isPending = createCategory.isPending || updateCategory.isPending

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "")
      setKind(category?.kind ?? "expense")
      setMonthlyBudget(category?.monthly_budget ?? null)
      setColor(category?.color ?? "")
      setIsActive(category?.is_active ?? true)
      setError(null)
    }
  }, [open, category?.id])

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required")
      return
    }
    if (trimmed.length > 60) {
      setError("Name must be 60 characters or fewer")
      return
    }
    const dup = allCategories.some(
      (c) =>
        c.id !== category?.id &&
        c.kind === kind &&
        c.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (dup) {
      setError(`A ${KIND_LABELS[kind].toLowerCase()} category with this name already exists`)
      return
    }

    const input: CategoryInput = {
      name: trimmed,
      kind,
      monthly_budget: kind === "expense" ? monthlyBudget : null,
      color: color.trim() || null,
      is_active: isActive,
    }

    if (category) {
      updateCategory.mutate({ id: category.id, input }, { onSuccess: onClose })
    } else {
      createCategory.mutate(input, { onSuccess: onClose })
    }
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
          <SheetTitle>{category ? "Edit Category" : "New Category"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              placeholder="e.g. Gas"
              maxLength={60}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Kind</Label>
            <Select
              value={kind}
              onValueChange={(v) => { setKind(v as TransactionType); setError(null) }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "expense" && (
            <div className="space-y-1.5">
              <Label>Monthly budget</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  placeholder="Not budgeted"
                  value={monthlyBudget === null ? "" : monthlyBudget}
                  onChange={(e) =>
                    setMonthlyBudget(e.target.value === "" ? null : parseFloat(e.target.value))
                  }
                  className="tabular-nums"
                />
              </div>
              <p className="text-xs text-muted-foreground">Leave empty for no monthly limit.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Color</Label>
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#22c55e (optional)"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="mb-0">Active</Label>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                isActive ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  isActive ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        <div
          className="shrink-0 border-t border-border px-4 py-4 flex gap-3"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 h-11"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Saving…" : category ? "Save" : "Add Category"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
