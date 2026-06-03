import Link from "next/link"
import { ChevronRight } from "lucide-react"
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Finance
        </h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          <Link
            href="/settings/allocations"
            className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors"
          >
            <div>
              <p className="text-sm font-medium">Income allocation rules</p>
              <p className="text-xs text-muted-foreground">How project income gets split</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </Link>
        </div>
      </section>
    </div>
  )
}
