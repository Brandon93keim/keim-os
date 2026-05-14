"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listJobs,
  getJob,
  createJob,
  updateJob as updateJobQuery,
  deleteJob as deleteJobQuery,
  type Job,
} from "@/lib/queries/jobs"

export function useJobs(filters?: {
  business_id?: string
  client_id?: string
  status?: Job["status"]
}) {
  return useQuery({
    queryKey: ["jobs", filters],
    queryFn: () => listJobs(filters),
  })
}

export function useJob(id: string | null) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => getJob(id!),
    enabled: !!id,
  })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: Parameters<typeof createJob>[0]) => createJob(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["is-job-billed"] })
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("Job created")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create job")
    },
  })
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Parameters<typeof updateJobQuery>[1] }) =>
      updateJobQuery(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["is-job-billed"] })
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("Job saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save job")
    },
  })
}

export function useDeleteJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteJobQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["is-job-billed"] })
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("Job deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete job")
    },
  })
}

export type { Job }
