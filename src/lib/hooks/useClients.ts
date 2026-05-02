"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listClients,
  getClient,
  createClient_,
  updateClient as updateClientQuery,
  archiveClient as archiveClientQuery,
  unarchiveClient as unarchiveClientQuery,
  deleteClient as deleteClientQuery,
  type Client,
} from "@/lib/queries/clients"
import type { ClientFormValues } from "@/lib/validations/client"

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: () => getClient(id),
    enabled: !!id,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ClientFormValues) => createClient_(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      toast.success("Client saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save client")
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ClientFormValues }) =>
      updateClientQuery(id, values),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      queryClient.invalidateQueries({ queryKey: ["clients", id] })
      toast.success("Client saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save client")
    },
  })
}

export function useArchiveClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveClientQuery(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["clients"] })
      const previous = queryClient.getQueryData<Client[]>(["clients"])
      queryClient.setQueryData<Client[]>(["clients"], (old) =>
        old?.map((c) => (c.id === id ? { ...c, status: "archived" } : c)) ?? []
      )
      queryClient.setQueryData<Client>(["clients", id], (old) =>
        old ? { ...old, status: "archived" } : old
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["clients"], context.previous)
      }
      toast.error("Failed to archive client")
    },
    onSuccess: () => {
      toast.success("Client archived")
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      queryClient.invalidateQueries({ queryKey: ["clients", id] })
    },
  })
}

export function useUnarchiveClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unarchiveClientQuery(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["clients"] })
      const previous = queryClient.getQueryData<Client[]>(["clients"])
      queryClient.setQueryData<Client[]>(["clients"], (old) =>
        old?.map((c) => (c.id === id ? { ...c, status: "prospect" } : c)) ?? []
      )
      queryClient.setQueryData<Client>(["clients", id], (old) =>
        old ? { ...old, status: "prospect" } : old
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["clients"], context.previous)
      }
      toast.error("Failed to unarchive client")
    },
    onSuccess: () => {
      toast.success("Client unarchived")
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      queryClient.invalidateQueries({ queryKey: ["clients", id] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClientQuery(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      queryClient.removeQueries({ queryKey: ["clients", id] })
      toast.success("Client deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete client")
    },
  })
}
