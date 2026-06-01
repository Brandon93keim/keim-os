"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listTasks,
  createTask,
  updateTask as updateTaskQuery,
  toggleTaskStatus as toggleTaskStatusQuery,
  deleteTask as deleteTaskQuery,
  type TaskWithRelations,
} from "@/lib/queries/tasks"

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: listTasks,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Task created")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create task")
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string
      values: Parameters<typeof updateTaskQuery>[1]
    }) => updateTaskQuery(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Task saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save task")
    },
  })
}

export function useToggleTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      toggleTaskStatusQuery(id, done),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update task")
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTaskQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Task deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete task")
    },
  })
}

export type { TaskWithRelations }
