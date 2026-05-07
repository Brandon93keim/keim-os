import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import type { InvoiceFormValues, PaymentFormValues } from "@/lib/validations/invoice"

// ---------------------------------------------------------------------------
// Local types — will align with Tables<"invoices"> etc. after types are
// regenerated: npx supabase gen types typescript --linked > src/types/database.ts
// ---------------------------------------------------------------------------

export interface InvoiceRow {
  id: string
  user_id: string
  invoice_number: string | null
  business_id: string
  client_id: string
  status: string
  issue_date: string
  due_date: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  amount_paid: number
  notes: string | null
  terms: string | null
  email_address: string | null
  pdf_url: string | null
  sent_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLineItem {
  id: string
  user_id: string
  invoice_id: string
  event_id: string | null
  description: string
  quantity: number
  unit_price: number
  amount: number
  sort_order: number
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  invoice_id: string
  amount: number
  payment_date: string
  method: string
  reference: string | null
  notes: string | null
  created_at: string
}

export interface InvoiceClient {
  id: string
  name: string
  company: string | null
  email: string | null
}

export interface Invoice extends InvoiceRow {
  client: InvoiceClient | null
  line_items: InvoiceLineItem[]
  payments: Payment[]
}

export interface InvoiceSummary extends InvoiceRow {
  client: Pick<InvoiceClient, "id" | "name" | "company"> | null
}

// ---------------------------------------------------------------------------

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

export async function listInvoices(): Promise<InvoiceSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const userId = await getUserId()

  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(id, name, company)")
    .eq("user_id", userId)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as InvoiceSummary[]
}

export async function listInvoicesForClient(clientId: string): Promise<InvoiceSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const userId = await getUserId()

  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(id, name, company)")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("issue_date", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as InvoiceSummary[]
}

export async function getInvoice(id: string): Promise<Invoice> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const userId = await getUserId()

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      client:clients(id, name, company, email),
      line_items:invoice_line_items(*),
      payments(*)
    `)
    .eq("id", id)
    .eq("user_id", userId)
    .single()

  if (error) throw error

  const invoice = data as unknown as Invoice
  invoice.line_items = [...invoice.line_items].sort((a, b) => a.sort_order - b.sort_order)
  invoice.payments = [...invoice.payments].sort(
    (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
  )

  return invoice
}

export async function createInvoice(values: InvoiceFormValues): Promise<InvoiceRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const userId = await getUserId()

  // 1. Insert invoice header
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      business_id: values.business_id,
      client_id: values.client_id,
      issue_date: format(values.issue_date, "yyyy-MM-dd"),
      due_date: format(values.due_date, "yyyy-MM-dd"),
      tax_rate: values.tax_rate,
      discount_amount: values.discount_amount,
      notes: values.notes || null,
      terms: values.terms || null,
      email_address: values.email_address || null,
    })
    .select()
    .single()

  if (invErr) throw invErr

  // 2. Generate invoice number
  const { data: invNum, error: numErr } = await supabase.rpc(
    "generate_invoice_number",
    { p_business_id: values.business_id }
  )
  if (numErr) {
    await supabase.from("invoices").delete().eq("id", invoice.id)
    throw numErr
  }

  await supabase
    .from("invoices")
    .update({ invoice_number: invNum })
    .eq("id", invoice.id)

  // 3. Insert line items (trigger will recompute totals after each insert)
  const lineItems = values.line_items.map((item, i) => ({
    user_id: userId,
    invoice_id: invoice.id,
    event_id: item.event_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: Math.round(item.quantity * item.unit_price * 100) / 100,
    sort_order: i,
  }))

  const { error: liErr } = await supabase.from("invoice_line_items").insert(lineItems)
  if (liErr) {
    await supabase.from("invoices").delete().eq("id", invoice.id)
    throw liErr
  }

  return { ...(invoice as unknown as InvoiceRow), invoice_number: invNum }
}

export async function updateInvoice(id: string, values: InvoiceFormValues): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const userId = await getUserId()

  // 1. Update invoice header
  const { error: invErr } = await supabase
    .from("invoices")
    .update({
      business_id: values.business_id,
      client_id: values.client_id,
      issue_date: format(values.issue_date, "yyyy-MM-dd"),
      due_date: format(values.due_date, "yyyy-MM-dd"),
      tax_rate: values.tax_rate,
      discount_amount: values.discount_amount,
      notes: values.notes || null,
      terms: values.terms || null,
      email_address: values.email_address || null,
    })
    .eq("id", id)

  if (invErr) throw invErr

  // 2. Replace line items: delete all, then re-insert
  const { error: delErr } = await supabase
    .from("invoice_line_items")
    .delete()
    .eq("invoice_id", id)

  if (delErr) throw delErr

  const lineItems = values.line_items.map((item, i) => ({
    user_id: userId,
    invoice_id: id,
    event_id: item.event_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: Math.round(item.quantity * item.unit_price * 100) / 100,
    sort_order: i,
  }))

  const { error: liErr } = await supabase.from("invoice_line_items").insert(lineItems)
  if (liErr) throw liErr
}

export async function deleteInvoice(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { error } = await supabase.from("invoices").delete().eq("id", id)
  if (error) throw error
}

export async function markInvoiceSent(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function markInvoiceCancelled(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { error } = await supabase
    .from("invoices")
    .update({ status: "cancelled" })
    .eq("id", id)
  if (error) throw error
}

export async function markInvoiceVoid(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { error } = await supabase
    .from("invoices")
    .update({ status: "void" })
    .eq("id", id)
  if (error) throw error
}

export async function recordPayment(
  invoiceId: string,
  values: PaymentFormValues
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const userId = await getUserId()

  const { error } = await supabase.from("payments").insert({
    user_id: userId,
    invoice_id: invoiceId,
    amount: values.amount,
    payment_date: format(values.payment_date, "yyyy-MM-dd"),
    method: values.method,
    reference: values.reference || null,
    notes: values.notes || null,
  })

  if (error) throw error
}

export async function deletePayment(paymentId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { error } = await supabase.from("payments").delete().eq("id", paymentId)
  if (error) throw error
}

export async function listJobsForClientAndBusiness(
  clientId: string,
  businessId: string
): Promise<Array<{ id: string; title: string; job_total_amount: number | null; start_time: string }>> {
  const supabase = createClient()
  const userId = await getUserId()

  const { data, error } = await supabase
    .from("events")
    .select("id, title, job_total_amount, start_time")
    .eq("user_id", userId)
    .eq("type", "job")
    .eq("client_id", clientId)
    .eq("business_id", businessId)
    .order("start_time", { ascending: false })
    .limit(30)

  if (error) throw error
  return data ?? []
}
