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
  listEventsMissingLocation,
  setEventLocation,
  checkInAtEvent,
  getRoundTripMiles,
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

export function useEventsMissingLocation(from: string, to: string) {
  return useQuery({
    queryKey: ["mileage", "missing-location", from, to],
    queryFn: () => listEventsMissingLocation(from, to),
  })
}

export function useSetEventLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, location }: { id: string; location: string }) => setEventLocation(id, location),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mileage", "missing-location"] })
      qc.invalidateQueries({ queryKey: ["events"] })
    },
    onError: (err: Error) => toast.error(err.message ?? "Couldn't save location"),
  })
}

/** Ask the phone for its location once. Resolves with lat/lng or rejects with a readable message. */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device can't share its location."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked. Allow location for this app in Settings › Safari (or your browser) and try again."
              : "Couldn't get your location. Try again with a clear view of the sky."
          )
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    )
  })
}

export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (event: { id: string; start_time: string; location: string | null }) => {
      const pos = await getCurrentPosition()
      return checkInAtEvent(event, pos)
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["mileage"] })
      qc.invalidateQueries({ queryKey: ["taxes"] })
      toast.success(`Checked in · ${r.roundtripMiles} mi round trip from home`)
    },
    onError: (err: Error) => toast.error(err.message ?? "Check-in failed"),
  })
}

export function useRoundTripMiles(eventIds: string[]) {
  const key = [...eventIds].sort()
  return useQuery({
    queryKey: ["mileage", "roundtrip", key],
    queryFn: () => getRoundTripMiles(key),
    enabled: key.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export type { MileageTrip, SyncProgress }
