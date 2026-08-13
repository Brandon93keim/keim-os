"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import {
  listTransactions,
  listAccountTransactions,
  listPnLTransactions,
  listDrillDownTransactions,
  listLastReconciliations,
  createTransaction,
  createReconciliation,
  updateTransaction as updateTransactionQuery,
  deleteTransaction as deleteTransactionQuery,
  type TransactionFilters,
  type ReconcileInput,
} from "@/lib/queries/finance"
import type { TransactionFormValues } from "@/lib/finance/schemas"
import { formatCurrency } from "@/lib/finance/format"
import { BUSINESSES, getPnLGroup } from "@/lib/constants"

const INVALIDATE_KEYS = ["transactions", "accounts", "business-pnl"] as const

export type BusinessPnLRow = {
  businessId: string | null
  businessName: string
  color: string
  income: number
  expense: number
  net: number
}

export type PnLTotals = { income: number; expense: number; net: number }

export type BusinessPnLResult = {
  dateFrom: string
  dateTo: string
  /** Every row, in the original order. Kept for consumers that want one flat list. */
  rows: BusinessPnLRow[]
  /** Same rows, partitioned by each unit's pnl_group. */
  businessRows: BusinessPnLRow[]
  golfRows: BusinessPnLRow[]
  personalRows: BusinessPnLRow[]
  businessTotals: PnLTotals
  golfTotals: PnLTotals
  personalTotals: PnLTotals
  /** All three groups combined. */
  totals: PnLTotals
}

function sumRows(rows: BusinessPnLRow[]): PnLTotals {
  return rows.reduce(
    (acc, r) => ({ income: acc.income + r.income, expense: acc.expense + r.expense, net: acc.net + r.net }),
    { income: 0, expense: 0, net: 0 }
  )
}

export function useBusinessPnL(dateFrom: string, dateTo: string) {
  return useQuery<BusinessPnLResult>({
    queryKey: ["business-pnl", dateFrom, dateTo],
    queryFn: async () => {
      const transactions = await listPnLTransactions(dateFrom, dateTo)

      const map = new Map<string | null, BusinessPnLRow>()
      for (const biz of BUSINESSES) {
        map.set(biz.id, { businessId: biz.id, businessName: biz.name, color: biz.color, income: 0, expense: 0, net: 0 })
      }
      map.set(null, { businessId: null, businessName: "Personal", color: "#9CA3AF", income: 0, expense: 0, net: 0 })

      for (const tx of transactions) {
        const key = tx.business_id ?? null
        const row = map.get(key) ?? map.get(null)!
        const amt = Number(tx.amount)
        if (tx.type === "income") row.income += amt
        else if (tx.type === "expense") row.expense += amt
        row.net = row.income - row.expense
      }

      const rows: BusinessPnLRow[] = [
        ...BUSINESSES.map((b) => map.get(b.id)!),
        map.get(null)!,
      ]

      const businessRows = rows.filter((r) => getPnLGroup(r.businessId) === "business")
      const golfRows = rows.filter((r) => getPnLGroup(r.businessId) === "golf")
      const personalRows = rows.filter((r) => getPnLGroup(r.businessId) === "personal")

      const businessTotals = sumRows(businessRows)
      const golfTotals = sumRows(golfRows)
      const personalTotals = sumRows(personalRows)
      const totals = sumRows(rows)

      return {
        dateFrom,
        dateTo,
        rows,
        businessRows,
        golfRows,
        personalRows,
        businessTotals,
        golfTotals,
        personalTotals,
        totals,
      }
    },
  })
}

export type IncomePeriod = { key: string; label: string; total: number }
/** One business unit's income over the same period keys as the combined series. */
export type IncomeBusinessSeries = {
  businessId: string
  businessName: string
  color: string
  periods: IncomePeriod[]
  total: number
}
export type IncomeReviewResult = {
  /** Business-only, and the exact sum across every byBusiness series. */
  periods: IncomePeriod[]
  /** Per-business breakdown, keyed by business id, in BUSINESSES order. */
  byBusiness: Record<string, IncomeBusinessSeries>
  /** Business-only grand total. */
  total: number
}

export function useIncomeReview(from: string, to: string, granularity: "month" | "year") {
  return useQuery<IncomeReviewResult>({
    queryKey: ["income-review", from, to, granularity],
    queryFn: async () => {
      const transactions = await listPnLTransactions(from, to)
      const income = transactions.filter((tx) => tx.type === "income")

      // Seed period keys (string-slice bucketing — avoids UTC-shift from Date math)
      let periodKeys: string[]
      if (granularity === "month") {
        const year = from.slice(0, 4)
        periodKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`)
      } else {
        const startYear = parseInt(from.slice(0, 4))
        const endYear = parseInt(to.slice(0, 4))
        periodKeys = Array.from({ length: endYear - startYear + 1 }, (_, i) => String(startYear + i))
      }

      const labelFor = (key: string) =>
        granularity === "month" ? format(parseISO(key + "-01"), "MMM") : key
      const periodIndex = new Map(periodKeys.map((key, i) => [key, i]))
      const seedPeriods = () => periodKeys.map((key) => ({ key, label: labelFor(key), total: 0 }))

      // Seed one series per business-group unit, in BUSINESSES order. Golf and
      // personal units never get a bucket, so no later step can reintroduce them.
      const byBusiness: Record<string, IncomeBusinessSeries> = {}
      for (const biz of BUSINESSES) {
        if (getPnLGroup(biz.id) !== "business") continue
        byBusiness[biz.id] = {
          businessId: biz.id,
          businessName: biz.name,
          color: biz.color,
          periods: seedPeriods(),
          total: 0,
        }
      }

      for (const tx of income) {
        const businessId = tx.business_id ?? null
        // Business-only, for every series alike. Unknown ids read as "personal"
        // (see getPnLGroup) and drop out here rather than landing in a bucket.
        if (!businessId || getPnLGroup(businessId) !== "business") continue

        const periodKey =
          granularity === "month" ? tx.occurred_on.slice(0, 7) : tx.occurred_on.slice(0, 4)
        const index = periodIndex.get(periodKey)
        if (index === undefined) continue

        const amount = Number(tx.amount)
        const series = byBusiness[businessId]
        series.periods[index].total += amount
        series.total += amount
      }

      // Combined is derived from the per-business series, so the "All" bars and
      // a single business's bars can never disagree.
      const seriesList = Object.values(byBusiness)
      const periods = periodKeys.map((key, i) => ({
        key,
        label: labelFor(key),
        total: seriesList.reduce((acc, s) => acc + s.periods[i].total, 0),
      }))

      return {
        periods,
        byBusiness,
        total: seriesList.reduce((acc, s) => acc + s.total, 0),
      }
    },
  })
}

export function useDrillDownTransactions(
  businessParam: string | null,
  dateFrom: string,
  dateTo: string
) {
  return useQuery({
    queryKey: ["transactions", "drill-down", businessParam, dateFrom, dateTo],
    queryFn: () => listDrillDownTransactions(businessParam!, dateFrom, dateTo),
    enabled: !!businessParam && !!dateFrom && !!dateTo,
  })
}

export function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => listTransactions(filters),
  })
}

export function useAccountTransactions(accountId: string) {
  return useQuery({
    queryKey: ["transactions", "account", accountId],
    queryFn: () => listAccountTransactions(accountId),
    enabled: !!accountId,
  })
}

// Keyed on a sorted copy so callers can pass ids in any order without
// splitting the cache. Lives under "transactions" so recording a
// reconciliation refreshes it along with everything else.
export function useLastReconciliations(accountIds: string[]) {
  const key = [...accountIds].sort()
  return useQuery({
    queryKey: ["transactions", "reconciliations", key],
    queryFn: () => listLastReconciliations(key),
    enabled: key.length > 0,
  })
}

export function useTransaction(id: string | undefined) {
  const { data: transactions } = useTransactions()
  return transactions?.find((t) => t.id === id)
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: TransactionFormValues) => createTransaction(values),
    onSuccess: () => {
      INVALIDATE_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
      toast.success("Transaction added")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to add transaction")
    },
  })
}

export function useReconcileAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReconcileInput) => createReconciliation(input),
    onSuccess: (delta) => {
      if (!delta) {
        // Nothing was written — the balance already agreed with the statement.
        toast.success("Already matches the statement")
        return
      }
      INVALIDATE_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
      toast.success(
        delta.type === "expense"
          ? `Reconciled — added ${formatCurrency(delta.amount)} in unrecorded charges`
          : `Reconciled — credited ${formatCurrency(delta.amount)} back`
      )
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to reconcile")
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TransactionFormValues }) =>
      updateTransactionQuery(id, values),
    onSuccess: () => {
      INVALIDATE_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
      toast.success("Transaction saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save transaction")
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTransactionQuery(id),
    onSuccess: () => {
      INVALIDATE_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
      queryClient.invalidateQueries({ queryKey: ["committed-outflows"] })
      toast.success("Transaction deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete transaction")
    },
  })
}
