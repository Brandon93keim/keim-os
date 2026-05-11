"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user.id)
        .single()
      if (error) throw error
      return data as { full_name: string | null; email: string | null; phone: string | null }
    },
  })
}
