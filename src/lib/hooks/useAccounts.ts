"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listAccounts,
  listAllAccounts,
  createAccount,
  updateAccount as updateAccountQuery,
  setAccountActive as setAccountActiveQuery,
  deleteAccount as deleteAccountQuery,
} from "@/lib/queries/finance"
import type { AccountFormValues } from "@/lib/finance/schemas"

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  })
}

export function useAllAccounts() {
  return useQuery({
    queryKey: ["accounts", "all"],
    queryFn: listAllAccounts,
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: AccountFormValues) => createAccount(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      toast.success("Account created")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create account")
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: AccountFormValues }) =>
      updateAccountQuery(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      toast.success("Account saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save account")
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAccountQuery(id),
    onSuccess: () => {
      // The RPC removes the account's transactions too, so refresh the ledger
      // and P&L caches alongside accounts.
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["business-pnl"] })
      toast.success("Account deleted")
    },
    onError: (err: Error) => {
      // Show the RPC's message verbatim — it explains why a delete was blocked.
      toast.error(err.message ?? "Failed to delete account")
    },
  })
}

export function useSetAccountActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      setAccountActiveQuery(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update account")
    },
  })
}
