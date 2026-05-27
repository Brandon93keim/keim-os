import { createClient } from "@/lib/supabase/client"
import type { BillWithNextDue, BillPayment } from "@/lib/finance/types"
import type { BillPaymentFormValues } from "@/lib/finance/schemas"

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
