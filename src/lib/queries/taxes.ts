import { createClient } from "@/lib/supabase/client"
import type { Tables, TablesUpdate } from "@/types/database"
import { BUSINESSES, getBusinessById } from "@/lib/constants"
import { mileageRateFor } from "@/lib/mileage/rates"

export type TaxSettings = Tables<"tax_settings">
export type TaxPayment = Tables<"tax_payments">

const TAX_CATEGORY = "Estimated Taxes"

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

// ------------------------------------------------------------
// Settings
// ------------------------------------------------------------

export async function getTaxSettings(year: number): Promise<TaxSettings> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("tax_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("tax_year", year)
    .maybeSingle()
  if (error) throw error
  if (data) return data
  const { data: created, error: insErr } = await supabase
    .from("tax_settings")
    .insert({ user_id: userId, tax_year: year })
    .select("*")
    .single()
  if (insErr) throw insErr
  return created
}

export async function updateTaxSettings(year: number, values: TablesUpdate<"tax_settings">): Promise<TaxSettings> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("tax_settings")
    .update(values)
    .eq("user_id", userId)
    .eq("tax_year", year)
    .select("*")
    .single()
  if (error) throw error
  return data
}

// ------------------------------------------------------------
// Payments
// ------------------------------------------------------------

export async function listTaxPayments(year: number): Promise<TaxPayment[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("tax_payments")
    .select("*")
    .eq("user_id", userId)
    .eq("tax_year", year)
    .order("paid_on", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function ensureTaxCategory(userId: string): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("name", TAX_CATEGORY)
    .maybeSingle()
  if (data) return data.id
  const { data: created, error } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: TAX_CATEGORY, kind: "expense", sort_order: 60 })
    .select("id")
    .single()
  if (error) throw error
  return created.id
}

export type RecordTaxPaymentValues = {
  year: number
  jurisdiction: "federal" | "louisiana"
  paid_on: string
  amount: number
  account_id: string
  notes?: string | null
}

/**
 * Logs an estimated payment. Also writes the money leaving your account as an
 * expense that is excluded from P&L: income tax is not a business expense.
 */
export async function recordTaxPayment(v: RecordTaxPaymentValues): Promise<void> {
  const supabase = createClient()
  const userId = await getUserId()
  const categoryId = await ensureTaxCategory(userId)
  const who = v.jurisdiction === "federal" ? "IRS" : "Louisiana LDR"
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: v.account_id,
      type: "expense",
      amount: v.amount,
      occurred_on: v.paid_on,
      description: `${who} estimated tax payment (${v.year})`,
      category_id: categoryId,
      excluded_from_pnl: true,
      notes: v.notes ?? null,
    })
    .select("id")
    .single()
  if (txErr) throw txErr
  const { error } = await supabase.from("tax_payments").insert({
    user_id: userId,
    tax_year: v.year,
    jurisdiction: v.jurisdiction,
    paid_on: v.paid_on,
    amount: v.amount,
    transaction_id: tx.id,
    notes: v.notes ?? null,
  })
  if (error) {
    await supabase.from("transactions").delete().eq("id", tx.id)
    throw error
  }
}

export async function deleteTaxPayment(p: TaxPayment): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("tax_payments").delete().eq("id", p.id)
  if (error) throw error
  if (p.transaction_id) await supabase.from("transactions").delete().eq("id", p.transaction_id)
}

// ------------------------------------------------------------
// Year-to-date tax base (Schedule C profit)
// ------------------------------------------------------------

export type BusinessLine = {
  businessId: string
  name: string
  color: string
  income: number
  expense: number
  net: number
}

export type TaxBase = {
  from: string
  to: string
  businesses: BusinessLine[]
  grossIncome: number
  expenses: number
  /** Business fuel removed because the standard mileage rate already covers it. */
  fuelAddedBack: number
  businessMiles: number
  mileageRate: number
  mileageDeduction: number
  /** Schedule C profit: income - expenses + fuel add-back - mileage deduction. */
  netProfit: number
  golfNet: number
  interestIncome: number
  rothContributed: number
  milesNeedingReview: number
}

export async function getTaxBase(year: number, to: string): Promise<TaxBase> {
  const supabase = createClient()
  const userId = await getUserId()
  const from = `${year}-01-01`

  const [{ data: txs, error: txErr }, { data: cats, error: catErr }, { data: trips, error: tripErr }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("type, amount, business_id, category_id, description, excluded_from_pnl")
        .eq("user_id", userId)
        .in("type", ["income", "expense"])
        .gte("occurred_on", from)
        .lte("occurred_on", to),
      supabase.from("categories").select("id, name").eq("user_id", userId),
      supabase
        .from("mileage_trips")
        .select("miles, status")
        .eq("user_id", userId)
        .gte("trip_date", from)
        .lte("trip_date", to),
    ])
  if (txErr) throw txErr
  if (catErr) throw catErr
  if (tripErr) throw tripErr

  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]))
  const lines = new Map<string, BusinessLine>()
  for (const b of BUSINESSES.filter((b) => b.pnl_group === "business")) {
    lines.set(b.id, { businessId: b.id, name: b.name, color: b.color, income: 0, expense: 0, net: 0 })
  }

  let fuelAddedBack = 0
  let golfNet = 0
  let interestIncome = 0
  let rothContributed = 0

  for (const t of txs ?? []) {
    const amt = Number(t.amount)
    const cat = t.category_id ? catName.get(t.category_id) : undefined
    if (t.type === "expense" && /roth ira contribution/i.test(t.description)) rothContributed += amt
    if (t.excluded_from_pnl) continue
    const biz = t.business_id ? getBusinessById(t.business_id) : null
    if (!biz) {
      if (t.type === "income" && cat === "Interest Income") interestIncome += amt
      continue
    }
    if (biz.pnl_group === "golf") {
      golfNet += t.type === "income" ? amt : -amt
      continue
    }
    if (biz.pnl_group !== "business") continue
    const line = lines.get(biz.id)!
    if (t.type === "income") line.income += amt
    else {
      line.expense += amt
      if (cat === "Gas") fuelAddedBack += amt
    }
  }

  const businesses = [...lines.values()]
    .map((l) => ({ ...l, net: l.income - l.expense }))
    .filter((l) => l.income || l.expense)
    .sort((a, b) => b.net - a.net)
  const grossIncome = businesses.reduce((s, l) => s + l.income, 0)
  const expenses = businesses.reduce((s, l) => s + l.expense, 0)
  const okTrips = (trips ?? []).filter((t) => t.status === "ok")
  const businessMiles = okTrips.reduce((s, t) => s + Number(t.miles), 0)
  const { rate } = mileageRateFor(year)
  const mileageDeduction = Math.round(businessMiles * rate * 100) / 100
  const netProfit = grossIncome - expenses + fuelAddedBack - mileageDeduction

  return {
    from,
    to,
    businesses,
    grossIncome,
    expenses,
    fuelAddedBack,
    businessMiles,
    mileageRate: rate,
    mileageDeduction,
    netProfit,
    golfNet,
    interestIncome,
    rothContributed,
    milesNeedingReview: (trips ?? []).filter((t) => t.status === "review").reduce((s, t) => s + Number(t.miles), 0),
  }
}
