import { createClient } from "@/lib/supabase/server"
import { reverseGeocode } from "@/lib/mileage/providers"

// GET /api/mileage/reverse?lat=..&lng=.. -> { address }
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 })

  const sp = new URL(request.url).searchParams
  const lat = Number(sp.get("lat"))
  const lng = Number(sp.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 })
  }
  try {
    return Response.json({ address: await reverseGeocode(lat, lng) })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 })
  }
}
