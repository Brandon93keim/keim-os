import { createClient } from "@/lib/supabase/client"
import type { AccountWithBalance } from "@/lib/finance/types"
import type { AccountFormValues } from "@/lib/finance/schemas"

export async function listAccounts(): Promise<AccountWithBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts_with_balance")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
  if (error) throw error
  return (data ?? []) as unknown as AccountWithBalance[]
}

export async function listAllAccounts(): Promise<AccountWithBalance[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts_with_balance")
    .select("*")
    .order("sort_order")
  if (error) throw error
  return (data ?? []) as unknown as AccountWithBalance[]
}

export async function createAccount(values: AccountFormValues): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: values.name,
    type: values.type,
    kind: values.kind,
    starting_balance: values.starting_balance,
    business_id: values.business_id,
    is_active: values.is_active,
  })
  if (error) throw error
}

export async function updateAccount(id: string, values: AccountFormValues): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("accounts")
    .update({
      name: values.name,
      type: values.type,
      kind: values.kind,
      starting_balance: values.starting_balance,
      business_id: values.business_id,
      is_active: values.is_active,
    })
    .eq("id", id)
  if (error) throw error
}

export async function setAccountActive(id: string, is_active: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("accounts").update({ is_active }).eq("id", id)
  if (error) throw error
}

export async function getAccountTransactionCount(id: string): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", id)
  if (error) throw error
  return count ?? 0
}
