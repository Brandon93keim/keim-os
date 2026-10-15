// Server-only geocoding + driving-distance providers.
// Defaults are free, keyless OpenStreetMap services (fine at personal volume):
//   - Nominatim for address -> coordinates (policy: <=1 req/s, identifying User-Agent)
//   - OSRM for driving distance
// To swap in a paid provider later, change only this file.
import type { LatLng } from "./plan"

const USER_AGENT = "keim-os-mileage/1.0 (personal mileage log)"
const NOMINATIM = process.env.MILEAGE_GEOCODER_URL ?? "https://nominatim.openstreetmap.org"
const OSRM = process.env.MILEAGE_ROUTER_URL ?? "https://router.project-osrm.org"

export type GeocodeResult =
  | { found: true; lat: number; lng: number; label: string; approximate: boolean }
  | { found: false }

export async function geocode(query: string): Promise<GeocodeResult> {
  const url = new URL("/search", NOMINATIM)
  url.searchParams.set("q", query)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("limit", "1")
  url.searchParams.set("countrycodes", "us")
  // Bias toward the Gulf South service area when the text is ambiguous ("Lion Elementary").
  url.searchParams.set("viewbox", "-94.1,33.1,-87.5,28.8")

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } })
  if (!res.ok) throw new Error(`Geocoder error ${res.status}`)
  const rows = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name: string
    place_rank?: number
  }>
  if (!rows.length) return { found: false }
  const r = rows[0]
  // place_rank >= 26 is a street, building, or house number; lower is a town/county/state.
  return {
    found: true,
    lat: Number(r.lat),
    lng: Number(r.lon),
    label: r.display_name,
    approximate: (r.place_rank ?? 30) < 26,
  }
}

/** Driving distance in meters for each leg between consecutive points. */
export async function routeLegsMeters(points: LatLng[]): Promise<number[]> {
  if (points.length < 2) return []
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";")
  const url = `${OSRM}/route/v1/driving/${coords}?overview=false&alternatives=false&steps=false`
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
  if (!res.ok) throw new Error(`Router error ${res.status}`)
  const body = (await res.json()) as {
    code: string
    routes?: Array<{ legs: Array<{ distance: number }> }>
  }
  if (body.code !== "Ok" || !body.routes?.length) throw new Error(`Router: ${body.code}`)
  return body.routes[0].legs.map((l) => l.distance)
}

/** Coordinates -> a short street address ("123 Main St, Metairie, LA"). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = new URL("/reverse", NOMINATIM)
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lng))
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("zoom", "18")
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } })
  if (!res.ok) throw new Error(`Geocoder error ${res.status}`)
  const r = (await res.json()) as {
    display_name?: string
    name?: string
    address?: Record<string, string>
  }
  const a = r.address ?? {}
  const street = [a.house_number, a.road].filter(Boolean).join(" ")
  const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.suburb ?? a.county
  const state = a["ISO3166-2-lvl4"]?.split("-")[1] ?? a.state
  const parts = [r.name && r.name !== a.road ? r.name : null, street || null, city, state].filter(Boolean)
  return parts.length ? parts.join(", ") : r.display_name ?? null
}
