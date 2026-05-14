import { createClient } from "@/lib/supabase/client"

// ─────────────────────────────────────────────────────────────────────────────
// Jobs entity
// ─────────────────────────────────────────────────────────────────────────────

export type Job = {
  id: string
  user_id: string
  business_id: string
  client_id: string | null
  job_number: string
  title: string
  description: string | null
  status: "open" | "completed" | "cancelled"
  total_estimate: number | null
  created_at: string
  updated_at: string
}

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

export async function listJobs(filters?: {
  business_id?: string
  client_id?: string
  status?: Job["status"]
}): Promise<Job[]> {
  const supabase = createClient()
  const userId = await getUserId()

  let query = supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (filters?.business_id) query = query.eq("business_id", filters.business_id)
  if (filters?.client_id) query = query.eq("client_id", filters.client_id)
  if (filters?.status) query = query.eq("status", filters.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Job[]
}

export async function getJob(id: string): Promise<Job | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as Job
}

export async function createJob(values: {
  business_id: string
  client_id: string | null
  title: string
  description?: string | null
  total_estimate?: number | null
}): Promise<Job> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_job", {
    p_business_id: values.business_id,
    p_client_id: values.client_id,
    p_title: values.title,
    p_description: values.description ?? null,
    p_total_estimate: values.total_estimate ?? null,
  })
  if (error) throw error
  return data as Job
}

export async function updateJob(
  id: string,
  values: Partial<Pick<Job, "title" | "description" | "client_id" | "status" | "total_estimate" | "job_number">>
): Promise<Job> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("jobs")
    .update(values)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data as Job
}

export async function deleteJob(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("jobs").delete().eq("id", id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// Unbilled jobs (job-grouped shape)
// ─────────────────────────────────────────────────────────────────────────────

export type UnbilledJob = {
  job_id:               string
  job_number:           string
  job_title:            string
  business_id:          string
  client_id:            string | null
  client_name:          string | null
  client_company:       string | null
  total_estimate:       number | null
  unbilled_events:      Array<{
    event_id:   string
    title:      string
    start_time: string
  }>
  oldest_unbilled_date: string
}

type RawJobRecord = {
  id: string
  business_id: string
  client_id: string | null
  job_number: string
  title: string
  total_estimate: number | null
  client: { name: string; company: string | null } | null
}

type RawEventRecord = { id: string; job_id: string; title: string; start_time: string }

async function fetchBilledEventIds(eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set()
  const supabase = createClient()
  const { data: lineItems, error: liError } = await supabase
    .from("invoice_line_items")
    .select("event_id, invoice_id")
    .in("event_id", eventIds)
  if (liError) throw liError
  if (!lineItems || lineItems.length === 0) return new Set()

  const invoiceIds = [...new Set(
    lineItems.map((li) => li.invoice_id as string | null).filter((id): id is string => !!id)
  )]
  if (invoiceIds.length === 0) return new Set()

  const supabase2 = createClient()
  const { data: activeInvoices, error: invError } = await supabase2
    .from("invoices")
    .select("id")
    .in("id", invoiceIds)
    .neq("status", "cancelled")
    .neq("status", "void")
  if (invError) throw invError

  const activeSet = new Set((activeInvoices ?? []).map((inv) => inv.id as string))
  const billed = new Set<string>()
  for (const li of lineItems) {
    if (li.invoice_id && activeSet.has(li.invoice_id as string) && li.event_id) {
      billed.add(li.event_id as string)
    }
  }
  return billed
}

export async function getUnbilledJobs(): Promise<UnbilledJob[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const now = new Date().toISOString()

  // Step 1: all open jobs for this user
  const { data: rawJobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, business_id, client_id, job_number, title, total_estimate, client:clients(name, company)")
    .eq("user_id", userId)
    .eq("status", "open")
  if (jobsError) throw jobsError
  const jobs = (rawJobs ?? []) as unknown as RawJobRecord[]
  if (jobs.length === 0) return []

  const jobIds = jobs.map((j) => j.id)

  // Step 2: past-dated job events linked to those jobs
  const { data: rawEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, job_id, title, start_time")
    .eq("user_id", userId)
    .eq("type", "job")
    .lte("start_time", now)
    .in("job_id", jobIds)
  if (eventsError) throw eventsError
  const events = (rawEvents ?? []) as unknown as RawEventRecord[]
  if (events.length === 0) return []

  // Step 3: which of those events are billed?
  const billedEventIds = await fetchBilledEventIds(events.map((e) => e.id))

  // Step 4-6: group events by job, keep jobs with ≥1 unbilled event, build shape
  const jobMap = new Map(jobs.map((j) => [j.id, j]))
  const eventsByJob = new Map<string, RawEventRecord[]>()
  for (const ev of events) {
    if (!ev.job_id) continue
    const bucket = eventsByJob.get(ev.job_id) ?? []
    bucket.push(ev)
    eventsByJob.set(ev.job_id, bucket)
  }

  const result: UnbilledJob[] = []
  for (const [jobId, jobEvents] of eventsByJob) {
    const unbilled = jobEvents.filter((e) => !billedEventIds.has(e.id))
    if (unbilled.length === 0) continue
    const job = jobMap.get(jobId)!
    const oldestDate = unbilled.reduce(
      (min, e) => (e.start_time < min ? e.start_time : min),
      unbilled[0].start_time
    )
    result.push({
      job_id: jobId,
      job_number: job.job_number,
      job_title: job.title,
      business_id: job.business_id,
      client_id: job.client_id,
      client_name: job.client?.name ?? null,
      client_company: job.client?.company ?? null,
      total_estimate: job.total_estimate,
      unbilled_events: unbilled.map((e) => ({
        event_id: e.id,
        title: e.title,
        start_time: e.start_time,
      })),
      oldest_unbilled_date: oldestDate,
    })
  }

  result.sort((a, b) => a.oldest_unbilled_date.localeCompare(b.oldest_unbilled_date))
  return result
}

export async function isEventBilled(eventId: string): Promise<boolean> {
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

/**
 * Fetch the data needed to prefill an InvoiceForm from a job.
 * Includes ALL currently-unbilled events of the job (past and future).
 * Throws if the job doesn't exist or has zero unbilled events.
 */
export async function getInvoicePrefillForJob(jobId: string): Promise<UnbilledJob> {
  const supabase = createClient()

  const { data: rawJob, error: jobError } = await supabase
    .from("jobs")
    .select("id, business_id, client_id, job_number, title, total_estimate, client:clients(name, company)")
    .eq("id", jobId)
    .single()
  if (jobError) throw jobError
  const job = rawJob as unknown as RawJobRecord

  // No start_time filter — prefill includes future events too
  const { data: rawEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_time")
    .eq("type", "job")
    .eq("job_id", jobId)
  if (eventsError) throw eventsError
  const events = (rawEvents ?? []) as Array<{ id: string; title: string; start_time: string }>
  if (events.length === 0) throw new Error("No events found for this job")

  const billedEventIds = await fetchBilledEventIds(events.map((e) => e.id))
  const unbilled = events.filter((e) => !billedEventIds.has(e.id))
  if (unbilled.length === 0) throw new Error("No unbilled events for this job")

  const oldestDate = unbilled.reduce(
    (min, e) => (e.start_time < min ? e.start_time : min),
    unbilled[0].start_time
  )

  return {
    job_id: jobId,
    job_number: job.job_number,
    job_title: job.title,
    business_id: job.business_id,
    client_id: job.client_id,
    client_name: job.client?.name ?? null,
    client_company: job.client?.company ?? null,
    total_estimate: job.total_estimate,
    unbilled_events: unbilled.map((e) => ({
      event_id: e.id,
      title: e.title,
      start_time: e.start_time,
    })),
    oldest_unbilled_date: oldestDate,
  }
}
