"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listBills,
  listRecentBillPayments,
  recordBillPayment as recordBillPaymentQuery,
} from "@/lib/queries/bills"
import type { RecordBillPaymentContext } from "@/lib/queries/bills"
import type { BillPaymentFormValues } from "@/lib/finance/schemas"

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
