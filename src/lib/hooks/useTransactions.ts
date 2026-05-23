"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listTransactions,
  createTransaction,
  updateTransaction as updateTransactionQuery,
  deleteTransaction as deleteTransactionQuery,
  type TransactionFilters,
} from "@/lib/queries/finance"
import type { TransactionFormValues } from "@/lib/finance/schemas"

const INVALIDATE_KEYS = ["transactions", "accounts"] as const

export function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => listTransactions(filters),
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
      toast.success("Transaction deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete transaction")
    },
  })
}
