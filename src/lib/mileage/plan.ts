// Pure route planning for the mileage log. No network, no DB: easy to test.
//
// A day's business stops are driven as one loop:
//   Home -> stop 1 -> stop 2 -> ... -> stop N -> Home
// Each stop is credited with the leg that reached it, and the last stop also
// gets the drive home. Per-stop miles therefore add up to the real day's route
// (rather than N separate round trips, which would overstate the deduction).

export type LatLng = { lat: number; lng: number }

export type PlanStop = {
  key: string                 // event id
  location: string            // raw location text
  coord: LatLng | null        // null = couldn't geocode
  approximate: boolean        // geocode only matched a city/area
}

export type PlannedStop = {
  key: string
  fromLabel: string
  includesReturn: boolean
  miles: number
  status: "ok" | "review"
  reviewReason: string | null
}

// A leg longer than this is almost certainly a flight, not a drive.
export const LONG_LEG_MILES = 300

export const METERS_PER_MILE = 1609.344

export function normalizeLocation(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase()
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Points to route through, in order: home, each routable stop, home. */
export function routePoints(home: LatLng, stops: PlanStop[]): LatLng[] {
  return [home, ...stops.filter((s) => s.coord).map((s) => s.coord as LatLng), home]
}

/**
 * Allocate leg distances (miles, one per consecutive pair of routePoints) to stops.
 * `legMiles.length` must equal routePoints(home, stops).length - 1.
 */
export function allocate(stops: PlanStop[], legMiles: number[]): PlannedStop[] {
  const routable = stops.filter((s) => s.coord)
  if (legMiles.length !== routable.length + 1) {
    throw new Error(`Expected ${routable.length + 1} legs, got ${legMiles.length}`)
  }

  const out: PlannedStop[] = []
  let leg = 0
  let prevLabel = "Home"
  const lastRoutableKey = routable.length ? routable[routable.length - 1].key : null

  for (const s of stops) {
    if (!s.coord) {
      out.push({
        key: s.key,
        fromLabel: prevLabel,
        includesReturn: false,
        miles: 0,
        status: "review",
        reviewReason: "Couldn't find this address. Edit the event location or enter miles by hand.",
      })
      continue
    }
    const legs = [legMiles[leg++]]
    const isLast = s.key === lastRoutableKey
    if (isLast) legs.push(legMiles[leg++])
    const miles = round1(legs.reduce((a, b) => a + b, 0))

    const reasons: string[] = []
    if (legs.some((m) => m > LONG_LEG_MILES)) reasons.push(`A leg is over ${LONG_LEG_MILES} mi. Did you drive, or fly?`)
    if (s.approximate) reasons.push("Address only matched a city or area, so miles are approximate.")

    out.push({
      key: s.key,
      fromLabel: prevLabel,
      includesReturn: isLast,
      miles,
      status: reasons.length ? "review" : "ok",
      reviewReason: reasons.length ? reasons.join(" ") : null,
    })
    prevLabel = s.location.trim()
  }
  return out
}

/** Straight-line distance, used only as a sanity fallback in tests/UI. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
