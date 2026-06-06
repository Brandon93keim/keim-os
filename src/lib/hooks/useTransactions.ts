"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import {
  listTransactions,
  listAccountTransactions,
  listPnLTransactions,
  listDrillDownTransactions,
  createTransaction,
  updateTransaction as updateTransactionQuery,
  deleteTransaction as deleteTransactionQuery,
  type TransactionFilters,
} from "@/lib/queries/finance"
import type { TransactionFormValues } from "@/lib/finance/schemas"
import { BUSINESSES } from "@/lib/constants"

const INVALIDATE_KEYS = ["transactions", "accounts", "business-pnl"] as const

export type BusinessPnLRow = {
  businessId: string | null
  businessName: string
  color: string
  income: number
  expense: number
  net: number
}

export type BusinessPnLResult = {
  dateFrom: string
  dateTo: string
  rows: BusinessPnLRow[]
  totals: { income: number; expense: number; net: number }
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

      const totals = rows.reduce(
        (acc, r) => ({ income: acc.income + r.income, expense: acc.expense + r.expense, net: acc.net + r.net }),
        { income: 0, expense: 0, net: 0 }
      )

      return { dateFrom, dateTo, rows, totals }
    },
  })
}

export type IncomePeriod = { key: string; label: string; total: number }
export type IncomeStream = { businessId: string | null; businessName: string; color: string; income: number }
export type IncomeReviewResult = {
  periods: IncomePeriod[]
  streams: IncomeStream[]
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
        const periodKey = granularity === "month" ? tx.occurred_on.slice(0, 7) : tx.occurred_on.slice(0, 4)
        const period = periodMap.get(periodKey)
        if (period) period.total += Number(tx.amount)

        const stream = streamMap.get(tx.business_id ?? null) ?? streamMap.get(null)!
        stream.income += Number(tx.amount)
      }

      const periods = periodKeys.map((k) => periodMap.get(k)!)
      const streams: IncomeStream[] = [...BUSINESSES.map((b) => streamMap.get(b.id)!), streamMap.get(null)!]
      const total = periods.reduce((acc, p) => acc + p.total, 0)

      return { periods, streams, total }
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
