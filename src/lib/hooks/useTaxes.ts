"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { TablesUpdate } from "@/types/database"
import {
  getTaxSettings,
  updateTaxSettings,
  listTaxPayments,
  recordTaxPayment,
  deleteTaxPayment,
  getTaxBase,
  type RecordTaxPaymentValues,
  type TaxPayment,
} from "@/lib/queries/taxes"

export function useTaxSettings(year: number) {
  return useQuery({ queryKey: ["taxes", "settings", year], queryFn: () => getTaxSettings(year) })
}

export function useUpdateTaxSettings(year: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: TablesUpdate<"tax_settings">) => updateTaxSettings(year, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taxes", "settings", year] }),
    onError: (err: Error) => toast.error(err.message ?? "Couldn't save"),
  })
}

export function useTaxPayments(year: number) {
  return useQuery({ queryKey: ["taxes", "payments", year], queryFn: () => listTaxPayments(year) })
}

export function useRecordTaxPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: RecordTaxPaymentValues) => recordTaxPayment(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taxes"] })
      qc.invalidateQueries({ queryKey: ["accounts"] })
      qc.invalidateQueries({ queryKey: ["transactions"] })
      toast.success("Payment logged")
    },
    onError: (err: Error) => toast.error(err.message ?? "Couldn't log payment"),
  })
}

export function useDeleteTaxPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: TaxPayment) => deleteTaxPayment(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taxes"] })
      qc.invalidateQueries({ queryKey: ["accounts"] })
      toast.success("Payment removed")
    },
    onError: (err: Error) => toast.error(err.message ?? "Couldn't remove payment"),
  })
}

export function useTaxBase(year: number, to: string) {
  return useQuery({ queryKey: ["taxes", "base", year, to], queryFn: () => getTaxBase(year, to) })
}
