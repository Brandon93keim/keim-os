"use client"

import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"

export function SettingsHeader() {
  const router = useRouter()
  return <PageHeader title="Settings" onBack={() => router.back()} />
}
