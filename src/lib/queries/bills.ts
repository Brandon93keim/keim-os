import { createClient } from "@/lib/supabase/client"
import type { BillWithNextDue, BillPayment } from "@/lib/finance/types"
import type { BillFormValues, BillPaymentFormValues } from "@/lib/finance/schemas"

export interface RecordBillPaymentContext {
  billId: string
  billName: string
  businessId: string | null
  transactionType: "expense" | "transfer"
  paysDownAccountId: string | null
  defaultAccountId: string
  defaultAmount: number | null
  nextDueDate: string | null
}

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

export async function listBills(): Promise<BillWithNextDue[]> {
  const supabase = createClient()
  const userId = await getUserId()

  const { data, error } = await supabase
    .from("bills_with_next_due")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("next_due_date", { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as unknown as BillWithNextDue[]
}

export async function listBillPaymentsForPeriod(periodStart: string, periodEnd: string): Promise<BillPayment[]> {
  const supabase = createClient()
  const userId = await getUserId()

  const { data, error } = await supabase
    .from("bill_payments")
    .select("*")
    .eq("user_id", userId)
    .gte("period_start", periodStart)
    .lte("period_start", periodEnd)

  if (error) throw error
  return (data ?? []) as unknown as BillPayment[]
}

export async function listRecentBillPayments(daysBack: number): Promise<BillPayment[]> {
  const supabase = createClient()
  const userId = await getUserId()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysBack)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("bill_payments")
    .select("*")
    .eq("user_id", userId)
    .gte("paid_on", cutoffStr)
    .order("paid_on", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as BillPayment[]
}

export async function createBill(values: BillFormValues): Promise<void> {
  const supabase = createClient()
  const userId = await getUserId()
  const { error } = await supabase.from("bills").insert({
    user_id: userId,
    name: values.name,
    business_id: values.business_id,
    default_account_id: values.default_account_id,
    transaction_type: values.transaction_type,
    pays_down_account_id:
      values.transaction_type === "transfer" ? values.pays_down_account_id : null,
    default_amount: values.default_amount,
    category_id: null,
    frequency_unit: values.frequency_unit,
    frequency_interval: values.frequency_interval,
    anchor_date: values.anchor_date,
    end_date: values.end_date,
    is_active: values.is_active,
    notes: values.notes,
  })
  if (error) throw error
}

export async function updateBill(id: string, values: BillFormValues): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("bills")
    .update({
      name: values.name,
      business_id: values.business_id,
      default_account_id: values.default_account_id,
      transaction_type: values.transaction_type,
      pays_down_account_id:
        values.transaction_type === "transfer" ? values.pays_down_account_id : null,
      default_amount: values.default_amount,
      category_id: null,
      frequency_unit: values.frequency_unit,
      frequency_interval: values.frequency_interval,
      anchor_date: values.anchor_date,
      end_date: values.end_date,
      is_active: values.is_active,
      notes: values.notes,
    })
    .eq("id", id)
  if (error) throw error
}

export async function setBillActive(id: string, is_active: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("bills").update({ is_active }).eq("id", id)
  if (error) throw error
}

export async function deleteBill(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("bills").delete().eq("id", id)
  if (error) throw error
}

export async function recordBillPayment(
  ctx: RecordBillPaymentContext,
  values: BillPaymentFormValues
): Promise<void> {
  const supabase = createClient()
  const userId = await getUserId()

  const { data: payment, error: payErr } = await supabase
    .from("bill_payments")
    .insert({
      user_id: userId,
      bill_id: ctx.billId,
      amount: values.amount,
      paid_on: values.paid_on,
      period_start: values.period_start,
      account_id: values.account_id,
      notes: values.notes || null,
    })
    .select("id")
    .single()

  if (payErr || !payment) throw payErr ?? new Error("Failed to insert bill payment")

  const { error: txErr } = await supabase.from("transactions").insert({
    user_id: userId,
    account_id: values.account_id,
    transfer_to_account_id:
      ctx.transactionType === "transfer" ? ctx.paysDownAccountId : null,
    type: ctx.transactionType,
    amount: values.amount,
    occurred_on: values.paid_on,
    description: `Bill: ${ctx.billName}`,
    business_id: ctx.businessId,
    bill_payment_id: payment.id,
  })

  if (txErr) {
    await supabase.from("bill_payments").delete().eq("id", payment.id)
    throw txErr
  }
}
