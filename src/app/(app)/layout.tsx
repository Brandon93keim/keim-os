import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BottomNav } from "@/components/layout/BottomNav"
import { SettingsGear } from "@/components/layout/SettingsGear"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex h-full flex-col">
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
      <SettingsGear />
      <BottomNav />
    </div>
  )
}
