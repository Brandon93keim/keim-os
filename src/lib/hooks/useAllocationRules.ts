"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listAllocationRules,
  createAllocationRule,
  updateAllocationRule as updateAllocationRuleQuery,
  deleteAllocationRule as deleteAllocationRuleQuery,
} from "@/lib/queries/finance"
import type { AllocationRuleFormValues } from "@/lib/finance/schemas"

export function useAllocationRules() {
  return useQuery({
    queryKey: ["allocation-rules"],
    queryFn: listAllocationRules,
  })
}

export function useCreateAllocationRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: AllocationRuleFormValues) => createAllocationRule(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation-rules"] })
      toast.success("Rule added")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to add rule")
    },
  })
}

export function useUpdateAllocationRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: AllocationRuleFormValues }) =>
      updateAllocationRuleQuery(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation-rules"] })
      toast.success("Rule saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save rule")
    },
  })
}

export function useDeleteAllocationRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAllocationRuleQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation-rules"] })
      toast.success("Rule deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete rule")
    },
  })
}
