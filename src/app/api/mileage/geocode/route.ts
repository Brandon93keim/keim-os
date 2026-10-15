import { createClient } from "@/lib/supabase/server"
import { geocode } from "@/lib/mileage/providers"

// GET /api/mileage/geocode?q=<address>
// Signed-in users only, so this can't be used as an open proxy.
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 })

  const q = new URL(request.url).searchParams.get("q")?.trim()
  if (!q || q.length > 300) return Response.json({ error: "Missing or invalid q" }, { status: 400 })

  try {
    return Response.json(await geocode(q))
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 })
  }
}
