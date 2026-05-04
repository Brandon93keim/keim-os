"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  listEventsBetween,
  getEvent,
  createEvent,
  updateEvent as updateEventQuery,
  deleteEvent as deleteEventQuery,
  updateEventStatus as updateEventStatusQuery,
  type CalEvent,
} from "@/lib/queries/events"
import type { EventFormValues } from "@/lib/validations/event"

export function useEventsBetween(start: Date, end: Date) {
  return useQuery({
    queryKey: ["events", start.toISOString(), end.toISOString()],
    queryFn: () => listEventsBetween(start, end),
  })
}

export function useEvent(id: string | null) {
  return useQuery({
    queryKey: ["events", id],
    queryFn: () => getEvent(id!),
    enabled: !!id,
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: EventFormValues) => createEvent(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("Event created")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create event")
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: EventFormValues }) =>
      updateEventQuery(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("Event saved")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save event")
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEventQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("Event deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete event")
    },
  })
}

export function useUpdateEventStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateEventStatusQuery(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update event status")
    },
  })
}

export type { CalEvent }
