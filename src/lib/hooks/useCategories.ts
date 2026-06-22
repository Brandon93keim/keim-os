"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listCategories,
  createCategory,
  updateCategory as updateCategoryQuery,
  deleteCategory as deleteCategoryQuery,
} from "@/lib/queries/finance"
import type { CategoryInput } from "@/lib/finance/types"

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CategoryInput) => createCategory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      toast.success("Category created")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create category")
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryInput }) =>
      updateCategoryQuery(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      toast.success("Category saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save category")
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCategoryQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["business-pnl"] })
      toast.success("Category deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete category")
    },
  })
}
