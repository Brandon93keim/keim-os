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
export type IncomeStream = { businessId: string | null; businessName: string; color: string; income: number }
export type IncomeReviewResult = {
  /** Period totals are business-only — golf and personal income is excluded. */
  periods: IncomePeriod[]
  /** Every stream, in the original order. */
  streams: IncomeStream[]
  businessStreams: IncomeStream[]
  golfStreams: IncomeStream[]
  personalStreams: IncomeStream[]
  /** Business-only grand total. */
  total: number
  golfTotal: number
  personalTotal: number
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

      const periodMap = new Map<string, IncomePeriod>()
      for (const key of periodKeys) {
        const label = granularity === "month" ? format(parseISO(key + "-01"), "MMM") : key
        periodMap.set(key, { key, label, total: 0 })
      }

      // Seed streams — same order as P&L (8 BUSINESSES + Personal)
      const streamMap = new Map<string | null, IncomeStream>()
      for (const biz of BUSINESSES) {
        streamMap.set(biz.id, { businessId: biz.id, businessName: biz.name, color: biz.color, income: 0 })
      }
      streamMap.set(null, { businessId: null, businessName: "Personal", color: "#9CA3AF", income: 0 })

      for (const tx of income) {
        const amount = Number(tx.amount)
        const businessId = tx.business_id ?? null

        // Period totals are business-only; golf and personal still show as streams.
        if (getPnLGroup(businessId) === "business") {
          const periodKey = granularity === "month" ? tx.occurred_on.slice(0, 7) : tx.occurred_on.slice(0, 4)
          const period = periodMap.get(periodKey)
          if (period) period.total += amount
        }

        const stream = streamMap.get(businessId) ?? streamMap.get(null)!
        stream.income += amount
      }

      const periods = periodKeys.map((k) => periodMap.get(k)!)
      const streams: IncomeStream[] = [...BUSINESSES.map((b) => streamMap.get(b.id)!), streamMap.get(null)!]

      const businessStreams = streams.filter((s) => getPnLGroup(s.businessId) === "business")
      const golfStreams = streams.filter((s) => getPnLGroup(s.businessId) === "golf")
      const personalStreams = streams.filter((s) => getPnLGroup(s.businessId) === "personal")

      const sumIncome = (list: IncomeStream[]) => list.reduce((acc, s) => acc + s.income, 0)

      return {
        periods,
        streams,
        businessStreams,
        golfStreams,
        personalStreams,
        total: sumIncome(businessStreams),
        golfTotal: sumIncome(golfStreams),
        personalTotal: sumIncome(personalStreams),
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
