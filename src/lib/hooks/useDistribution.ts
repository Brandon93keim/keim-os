"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getDistribution,
  createDistribution as createDistributionQuery,
  undoDistribution as undoDistributionQuery,
  type DistributionLine,
} from "@/lib/queries/finance"

const INVALIDATE_KEYS = ["transactions", "accounts"] as const

export function useDistribution(incomeId: string) {
  return useQuery({
    queryKey: ["distribution", incomeId],
    queryFn: () => getDistribution(incomeId),
    enabled: !!incomeId,
  })
}

export function useCreateDistribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      income,
      lines,
    }: {
      income: { id: string; account_id: string; occurred_on: string }
      lines: DistributionLine[]
    }) => createDistributionQuery(income, lines),
    onSuccess: (_data, { income }) => {
      INVALIDATE_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
      queryClient.invalidateQueries({ queryKey: ["distribution", income.id] })
      toast.success("Funds distributed")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to distribute")
    },
  })
}

export function useUndoDistribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (incomeId: string) => undoDistributionQuery(incomeId),
    onSuccess: (_data, incomeId) => {
      INVALIDATE_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
      queryClient.invalidateQueries({ queryKey: ["distribution", incomeId] })
      toast.success("Distribution undone")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to undo distribution")
    },
  })
}
