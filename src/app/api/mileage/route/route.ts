import { createClient } from "@/lib/supabase/server"
import { routeLegsMeters } from "@/lib/mileage/providers"
import type { LatLng } from "@/lib/mileage/plan"

// POST /api/mileage/route  { points: [{lat,lng}, ...] } -> { legsMeters: number[] }
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 })

  let points: LatLng[]
  try {
    const body = (await request.json()) as { points?: LatLng[] }
    points = body.points ?? []
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const valid =
    points.length >= 2 &&
    points.length <= 25 &&
    points.every(
      (p) =>
        Number.isFinite(p?.lat) && Number.isFinite(p?.lng) &&
        Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
    )
  if (!valid) return Response.json({ error: "Need 2-25 valid points" }, { status: 400 })

  try {
    return Response.json({ legsMeters: await routeLegsMeters(points) })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 })
  }
}
