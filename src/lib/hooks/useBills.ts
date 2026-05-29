"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listBills,
  listRecentBillPayments,
  listBillPaymentsForPeriod,
  createBill as createBillQuery,
  updateBill as updateBillQuery,
  setBillActive as setBillActiveQuery,
  deleteBill as deleteBillQuery,
  recordBillPayment as recordBillPaymentQuery,
} from "@/lib/queries/bills"
import type { RecordBillPaymentContext } from "@/lib/queries/bills"
import type { BillFormValues, BillPaymentFormValues } from "@/lib/finance/schemas"
import { getMonthBounds } from "@/lib/finance/format"

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

export type CommittedOutflowsResult = {
  total: number
  paid: number
  remaining: number
  variableCount: number
  byBusiness: Array<{
    businessId: string | null
    amount: number
    variableCount: number
  }>
}

export function useCommittedOutflowsThisMonth() {
  const today = new Date().toISOString().split("T")[0]
  const yyyyMM = today.slice(0, 7)
  const { monthStart, monthEnd } = getMonthBounds(today)

  return useQuery<CommittedOutflowsResult>({
    queryKey: ["committed-outflows", yyyyMM],
    queryFn: async () => {
      const [bills, payments] = await Promise.all([
        listBills(),
        listBillPaymentsForPeriod(monthStart, monthEnd),
      ])

      const billMap = new Map(bills.map((b) => [b.id, b]))
      const buckets = new Map<string, { amount: number; variableCount: number }>()

      function ensureBucket(key: string) {
        if (!buckets.has(key)) buckets.set(key, { amount: 0, variableCount: 0 })
        return buckets.get(key)!
      }

      let paid = 0
      for (const payment of payments) {
        const amt = Number(payment.amount)
        paid += amt
        const bill = billMap.get(payment.bill_id)
        const key = bill?.business_id ?? "__personal__"
        ensureBucket(key).amount += amt
      }

      let remaining = 0
      let variableCount = 0
      for (const bill of bills) {
        const d = bill.next_due_date
        if (!d || d < monthStart || d > monthEnd) continue
        const key = bill.business_id ?? "__personal__"
        if (bill.default_amount != null) {
          const amt = Number(bill.default_amount)
          remaining += amt
          ensureBucket(key).amount += amt
        } else {
          variableCount++
          ensureBucket(key).variableCount++
        }
      }

      const byBusiness = Array.from(buckets.entries())
        .filter(([, v]) => v.amount !== 0 || v.variableCount !== 0)
        .sort(([, a], [, b]) => b.amount - a.amount)
        .map(([key, v]) => ({
          businessId: key === "__personal__" ? null : key,
          amount: v.amount,
          variableCount: v.variableCount,
        }))

      return { total: paid + remaining, paid, remaining, variableCount, byBusiness }
    },
  })
}

export function useCreateBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: BillFormValues) => createBillQuery(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] })
      queryClient.invalidateQueries({ queryKey: ["committed-outflows"] })
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
      queryClient.invalidateQueries({ queryKey: ["committed-outflows"] })
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
      queryClient.invalidateQueries({ queryKey: ["committed-outflows"] })
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
      queryClient.invalidateQueries({ queryKey: ["committed-outflows"] })
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
      queryClient.invalidateQueries({ queryKey: ["committed-outflows"] })
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["business-pnl"] })
      toast.success("Payment recorded")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to record payment")
    },
  })
}
