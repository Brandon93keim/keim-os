"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useCategories, useDeleteCategory } from "@/lib/hooks/useCategories"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/PageHeader"
import { formatCurrency } from "@/lib/finance/format"
import { cn } from "@/lib/utils"
import { CategorySheet } from "./CategorySheet"
import type { Category, TransactionType } from "@/lib/finance/types"

const SECTIONS: { kind: TransactionType; label: string }[] = [
  { kind: "expense", label: "Expense" },
  { kind: "income", label: "Income" },
  { kind: "transfer", label: "Transfer" },
]

function CategorySkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
  isDeleting,
  confirming,
  onConfirmDelete,
  onCancelDelete,
}: {
  category: Category
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
  confirming: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  return (
    <div className={cn(!category.is_active && "opacity-50")}>
      <div className="flex items-center">
        <div className="flex flex-1 items-center gap-3 px-4 py-3.5 min-w-0">
          {category.color ? (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
          ) : (
            <span className="h-2.5 w-2.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{category.name}</p>
            {category.kind === "expense" && category.monthly_budget != null && (
              <p className="text-xs text-muted-foreground truncate">
                {formatCurrency(Number(category.monthly_budget))}/mo
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${category.name}`}
          className="flex h-12 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil size={15} />
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={`Delete ${category.name}`}
          className="flex h-12 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive transition-colors pr-2"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {confirming && (
        <div className="border-t border-destructive/40 bg-destructive/5 px-4 py-3 space-y-2">
          <p className="text-sm text-destructive">Delete &ldquo;{category.name}&rdquo;?</p>
          <p className="text-xs text-muted-foreground">
            Transactions stay; they&rsquo;re just untagged (amounts are kept).
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className="flex-1"
            >
              {isDeleting ? "Deleting…" : "Yes, delete"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelDelete}
              className="flex-1"
            >
              Keep it
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CategoryList() {
  const { data: categories = [], isLoading } = useCategories()
  const deleteCategory = useDeleteCategory()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Category | undefined>(undefined)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  function openAdd() {
    setEditing(undefined)
    setSheetOpen(true)
  }

  function openEdit(category: Category) {
    setEditing(category)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(undefined)
  }

  function handleConfirmDelete(id: string) {
    deleteCategory.mutate(id, { onSuccess: () => setConfirmingId(null) })
  }

  function sortInSection(list: Category[]) {
    return [...list].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Categories"
        backHref="/settings"
        right={
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center justify-center text-primary hover:opacity-80 transition-opacity"
            aria-label="Add category"
          >
            <Plus size={22} />
          </button>
        }
      />

      <div className="flex-1 pb-6">
        {isLoading ? (
          <div className="mt-4 divide-y divide-border border-y border-border">
            <CategorySkeleton />
            <CategorySkeleton />
            <CategorySkeleton />
          </div>
        ) : categories.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 px-4">
            <p className="text-sm text-muted-foreground text-center">
              Tap the + button to add your first category.
            </p>
            <Button variant="outline" onClick={openAdd}>
              Add Category
            </Button>
          </div>
        ) : (
          SECTIONS.map(({ kind, label }) => {
            const rows = sortInSection(categories.filter((c) => c.kind === kind))
            if (rows.length === 0) return null
            return (
              <div key={kind} className="mt-4">
                <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <div className="divide-y divide-border border-y border-border">
                  {rows.map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      onEdit={() => openEdit(category)}
                      onDelete={() => setConfirmingId(category.id)}
                      isDeleting={deleteCategory.isPending && confirmingId === category.id}
                      confirming={confirmingId === category.id}
                      onConfirmDelete={() => handleConfirmDelete(category.id)}
                      onCancelDelete={() => setConfirmingId(null)}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      <CategorySheet
        open={sheetOpen}
        onClose={closeSheet}
        category={editing}
        allCategories={categories}
      />
    </div>
  )
}
