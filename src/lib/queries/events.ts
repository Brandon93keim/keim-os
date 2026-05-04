import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"
import type { EventFormValues } from "@/lib/validations/event"
import { getOccurrencesBetween } from "@/lib/recurrence"

type EventRow = Tables<"events">

// CalendarEvent is either a real DB row or a synthetic recurring instance.
// Synthetic instances have is_recurring_instance=true and a composite id
// in the format `${masterId}::${occurrenceISO}`.
export type CalendarEvent = EventRow & {
  is_recurring_instance?: boolean
  master_id?: string
  occurrence_date?: string       // ISO string of this specific occurrence
  master_start_time?: string     // master's original dtstart (for rrule parsing)
}

// Backward-compat alias — all existing code typed against CalEvent still works.
export type CalEvent = CalendarEvent

// Parse a synthetic composite id back to its parts.
export function parseEventId(id: string): {
  masterId: string
  occurrenceDate: Date | null
} {
  if (id.includes("::")) {
    const [masterId, iso] = id.split("::")
    return { masterId: masterId!, occurrenceDate: new Date(iso!) }
  }
  return { masterId: id, occurrenceDate: null }
}

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

export async function listEventsBetween(
  start: Date,
  end: Date
): Promise<CalendarEvent[]> {
  const supabase = createClient()

  // 1. One-off events that overlap the range.
  const { data: oneOffs, error: e1 } = await supabase
    .from("events")
    .select("*")
    .is("rrule", null)
    .lt("start_time", end.toISOString())
    .gte("end_time", start.toISOString())
  if (e1) throw e1

  // 2. Recurring masters whose window overlaps the range.
  const { data: masters, error: e2 } = await supabase
    .from("events")
    .select("*")
    .not("rrule", "is", null)
    .lte("start_time", end.toISOString())
    .or(`recurrence_end_date.is.null,recurrence_end_date.gte.${start.toISOString()}`)
  if (e2) throw e2

  // 3. Exceptions for those masters (cancelled / modified occurrences).
  const masterIds = (masters ?? []).map((m) => m.id)
  let exceptions: Array<{
    event_id: string
    original_occurrence_date: string
    action: "cancelled" | "modified"
  }> = []
  if (masterIds.length > 0) {
    const { data: exRows, error: e3 } = await supabase
      .from("event_exceptions")
      .select("event_id, original_occurrence_date, action")
      .in("event_id", masterIds)
    if (e3) throw e3
    exceptions = (exRows ?? []) as typeof exceptions
  }

  // 4. Expand each master into synthetic CalendarEvent instances.
  const instances: CalendarEvent[] = []
  for (const master of masters ?? []) {
    if (!master.rrule) continue

    const masterExceptions = exceptions
      .filter((ex) => ex.event_id === master.id)
      .map((ex) => ({
        original_occurrence_date: new Date(ex.original_occurrence_date),
        action: ex.action,
      }))

    const dtstart = new Date(master.start_time)
    const duration =
      new Date(master.end_time).getTime() - dtstart.getTime()

    const occurrences = getOccurrencesBetween(
      master.rrule,
      dtstart,
      start,
      end,
      masterExceptions
    )

    for (const occ of occurrences) {
      instances.push({
        ...master,
        id: `${master.id}::${occ.toISOString()}`,
        start_time: occ.toISOString(),
        end_time: new Date(occ.getTime() + duration).toISOString(),
        is_recurring_instance: true,
        master_id: master.id,
        occurrence_date: occ.toISOString(),
        master_start_time: master.start_time,
      })
    }
  }

  // 5. Merge and sort.
  const combined: CalendarEvent[] = [...(oneOffs ?? []), ...instances]
  combined.sort(
    (a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )
  return combined
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const { masterId, occurrenceDate } = parseEventId(id)

  const supabase = createClient()
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", masterId)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  if (!data) return null

  if (occurrenceDate && data.rrule) {
    const dtstart = new Date(data.start_time)
    const duration =
      new Date(data.end_time).getTime() - dtstart.getTime()
    return {
      ...data,
      id,
      start_time: occurrenceDate.toISOString(),
      end_time: new Date(occurrenceDate.getTime() + duration).toISOString(),
      is_recurring_instance: true,
      master_id: data.id,
      occurrence_date: occurrenceDate.toISOString(),
      master_start_time: data.start_time,
    }
  }

  return data
}

export async function createEvent(values: EventFormValues): Promise<CalendarEvent> {
  const supabase = createClient()
  const userId = await getUserId()

  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      type: values.type,
      title: values.title,
      business_id: values.business_id,
      client_id: values.client_id,
      meeting_purpose: values.meeting_purpose,
      start_time: values.start_time.toISOString(),
      end_time: values.end_time.toISOString(),
      all_day: values.all_day,
      location: values.location || null,
      description: values.description || null,
      job_total_amount: values.job_total_amount,
      color_override: values.color_override,
      rrule: values.rrule ?? null,
      recurrence_end_date: values.recurrence_end_date
        ? values.recurrence_end_date.toISOString()
        : null,
      reminder_for_client_id: values.reminder_for_client_id ?? null,
    })
    .select()
    .single()

  if (error) throw error

  if (values.type === "job" && values.business_id) {
    const { data: jobNum, error: rpcErr } = await supabase.rpc(
      "generate_job_number",
      { p_business_id: values.business_id }
    )
    if (rpcErr) {
      await supabase.from("events").delete().eq("id", data.id)
      throw rpcErr
    }
    const { data: updated, error: updateErr } = await supabase
      .from("events")
      .update({ job_number: jobNum })
      .eq("id", data.id)
      .select()
      .single()
    if (updateErr) throw updateErr
    return updated
  }

  return data
}

export async function updateEvent(
  id: string,
  values: EventFormValues
): Promise<CalendarEvent> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("events")
    .update({
      type: values.type,
      title: values.title,
      business_id: values.business_id,
      client_id: values.client_id,
      meeting_purpose: values.meeting_purpose,
      start_time: values.start_time.toISOString(),
      end_time: values.end_time.toISOString(),
      all_day: values.all_day,
      location: values.location || null,
      description: values.description || null,
      job_total_amount: values.job_total_amount,
      color_override: values.color_override,
      rrule: values.rrule ?? null,
      recurrence_end_date: values.recurrence_end_date
        ? values.recurrence_end_date.toISOString()
        : null,
      reminder_for_client_id: values.reminder_for_client_id ?? null,
    })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("events").delete().eq("id", id)
  if (error) throw error
}

export async function updateEventStatus(
  id: string,
  status: string
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", id)
  if (error) throw error
}
