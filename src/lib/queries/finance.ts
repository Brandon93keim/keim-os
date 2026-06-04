import { createClient } from "@/lib/supabase/client"
import type { AccountWithBalance, TransactionWithRelations, AllocationRuleWithAccount } from "@/lib/finance/types"
import type { AccountFormValues, TransactionFormValues, AllocationRuleFormValues } from "@/lib/finance/schemas"

export type DistributionLine = {
  label: string
  destination_account_id: string
  amount: number
}

export type TransactionFilters = {
  account_id?: string
  business_id?: string
  type?: "income" | "expense" | "transfer"
  date_from?: string
  date_to?: string
}

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
    starting_balance: values.kind === "liability" ? -Math.abs(values.starting_balance) : values.starting_balance,
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
      starting_balance: values.kind === "liability" ? -Math.abs(values.starting_balance) : values.starting_balance,
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

export async function listTransactions(
  filters?: TransactionFilters
): Promise<TransactionWithRelations[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  let query = supabase
    .from("transactions")
    .select(`
      *,
      account:accounts!account_id(id, name, kind),
      transfer_to_account:accounts!transfer_to_account_id(id, name)
    `)
    .eq("user_id", user.id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100)

  if (filters?.account_id) query = query.eq("account_id", filters.account_id)
  if (filters?.business_id) query = query.eq("business_id", filters.business_id)
  if (filters?.type) query = query.eq("type", filters.type)
  if (filters?.date_from) query = query.gte("occurred_on", filters.date_from)
  if (filters?.date_to) query = query.lte("occurred_on", filters.date_to)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as TransactionWithRelations[]
}

export async function createTransaction(values: TransactionFormValues): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: values.account_id,
    transfer_to_account_id: values.type === "transfer" ? values.transfer_to_account_id : null,
    type: values.type,
    amount: values.amount,
    occurred_on: values.occurred_on,
    description: values.description,
    business_id: values.type === "transfer" ? null : values.business_id,
    notes: values.notes,
  })
  if (error) throw error
}

export async function updateTransaction(
  id: string,
  values: TransactionFormValues
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("transactions")
    .update({
      account_id: values.account_id,
      transfer_to_account_id: values.type === "transfer" ? values.transfer_to_account_id : null,
      type: values.type,
      amount: values.amount,
      occurred_on: values.occurred_on,
      description: values.description,
      business_id: values.type === "transfer" ? null : values.business_id,
      notes: values.notes,
    })
    .eq("id", id)
  if (error) throw error
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("transactions").delete().eq("id", id)
  if (error) throw error
}

export async function listPnLTransactions(
  dateFrom: string,
  dateTo: string
): Promise<TransactionWithRelations[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      account:accounts!account_id(id, name, kind),
      transfer_to_account:accounts!transfer_to_account_id(id, name)
    `)
    .eq("user_id", user.id)
    .in("type", ["income", "expense"])
    .gte("occurred_on", dateFrom)
    .lte("occurred_on", dateTo)
    .order("occurred_on", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as TransactionWithRelations[]
}

// "personal" → business_id IS NULL; any other string → business_id = that UUID.
// Only returns income/expense (no transfers) so the summary reconciles with P&L rows.
export async function listDrillDownTransactions(
  businessParam: string,
  dateFrom: string,
  dateTo: string
): Promise<TransactionWithRelations[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  let query = supabase
    .from("transactions")
    .select(`
      *,
      account:accounts!account_id(id, name, kind),
      transfer_to_account:accounts!transfer_to_account_id(id, name)
    `)
    .eq("user_id", user.id)
    .in("type", ["income", "expense"])
    .gte("occurred_on", dateFrom)
    .lte("occurred_on", dateTo)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })

  if (businessParam === "personal") {
    query = query.is("business_id", null)
  } else {
    query = query.eq("business_id", businessParam)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as TransactionWithRelations[]
}

export async function listAllocationRules(): Promise<AllocationRuleWithAccount[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data, error } = await supabase
    .from("allocation_rules")
    .select(`
      *,
      destination_account:accounts!destination_account_id(id, name)
    `)
    .eq("user_id", user.id)
    .order("sort_order")
  if (error) throw error
  return (data ?? []) as unknown as AllocationRuleWithAccount[]
}

export async function createAllocationRule(values: AllocationRuleFormValues): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { error } = await supabase.from("allocation_rules").insert({
    user_id: user.id,
    label: values.label,
    destination_account_id: values.destination_account_id,
    percentage: values.percentage,
  })
  if (error) throw error
}

export async function updateAllocationRule(
  id: string,
  values: AllocationRuleFormValues
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("allocation_rules")
    .update({
      label: values.label,
      destination_account_id: values.destination_account_id,
      percentage: values.percentage,
    })
    .eq("id", id)
  if (error) throw error
}

export async function deleteAllocationRule(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("allocation_rules").delete().eq("id", id)
  if (error) throw error
}

export async function listAccountTransactions(
  accountId: string
): Promise<TransactionWithRelations[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      account:accounts!account_id(id, name, kind),
      transfer_to_account:accounts!transfer_to_account_id(id, name)
    `)
    .eq("user_id", user.id)
    .or(`account_id.eq.${accountId},transfer_to_account_id.eq.${accountId}`)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as TransactionWithRelations[]
}

export async function getDistribution(
  incomeId: string
): Promise<TransactionWithRelations[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      account:accounts!account_id(id, name, kind),
      transfer_to_account:accounts!transfer_to_account_id(id, name)
    `)
    .eq("user_id", user.id)
    .eq("source_transaction_id", incomeId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as TransactionWithRelations[]
}

export async function createDistribution(
  income: { id: string; account_id: string; occurred_on: string },
  lines: DistributionLine[]
): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const rows = lines
    .filter((l) => l.amount > 0)
    .filter((l) => l.destination_account_id !== income.account_id)
    .map((l) => ({
      user_id: user.id,
      account_id: income.account_id,
      transfer_to_account_id: l.destination_account_id,
      type: "transfer" as const,
      amount: l.amount,
      occurred_on: income.occurred_on,
      business_id: null,
      source_transaction_id: income.id,
      description: `Allocation: ${l.label}`,
      notes: null,
    }))

  if (!rows.length) return

  const { error } = await supabase.from("transactions").insert(rows)
  if (error) throw error
}

export async function undoDistribution(incomeId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("source_transaction_id", incomeId)
  if (error) throw error
}
