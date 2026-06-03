"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listLineItemTemplates,
  listAllLineItemTemplates,
  createLineItemTemplate,
  updateLineItemTemplate as updateLineItemTemplateQuery,
  deleteLineItemTemplate as deleteLineItemTemplateQuery,
  type LineItemTemplateInsert,
  type LineItemTemplateUpdate,
} from "@/lib/queries/lineItemTemplates"

export function useLineItemTemplates(businessId: string | null) {
  return useQuery({
    queryKey: ["lineItemTemplates", businessId],
    queryFn: () => listLineItemTemplates(businessId),
  })
}

export function useAllLineItemTemplates() {
  return useQuery({
    queryKey: ["lineItemTemplates", "all"],
    queryFn: listAllLineItemTemplates,
  })
}

export function useCreateLineItemTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: Omit<LineItemTemplateInsert, "user_id">) =>
      createLineItemTemplate(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineItemTemplates"] })
      toast.success("Template added")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to add template")
    },
  })
}

export function useUpdateLineItemTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: LineItemTemplateUpdate }) =>
      updateLineItemTemplateQuery(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineItemTemplates"] })
      toast.success("Template saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save template")
    },
  })
}

export function useDeleteLineItemTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteLineItemTemplateQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineItemTemplates"] })
      toast.success("Template deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete template")
    },
  })
}
