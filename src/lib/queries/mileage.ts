import { createClient } from "@/lib/supabase/client"
import type { Tables, TablesUpdate } from "@/types/database"
import { getBusinessById } from "@/lib/constants"
import {
  allocate,
  METERS_PER_MILE,
  normalizeLocation,
  routePoints,
  type LatLng,
  type PlanStop,
} from "@/lib/mileage/plan"

export type MileageTrip = Tables<"mileage_trips">
export type MileageSettings = Tables<"mileage_settings">

const TZ = "America/Chicago"
// Calendar event types that count as business driving.
const BUSINESS_EVENT_TYPES = ["job", "meeting"]
// Nominatim allows ~1 request/second.
const GEOCODE_DELAY_MS = 1100

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

function localDate(iso: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso))
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ------------------------------------------------------------
// Settings
// ------------------------------------------------------------

export async function getMileageSettings(): Promise<MileageSettings | null> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("mileage_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function geocodeAddress(
  q: string
): Promise<{ lat: number; lng: number; label: string; approximate: boolean } | null> {
  const res = await fetch(`/api/mileage/geocode?q=${encodeURIComponent(q)}`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Address lookup failed")
  return body.found ? body : null
}

export async function saveHomeAddress(address: string): Promise<MileageSettings> {
  const supabase = createClient()
  const userId = await getUserId()
  const hit = await geocodeAddress(address)
  if (!hit) throw new Error("Couldn't find that address. Try adding the city and ZIP.")
  if (hit.approximate) throw new Error("That only matched a city. Enter the full street address.")
  const { data, error } = await supabase
    .from("mileage_settings")
    .upsert({ user_id: userId, home_address: address.trim(), home_lat: hit.lat, home_lng: hit.lng })
    .select("*")
    .single()
  if (error) throw error
  return data
}

// ------------------------------------------------------------
// Trips
// ------------------------------------------------------------

export async function listTrips(from: string, to: string): Promise<MileageTrip[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("mileage_trips")
    .select("*")
    .eq("user_id", userId)
    .gte("trip_date", from)
    .lte("trip_date", to)
    .order("trip_date", { ascending: false })
    .order("created_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

export type ManualTripValues = {
  trip_date: string
  business_id: string | null
  purpose: string
  destination: string
  miles: number
  notes?: string | null
}

export async function createManualTrip(values: ManualTripValues): Promise<MileageTrip> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("mileage_trips")
    .insert({
      user_id: userId,
      ...values,
      notes: values.notes ?? null,
      from_label: "Home",
      includes_return: true,
      source: "manual",
      status: "ok",
      miles_overridden: true,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export type TripUpdateValues = Partial<
  Pick<MileageTrip, "miles" | "purpose" | "destination" | "business_id" | "status" | "notes" | "trip_date">
>

export async function updateTrip(id: string, values: TripUpdateValues, prev: MileageTrip): Promise<MileageTrip> {
  const supabase = createClient()
  const patch: TablesUpdate<"mileage_trips"> = { ...values }
  // Editing miles by hand locks them so a calendar sync won't overwrite your number.
  if (values.miles != null && Number(values.miles) !== Number(prev.miles)) patch.miles_overridden = true
  // Confirming a flagged trip clears the flag and locks its miles as reviewed.
  if (values.status === "ok" && prev.status !== "ok") {
    patch.review_reason = null
    patch.miles_overridden = true
  }
  const { data, error } = await supabase
    .from("mileage_trips")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deleteTrip(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("mileage_trips").delete().eq("id", id)
  if (error) throw error
}

// ------------------------------------------------------------
// Sync from calendar
// ------------------------------------------------------------

export type SyncProgress = { phase: "addresses" | "routes" | "saving"; done: number; total: number }

export type SyncResult = {
  days: number
  trips: number
  review: number
  removed: number
}

type GeoHit = { coord: LatLng | null; approximate: boolean }

async function resolveLocations(
  userId: string,
  locations: string[],
  onProgress?: (p: SyncProgress) => void
): Promise<Map<string, GeoHit>> {
  const supabase = createClient()
  const keys = [...new Set(locations.map(normalizeLocation))]
  const result = new Map<string, GeoHit>()

  const { data: cached, error } = await supabase
    .from("geocode_cache")
    .select("*")
    .eq("user_id", userId)
    .in("query", keys.length ? keys : ["__none__"])
  if (error) throw error
  for (const c of cached ?? []) {
    result.set(c.query, {
      coord: c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null,
      approximate: c.precision === "approximate",
    })
  }

  const missing = keys.filter((k) => !result.has(k))
  for (let i = 0; i < missing.length; i++) {
    onProgress?.({ phase: "addresses", done: i, total: missing.length })
    const q = missing[i]
    let hit: Awaited<ReturnType<typeof geocodeAddress>> = null
    try {
      hit = await geocodeAddress(q)
    } catch {
      // Provider hiccup: don't cache a failure, just skip this place for now.
      result.set(q, { coord: null, approximate: false })
      if (i < missing.length - 1) await sleep(GEOCODE_DELAY_MS)
      continue
    }
    const row = {
      user_id: userId,
      query: q,
      lat: hit?.lat ?? null,
      lng: hit?.lng ?? null,
      label: hit?.label ?? null,
      precision: (hit ? (hit.approximate ? "approximate" : "exact") : "failed") as
        | "exact"
        | "approximate"
        | "failed",
    }
    await supabase.from("geocode_cache").upsert(row, { onConflict: "user_id,query" })
    result.set(q, { coord: hit ? { lat: hit.lat, lng: hit.lng } : null, approximate: !!hit?.approximate })
    if (i < missing.length - 1) await sleep(GEOCODE_DELAY_MS)
  }
  onProgress?.({ phase: "addresses", done: missing.length, total: missing.length })
  return result
}

async function routeMiles(points: LatLng[]): Promise<number[]> {
  const res = await fetch("/api/mileage/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Route lookup failed")
  return (body.legsMeters as number[]).map((m) => m / METERS_PER_MILE)
}

/**
 * Build or refresh auto trips from calendar job/meeting events between `from` and `to`
 * (inclusive local dates). Trips you edited by hand (miles locked) or excluded are kept.
 */
export async function syncTripsFromCalendar(
  from: string,
  to: string,
  onProgress?: (p: SyncProgress) => void
): Promise<SyncResult> {
  const supabase = createClient()
  const userId = await getUserId()
  const settings = await getMileageSettings()
  if (!settings) throw new Error("Set your home address first.")
  const home: LatLng = { lat: settings.home_lat, lng: settings.home_lng }

  // Pull a padded UTC window, then filter to local dates.
  const { data: rawEvents, error: evErr } = await supabase
    .from("events")
    .select("id, title, location, business_id, job_id, start_time, status, type, rrule, arrived_lat, arrived_lng")
    .eq("user_id", userId)
    .in("type", BUSINESS_EVENT_TYPES)
    .neq("status", "cancelled")
    .is("rrule", null)
    .not("business_id", "is", null)
    .gte("start_time", shiftDate(from, -1) + "T00:00:00Z")
    .lt("start_time", shiftDate(to, 2) + "T00:00:00Z")
    .order("start_time", { ascending: true })
  if (evErr) throw evErr

  const events = (rawEvents ?? [])
    .map((e) => ({ ...e, date: localDate(e.start_time) }))
    .filter((e) => e.date >= from && e.date <= to && e.location && e.location.trim())

  const { data: existingRows, error: exErr } = await supabase
    .from("mileage_trips")
    .select("*")
    .eq("user_id", userId)
    .eq("source", "auto")
    .gte("trip_date", from)
    .lte("trip_date", to)
  if (exErr) throw exErr
  const existing = existingRows ?? []
  const byEvent = new Map(existing.filter((t) => t.event_id).map((t) => [t.event_id as string, t]))

  // Events you marked "not business" stay out of the day's route.
  const routable = events.filter((e) => byEvent.get(e.id)?.status !== "excluded")

  // Events you checked in at already have an exact GPS spot; only look up the rest.
  const geo = await resolveLocations(
    userId,
    routable.filter((e) => e.arrived_lat == null).map((e) => e.location as string),
    onProgress
  )

  // Group by day, keep calendar order.
  const days = new Map<string, typeof routable>()
  for (const e of routable) {
    const list = days.get(e.date) ?? []
    list.push(e)
    days.set(e.date, list)
  }

  type Row = {
    event: (typeof routable)[number]
    planned: ReturnType<typeof allocate>[number]
  }
  const rows: Row[] = []
  let dayIdx = 0
  for (const [, dayEvents] of days) {
    onProgress?.({ phase: "routes", done: dayIdx++, total: days.size })

    // Several events at the same place in a row (e.g. two depos in one office) = one stop.
    const stops: PlanStop[] = []
    const sameAsPrev = new Map<string, string>() // eventId -> eventId of the stop it shares
    for (const e of dayEvents) {
      const key = normalizeLocation(e.location as string)
      const prev = stops[stops.length - 1]
      if (prev && normalizeLocation(prev.location) === key) {
        sameAsPrev.set(e.id, prev.key)
        continue
      }
      const hit =
        e.arrived_lat != null && e.arrived_lng != null
          ? { coord: { lat: e.arrived_lat, lng: e.arrived_lng }, approximate: false }
          : geo.get(key) ?? { coord: null, approximate: false }
      stops.push({ key: e.id, location: e.location as string, coord: hit.coord, approximate: hit.approximate })
    }

    let planned: ReturnType<typeof allocate>
    const points = routePoints(home, stops)
    try {
      const legs = points.length >= 3 ? await routeMiles(points) : []
      planned = stops.some((s) => s.coord) ? allocate(stops, legs) : allocate(stops, [0])
    } catch (err) {
      // Router down: flag the day rather than writing zeros as if they were real.
      planned = stops.map((s) => ({
        key: s.key,
        fromLabel: "Home",
        includesReturn: false,
        miles: 0,
        status: "review" as const,
        reviewReason: `Couldn't calculate the route (${(err as Error).message}). Try syncing again.`,
      }))
    }
    const plannedByKey = new Map(planned.map((p) => [p.key, p]))
    for (const e of dayEvents) {
      const shared = sameAsPrev.get(e.id)
      const p = shared
        ? { ...plannedByKey.get(shared)!, key: e.id, miles: 0, includesReturn: false, status: "ok" as const, reviewReason: null, fromLabel: (e.location as string).trim() }
        : plannedByKey.get(e.id)!
      rows.push({ event: e, planned: p })
    }
  }

  onProgress?.({ phase: "saving", done: 0, total: rows.length })

  let written = 0
  let review = 0
  for (const { event, planned } of rows) {
    const prev = byEvent.get(event.id)
    const businessName = getBusinessById(event.business_id as string)?.name
    const base = {
      trip_date: event.date,
      business_id: event.business_id,
      job_id: event.job_id,
      purpose: businessName ? `${event.title} (${businessName})` : event.title,
      destination: (event.location as string).trim(),
      from_label: planned.fromLabel,
      includes_return: planned.includesReturn,
    }
    if (prev) {
      const patch: TablesUpdate<"mileage_trips"> = { ...base }
      // Trips you edited or confirmed are locked; only refresh untouched ones.
      if (!prev.miles_overridden) {
        patch.miles = planned.miles
        patch.status = planned.status
        patch.review_reason = planned.reviewReason
      }
      const { error } = await supabase.from("mileage_trips").update(patch).eq("id", prev.id)
      if (error) throw error
      if ((patch.status ?? prev.status) === "review") review++
    } else {
      const { error } = await supabase.from("mileage_trips").insert({
        user_id: userId,
        event_id: event.id,
        source: "auto",
        miles: planned.miles,
        status: planned.status,
        review_reason: planned.reviewReason,
        ...base,
      })
      if (error) throw error
      if (planned.status === "review") review++
    }
    written++
  }

  // Remove auto trips whose event was deleted, cancelled, moved out of range, or lost its location.
  // Trips you excluded or edited by hand are never auto-deleted.
  const keepIds = new Set(rows.map((r) => r.event.id))
  const stale = existing.filter(
    (t) =>
      t.status !== "excluded" &&
      !t.miles_overridden &&
      !(t.event_id && keepIds.has(t.event_id))
  )
  if (stale.length) {
    const { error } = await supabase.from("mileage_trips").delete().in("id", stale.map((t) => t.id))
    if (error) throw error
  }
  const removed = stale.length

  return { days: days.size, trips: written, review, removed }
}

// ------------------------------------------------------------
// Business events with no location (they can't be routed)
// ------------------------------------------------------------

export type EventMissingLocation = {
  id: string
  title: string
  date: string
  business_id: string | null
}

export async function listEventsMissingLocation(from: string, to: string): Promise<EventMissingLocation[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("events")
    .select("id, title, start_time, business_id, location")
    .eq("user_id", userId)
    .in("type", BUSINESS_EVENT_TYPES)
    .neq("status", "cancelled")
    .is("rrule", null)
    .not("business_id", "is", null)
    .gte("start_time", shiftDate(from, -1) + "T00:00:00Z")
    .lt("start_time", shiftDate(to, 2) + "T00:00:00Z")
    .order("start_time", { ascending: false })
  if (error) throw error
  return (data ?? [])
    .filter((e) => !e.location || !e.location.trim())
    .map((e) => ({ id: e.id, title: e.title, date: localDate(e.start_time), business_id: e.business_id }))
    .filter((e) => e.date >= from && e.date <= to)
}

/** Set an event's location (edits the calendar event itself). */
export async function setEventLocation(eventId: string, location: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("events").update({ location: location.trim() }).eq("id", eventId)
  if (error) throw error
}

// ------------------------------------------------------------
// "I'm here" check-in + round-trip miles for invoices
// ------------------------------------------------------------

async function reverseAddress(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/mileage/reverse?lat=${lat}&lng=${lng}`)
    const body = await res.json()
    return res.ok ? (body.address as string | null) : null
  } catch {
    return null
  }
}

async function roundTripFromHome(home: LatLng, site: LatLng): Promise<number> {
  const legs = await routeMiles([home, site, home])
  return Math.round(legs.reduce((a, b) => a + b, 0) * 10) / 10
}

export type CheckInResult = { address: string | null; roundtripMiles: number; filledLocation: boolean }

/**
 * Record that you're on site for an event: saves the GPS spot, fills the event's
 * location if it was blank, stores Home -> here -> Home miles (used on invoices),
 * and refreshes that day's tax mileage.
 */
export async function checkInAtEvent(
  event: { id: string; start_time: string; location: string | null },
  position: LatLng
): Promise<CheckInResult> {
  const supabase = createClient()
  const settings = await getMileageSettings()
  if (!settings) throw new Error("Set your home address in Money → Mileage first.")
  const home: LatLng = { lat: settings.home_lat, lng: settings.home_lng }

  const [address, roundtripMiles] = await Promise.all([
    reverseAddress(position.lat, position.lng),
    roundTripFromHome(home, position),
  ])
  const fillLocation = !event.location || !event.location.trim()
  const { error } = await supabase
    .from("events")
    .update({
      arrived_at: new Date().toISOString(),
      arrived_lat: position.lat,
      arrived_lng: position.lng,
      arrived_address: address,
      roundtrip_miles: roundtripMiles,
      ...(fillLocation ? { location: address ?? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` } : {}),
    })
    .eq("id", event.id)
  if (error) throw error

  // Keep the tax log current for that day (best effort).
  const day = localDate(event.start_time)
  try {
    await syncTripsFromCalendar(day, day)
  } catch {
    /* the Mileage page sync will catch up */
  }
  return { address, roundtripMiles, filledLocation: fillLocation }
}

/**
 * Home -> site -> Home miles for each event, for invoice mileage lines.
 * Uses the check-in miles when you checked in; otherwise routes the event's
 * address once and saves the result on the event.
 */
export async function getRoundTripMiles(eventIds: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {}
  if (!eventIds.length) return out
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("events")
    .select("id, location, roundtrip_miles, arrived_lat, arrived_lng")
    .in("id", eventIds)
  if (error) throw error

  const todo = (data ?? []).filter((e) => {
    if (e.roundtrip_miles != null) {
      out[e.id] = Number(e.roundtrip_miles)
      return false
    }
    if (e.arrived_lat == null && !(e.location && e.location.trim())) {
      out[e.id] = null
      return false
    }
    return true
  })
  if (!todo.length) return out

  const settings = await getMileageSettings()
  if (!settings) {
    for (const e of todo) out[e.id] = null
    return out
  }
  const home: LatLng = { lat: settings.home_lat, lng: settings.home_lng }
  const geo = await resolveLocations(
    userId,
    todo.filter((e) => e.arrived_lat == null).map((e) => e.location as string)
  )
  for (const e of todo) {
    const coord =
      e.arrived_lat != null && e.arrived_lng != null
        ? { lat: e.arrived_lat, lng: e.arrived_lng }
        : geo.get(normalizeLocation(e.location as string))?.coord ?? null
    if (!coord) {
      out[e.id] = null
      continue
    }
    try {
      const miles = await roundTripFromHome(home, coord)
      out[e.id] = miles
      await supabase.from("events").update({ roundtrip_miles: miles }).eq("id", e.id)
    } catch {
      out[e.id] = null
    }
  }
  return out
}
