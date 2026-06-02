"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings } from "lucide-react"

const PRIMARY_TABS = ["/calendar", "/clients", "/tasks", "/invoices", "/money"]

export function SettingsGear() {
  const pathname = usePathname()

  if (!PRIMARY_TABS.includes(pathname)) return null

  return (
    <Link
      href="/settings"
      aria-label="Settings"
      className="fixed right-0 z-30 flex items-center justify-center w-10 h-10 text-muted-foreground hover:text-foreground active:opacity-70"
      style={{ top: "env(safe-area-inset-top)" }}
    >
      <Settings size={20} />
    </Link>
  )
}
