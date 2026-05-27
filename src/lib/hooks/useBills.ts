"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listBills,
  listRecentBillPayments,
  createBill as createBillQuery,
  updateBill as updateBillQuery,
  setBillActive as setBillActiveQuery,
  deleteBill as deleteBillQuery,
  recordBillPayment as recordBillPaymentQuery,
} from "@/lib/queries/bills"
import type { RecordBillPaymentContext } from "@/lib/queries/bills"
import type { BillFormValues, BillPaymentFormValues } from "@/lib/finance/schemas"

export function useBills() {
  return useQuery({
    queryKey: ["bills"],
    queryFn: listBills,
  })
}

export function useRecentBillPayments(daysBack: number) {
  return useQuery({
    queryKey: ["bill-payments", daysBack],
    queryFn: () => listRecentBillPayments(daysBack),
  })
}

export function useCreateBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: BillFormValues) => createBillQuery(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] })
      toast.success("Bill created")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create bill")
    },
  })
}

export function useUpdateBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: BillFormValues }) =>
      updateBillQuery(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] })
      toast.success("Bill saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save bill")
    },
  })
}

export function useSetBillActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      setBillActiveQuery(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update bill")
    },
  })
}

export function useDeleteBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBillQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] })
      queryClient.invalidateQueries({ queryKey: ["bill-payments"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      toast.success("Bill deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete bill")
    },
  })
}

export function useRecordBillPayment(ctx: RecordBillPaymentContext) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: BillPaymentFormValues) => recordBillPaymentQuery(ctx, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] })
      queryClient.invalidateQueries({ queryKey: ["bill-payments"] })
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      toast.success("Payment recorded")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to record payment")
    },
  })
}
