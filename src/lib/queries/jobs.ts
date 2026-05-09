import { createClient } from "@/lib/supabase/client"
import type { CalEvent } from "@/lib/hooks/useEvents"
import type { Client } from "@/lib/queries/clients"

export type UnbilledJob = {
  id: string
  title: string
  job_number: string | null
  business_id: string
  client_id: string | null
  client_name: string | null
  client_company: string | null
  start_time: string
  job_total_amount: number | null
}

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

type RawJob = {
  id: string
  title: string
  job_number: string | null
  business_id: string | null
  client_id: string | null
  start_time: string
  job_total_amount: number | null
  client: { name: string; company: string | null } | null
}

function toUnbilledJob(j: RawJob): UnbilledJob {
  return {
    id: j.id,
    title: j.title,
    job_number: j.job_number,
    business_id: j.business_id ?? "",
    client_id: j.client_id,
    client_name: j.client?.name ?? null,
    client_company: j.client?.company ?? null,
    start_time: j.start_time,
    job_total_amount: j.job_total_amount,
  }
}

export async function getUnbilledJobs(): Promise<UnbilledJob[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const now = new Date().toISOString()

  // (a) Candidate jobs: type='job', start_time <= now, oldest first
  const { data: rawJobs, error: jobsError } = await supabase
    .from("events")
    .select("id, title, job_number, business_id, client_id, start_time, job_total_amount, client:clients(name, company)")
    .eq("user_id", userId)
    .eq("type", "job")
    .lte("start_time", now)
    .order("start_time", { ascending: true })

  if (jobsError) throw jobsError
  const jobs = (rawJobs ?? []) as unknown as RawJob[]
  if (jobs.length === 0) return []

  const jobIds = jobs.map((j) => j.id)

  // (b) Line items referencing these jobs
  const { data: lineItems, error: liError } = await supabase
    .from("invoice_line_items")
    .select("event_id, invoice_id")
    .in("event_id", jobIds)

  if (liError) throw liError
  if (!lineItems || lineItems.length === 0) return jobs.map(toUnbilledJob)

  const invoiceIds = [
    ...new Set(lineItems.map((li) => li.invoice_id).filter((id): id is string => !!id)),
  ]
  if (invoiceIds.length === 0) return jobs.map(toUnbilledJob)

  // Active invoices (not cancelled/void)
  const { data: activeInvoices, error: invError } = await supabase
    .from("invoices")
    .select("id")
    .in("id", invoiceIds)
    .neq("status", "cancelled")
    .neq("status", "void")

  if (invError) throw invError

  const activeSet = new Set((activeInvoices ?? []).map((inv) => inv.id))
  const billedIds = new Set(
    lineItems
      .filter((li) => li.invoice_id && activeSet.has(li.invoice_id))
      .map((li) => li.event_id)
      .filter((id): id is string => !!id)
  )

  // (c) Keep jobs not referenced by any active invoice line item
  return jobs.filter((j) => !billedIds.has(j.id)).map(toUnbilledJob)
}

export async function isJobBilled(eventId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: items, error: itemsErr } = await supabase
    .from("invoice_line_items")
    .select("invoice_id")
    .eq("event_id", eventId)
  if (itemsErr) throw itemsErr
  if (!items || items.length === 0) return false

  const invoiceIds = items.map((i) => i.invoice_id)
  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("status")
    .in("id", invoiceIds)
  if (invErr) throw invErr
  return (invoices ?? []).some(
    (inv) => !["cancelled", "void"].includes(inv.status)
  )
}

export function eventToUnbilledJob(event: CalEvent, clients: Client[]): UnbilledJob {
  const client = event.client_id
    ? clients.find((c) => c.id === event.client_id) ?? null
    : null
  return {
    id: event.id,
    title: event.title,
    job_number: event.job_number ?? null,
    business_id: event.business_id ?? "",
    client_id: event.client_id ?? null,
    client_name: client?.name ?? null,
    client_company: client?.company ?? null,
    start_time: event.start_time,
    job_total_amount: event.job_total_amount ?? null,
  }
}
