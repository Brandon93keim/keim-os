"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getMileageSettings,
  saveHomeAddress,
  listTrips,
  createManualTrip,
  updateTrip,
  deleteTrip,
  syncTripsFromCalendar,
  type MileageTrip,
  type ManualTripValues,
  type TripUpdateValues,
  type SyncProgress,
} from "@/lib/queries/mileage"

export function useMileageSettings() {
  return useQuery({ queryKey: ["mileage", "settings"], queryFn: getMileageSettings })
}

export function useSaveHomeAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveHomeAddress,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mileage"] })
      toast.success("Home address saved")
    },
    onError: (err: Error) => toast.error(err.message ?? "Couldn't save address"),
  })
}

export function useTrips(from: string, to: string) {
  return useQuery({ queryKey: ["mileage", "trips", from, to], queryFn: () => listTrips(from, to) })
}

export function useCreateManualTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: ManualTripValues) => createManualTrip(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mileage", "trips"] })
      toast.success("Trip added")
    },
    onError: (err: Error) => toast.error(err.message ?? "Couldn't add trip"),
  })
}

export function useUpdateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ trip, values }: { trip: MileageTrip; values: TripUpdateValues }) =>
      updateTrip(trip.id, values, trip),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mileage", "trips"] })
      toast.success("Trip saved")
    },
    onError: (err: Error) => toast.error(err.message ?? "Couldn't save trip"),
  })
}

export function useDeleteTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTrip(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mileage", "trips"] })
      toast.success("Trip deleted")
    },
    onError: (err: Error) => toast.error(err.message ?? "Couldn't delete trip"),
  })
}

export function useSyncTrips(onProgress?: (p: SyncProgress) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => syncTripsFromCalendar(from, to, onProgress),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["mileage", "trips"] })
      toast.success(
        `Synced ${r.trips} trip${r.trips === 1 ? "" : "s"} over ${r.days} day${r.days === 1 ? "" : "s"}` +
          (r.review ? `, ${r.review} to review` : "")
      )
    },
    onError: (err: Error) => toast.error(err.message ?? "Sync failed"),
  })
}

export type { MileageTrip, SyncProgress }
