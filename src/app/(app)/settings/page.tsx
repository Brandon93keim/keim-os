import { createClient } from "@/lib/supabase/server"
import { UserMenu } from "@/components/layout/UserMenu"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Account
        </h2>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
          <UserMenu email={user?.email ?? ""} />
        </div>
      </section>
    </div>
  )
}
