"use client"

import { useQuery } from "@tanstack/react-query"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { listPnLTransactions } from "@/lib/queries/finance"
import { useCategories } from "./useCategories"

export type BudgetRow = {
  categoryId: string
  name: string
  color: string | null
  limit: number // category.monthly_budget
  spent: number
  remaining: number // limit - spent (may go negative)
  pct: number // spent / limit, 0 if limit is 0
}

export type BudgetMonthResult = {
  monthKey: string // "2026-06"
  monthLabel: string // "June 2026"
  rows: BudgetRow[]
  totals: { budgeted: number; spent: number }
}

export function useBudgets(monthDate: Date) {
  const { data: categories = [] } = useCategories()

  // NEVER toISOString — string-format the local date to dodge the UTC-shift bug.
  const from = format(startOfMonth(monthDate), "yyyy-MM-dd")
  const to = format(endOfMonth(monthDate), "yyyy-MM-dd")
  const monthKey = format(monthDate, "yyyy-MM")
  const monthLabel = format(monthDate, "MMMM yyyy")

  return useQuery<BudgetMonthResult>({
    queryKey: ["budgets", monthKey],
    queryFn: async () => {
      const transactions = await listPnLTransactions(from, to)
      const expenses = transactions.filter((tx) => tx.type === "expense")

      // Budgeted set: active categories with a monthly_budget set.
      const budgeted = categories.filter(
        (c) => c.monthly_budget != null && c.is_active === true
      )

      // Bucket expenses by category_id (range query already bounds them in-month).
      const spentByCategory = new Map<string, number>()
      for (const tx of expenses) {
        if (!tx.category_id) continue
        spentByCategory.set(
          tx.category_id,
          (spentByCategory.get(tx.category_id) ?? 0) + Number(tx.amount)
        )
      }

      const rows: BudgetRow[] = budgeted
        .map((c) => {
          const limit = Number(c.monthly_budget)
          const spent = spentByCategory.get(c.id) ?? 0
          return {
            categoryId: c.id,
            name: c.name,
            color: c.color,
            limit,
            spent,
            remaining: limit - spent,
            pct: limit === 0 ? 0 : spent / limit,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      const totals = rows.reduce(
        (acc, r) => ({ budgeted: acc.budgeted + r.limit, spent: acc.spent + r.spent }),
        { budgeted: 0, spent: 0 }
      )

      return { monthKey, monthLabel, rows, totals }
    },
  })
}
