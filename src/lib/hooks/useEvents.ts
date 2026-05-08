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
  updateRecurringSingle as updateRecurringSingleQuery,
  updateRecurringFollowing as updateRecurringFollowingQuery,
  updateRecurringAll as updateRecurringAllQuery,
  deleteRecurringSingle as deleteRecurringSingleQuery,
  deleteRecurringFollowing as deleteRecurringFollowingQuery,
  deleteRecurringAll as deleteRecurringAllQuery,
  type CalendarEvent,
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
    // Full composite id is the cache key so different instances cache separately.
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
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
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
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
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
      queryClient.invalidateQueries({ queryKey: ["unbilled-jobs"] })
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

export function useUpdateRecurringSingle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ masterId, occurrenceDate, values }: { masterId: string; occurrenceDate: Date; values: EventFormValues }) =>
      updateRecurringSingleQuery(masterId, occurrenceDate, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("Occurrence updated")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update occurrence")
    },
  })
}

export function useUpdateRecurringFollowing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ masterId, occurrenceDate, values }: { masterId: string; occurrenceDate: Date; values: EventFormValues }) =>
      updateRecurringFollowingQuery(masterId, occurrenceDate, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("This and following occurrences updated")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update occurrences")
    },
  })
}

export function useUpdateRecurringAll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ masterId, values }: { masterId: string; values: EventFormValues }) =>
      updateRecurringAllQuery(masterId, values),
    onSuccess: ({ clearedCount }) => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("All occurrences updated")
      if (clearedCount > 0) {
        toast.info(`Cleared ${clearedCount} exception${clearedCount === 1 ? "" : "s"}`)
      }
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update series")
    },
  })
}

export function useDeleteRecurringSingle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ masterId, occurrenceDate }: { masterId: string; occurrenceDate: Date }) =>
      deleteRecurringSingleQuery(masterId, occurrenceDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("Occurrence deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete occurrence")
    },
  })
}

export function useDeleteRecurringFollowing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ masterId, occurrenceDate }: { masterId: string; occurrenceDate: Date }) =>
      deleteRecurringFollowingQuery(masterId, occurrenceDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("This and following occurrences deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete occurrences")
    },
  })
}

export function useDeleteRecurringAll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (masterId: string) => deleteRecurringAllQuery(masterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] })
      toast.success("Series deleted")
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete series")
    },
  })
}

export type { CalendarEvent, CalEvent }
