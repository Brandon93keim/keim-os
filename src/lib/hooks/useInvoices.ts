"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice as updateInvoiceQuery,
  deleteInvoice as deleteInvoiceQuery,
  markInvoiceSent as markInvoiceSentQuery,
  markInvoiceCancelled as markInvoiceCancelledQuery,
  markInvoiceVoid as markInvoiceVoidQuery,
  recordPayment as recordPaymentQuery,
  deletePayment as deletePaymentQuery,
  listJobsForClientAndBusiness,
} from "@/lib/queries/invoices"
import { getUnbilledJobs, isEventBilled } from "@/lib/queries/jobs"
import type { InvoiceFormValues, PaymentFormValues } from "@/lib/validations/invoice"

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: listInvoices,
  })
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: () => getInvoice(id!),
    enabled: !!id,
  })
}

export function useJobsForLineItem(clientId: string | null, businessId: string | null) {
  return useQuery({
    queryKey: ["jobs-for-line-item", clientId, businessId],
    queryFn: () => listJobsForClientAndBusiness(clientId!, businessId!),
    enabled: !!clientId && !!businessId,
  })
}

export function useUnbilledJobs() {
  return useQuery({
    queryKey: ["unbilled-jobs"],
    queryFn: getUnbilledJobs,
    staleTime: 30_000,
  })
}

export function useIsEventBilled(eventId: string | null) {
  return useQuery({
    queryKey: ["is-event-billed", eventId],
    queryFn: () => isEventBilled(eventId!),
    enabled: !!eventId,
    staleTime: 30_000,
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: InvoiceFormValues) => createInvoice(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["is-event-billed"] })
      toast.success("Invoice created")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create invoice")
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: InvoiceFormValues }) =>
      updateInvoiceQuery(id, values),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoices", id] })
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["is-event-billed"] })
      toast.success("Invoice saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save invoice")
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvoiceQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["is-event-billed"] })
      toast.success("Invoice deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete invoice")
    },
  })
}

export function useMarkInvoiceSent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markInvoiceSentQuery(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoices", id] })
      toast.success("Invoice marked as sent")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update invoice")
    },
  })
}

export function useMarkInvoiceCancelled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markInvoiceCancelledQuery(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoices", id] })
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["is-event-billed"] })
      toast.success("Invoice cancelled")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to cancel invoice")
    },
  })
}

export function useMarkInvoiceVoid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markInvoiceVoidQuery(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoices", id] })
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["is-event-billed"] })
      toast.success("Invoice voided")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to void invoice")
    },
  })
}

export function useRecordPayment(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: PaymentFormValues) => recordPaymentQuery(invoiceId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId] })
      toast.success("Payment recorded")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to record payment")
    },
  })
}

export function useDeletePayment(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (paymentId: string) => deletePaymentQuery(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId] })
      toast.success("Payment removed")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete payment")
    },
  })
}
