import { RRule } from "rrule"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"
import type { EventFormValues } from "@/lib/validations/event"
import {
  getOccurrencesBetween,
  parseRRule,
  rruleToString,
  getAllOccurrencesCount,
} from "@/lib/recurrence"
import { createJob } from "@/lib/queries/jobs"

type EventRow = Tables<"events">

// Nested job shape projected from the jobs join.
type JobSnapshot = {
  id: string
  job_number: string
  title: string
  description: string | null
  total_estimate: number | null
  status: string
}

// CalendarEvent is either a real DB row or a synthetic recurring instance.
// Synthetic instances have is_recurring_instance=true and a composite id
// in the format `${masterId}::${occurrenceISO}`.
// job_number and job_total_amount are virtual fields projected from the jobs
// join for backward compatibility with existing consumers.
export type CalendarEvent = EventRow & {
  is_recurring_instance?: boolean
  master_id?: string
  occurrence_date?: string       // ISO string of this specific occurrence
  master_start_time?: string     // master's original dtstart (for rrule parsing)
  job_number: string | null
  job_total_amount: number | null
  job?: JobSnapshot | null
}

// Backward-compat alias — all existing code typed against CalEvent still works.
export type CalEvent = CalendarEvent

const JOB_SELECT = "*, job:jobs(id, job_number, title, description, total_estimate, status)" as const

function mapEvent(row: EventRow & { job?: JobSnapshot | null }): CalendarEvent {
  const { job, ...rest } = row as EventRow & { job?: JobSnapshot | null }
  return {
    ...rest,
    job_number: job?.job_number ?? null,
    job_total_amount: job?.total_estimate ?? null,
    job: job ?? null,
  }
}

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

// Count total occurrences and how many fall before `beforeDate`.
// Pure rrule computation — no DB call.
export function countSeriesOccurrences(
  rruleStr: string,
  dtstart: Date,
  beforeDate: Date
): { total: number; pastCount: number } {
  const total = getAllOccurrencesCount(rruleStr, dtstart)
  const rule = parseRRule(rruleStr, dtstart)
  const hasPast = rule.before(beforeDate, false)
  const pastCount = hasPast
    ? rule.between(dtstart, beforeDate, false).length
    : 0
  return { total, pastCount: Math.min(pastCount, total) }
}

// Build a modified RRULE string that adds UNTIL = `until` and clears COUNT.
function applyUntilToRRule(rruleStr: string, dtstart: Date, until: Date): string {
  const existing = parseRRule(rruleStr, dtstart)
  const opts = { ...existing.origOptions, until, count: undefined }
  return rruleToString(new RRule(opts))
}

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

// ─────────────────────────────────────────────────────────────────────────────
// Read queries
// ─────────────────────────────────────────────────────────────────────────────

export async function listEventsBetween(
  start: Date,
  end: Date
): Promise<CalendarEvent[]> {
  const supabase = createClient()

  // 1. One-off events that overlap the range.
  const { data: oneOffs, error: e1 } = await supabase
    .from("events")
    .select(JOB_SELECT)
    .is("rrule", null)
    .lt("start_time", end.toISOString())
    .gte("end_time", start.toISOString())
  if (e1) throw e1

  // 2. Recurring masters whose window overlaps the range.
  const { data: masters, error: e2 } = await supabase
    .from("events")
    .select(JOB_SELECT)
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
  for (const masterRaw of masters ?? []) {
    if (!masterRaw.rrule) continue

    const master = mapEvent(masterRaw as unknown as EventRow & { job?: JobSnapshot | null })

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
      master.rrule!,
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
  const mappedOneOffs = (oneOffs ?? []).map(
    (r) => mapEvent(r as unknown as EventRow & { job?: JobSnapshot | null })
  )
  const combined: CalendarEvent[] = [...mappedOneOffs, ...instances]
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
    .select(JOB_SELECT)
    .eq("id", masterId)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  if (!data) return null

  const mapped = mapEvent(data as unknown as EventRow & { job?: JobSnapshot | null })

  if (occurrenceDate && mapped.rrule) {
    const dtstart = new Date(mapped.start_time)
    const duration =
      new Date(mapped.end_time).getTime() - dtstart.getTime()
    return {
      ...mapped,
      id,
      start_time: occurrenceDate.toISOString(),
      end_time: new Date(occurrenceDate.getTime() + duration).toISOString(),
      is_recurring_instance: true,
      master_id: mapped.id,
      occurrence_date: occurrenceDate.toISOString(),
      master_start_time: mapped.start_time,
    }
  }

  return mapped
}

// ─────────────────────────────────────────────────────────────────────────────
// One-off create / update / delete
// ─────────────────────────────────────────────────────────────────────────────

export async function createEvent(values: EventFormValues): Promise<CalendarEvent> {
  const supabase = createClient()
  const userId = await getUserId()

  if (values.type === "job" && values.business_id && values.client_id) {
    // 1. Atomically create the job (generates number + inserts jobs row).
    const newJob = await createJob({
      business_id: values.business_id,
      client_id: values.client_id,
      title: values.title,
      description: values.description || null,
      total_estimate: null,
    })

    // 2. Insert the event row linked to the new job.
    try {
      const { data, error } = await supabase
        .from("events")
        .insert({
          user_id: userId,
          type: values.type,
          title: values.title,
          business_id: values.business_id,
          client_id: values.client_id,
          meeting_purpose: values.meeting_purpose,
          golf_purpose: values.golf_purpose ?? null,
          start_time: values.start_time.toISOString(),
          end_time: values.end_time.toISOString(),
          all_day: values.all_day,
          location: values.location || null,
          description: values.description || null,
          color_override: values.color_override,
          rrule: null,
          recurrence_end_date: null,
          reminder_for_client_id: values.reminder_for_client_id ?? null,
          job_id: newJob.id,
        })
        .select(JOB_SELECT)
        .single()
      if (error) throw error
      return mapEvent(data as unknown as EventRow & { job?: JobSnapshot | null })
    } catch (err) {
      // Rollback: delete the orphaned job to avoid dangling rows.
      await supabase.from("jobs").delete().eq("id", newJob.id)
      throw err
    }
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      type: values.type,
      title: values.title,
      business_id: values.business_id,
      client_id: values.client_id,
      meeting_purpose: values.meeting_purpose,
      golf_purpose: values.golf_purpose ?? null,
      start_time: values.start_time.toISOString(),
      end_time: values.end_time.toISOString(),
      all_day: values.all_day,
      location: values.location || null,
      description: values.description || null,
      color_override: values.color_override,
      rrule: values.rrule ?? null,
      recurrence_end_date: values.recurrence_end_date
        ? values.recurrence_end_date.toISOString()
        : null,
      reminder_for_client_id: values.reminder_for_client_id ?? null,
    })
    .select(JOB_SELECT)
    .single()

  if (error) throw error
  return mapEvent(data as unknown as EventRow & { job?: JobSnapshot | null })
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
      golf_purpose: values.golf_purpose ?? null,
      start_time: values.start_time.toISOString(),
      end_time: values.end_time.toISOString(),
      all_day: values.all_day,
      location: values.location || null,
      description: values.description || null,
      color_override: values.color_override,
      rrule: values.rrule ?? null,
      recurrence_end_date: values.recurrence_end_date
        ? values.recurrence_end_date.toISOString()
        : null,
      reminder_for_client_id: values.reminder_for_client_id ?? null,
    })
    .eq("id", id)
    .select(JOB_SELECT)
    .single()
  if (error) throw error
  return mapEvent(data as unknown as EventRow & { job?: JobSnapshot | null })
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

// ─────────────────────────────────────────────────────────────────────────────
// Recurring-aware mutations
// ─────────────────────────────────────────────────────────────────────────────

// Build a canonical event payload from form values (shared across insert helpers).
// job_total_amount and job_number have moved to the jobs table; job_id on events
// is set only at creation time and not touched by these recurring helpers.
function eventPayload(values: EventFormValues, userId: string) {
  return {
    user_id: userId,
    type: values.type,
    title: values.title,
    business_id: values.business_id,
    client_id: values.client_id,
    meeting_purpose: values.meeting_purpose,
    golf_purpose: values.golf_purpose ?? null,
    all_day: values.all_day,
    location: values.location || null,
    description: values.description || null,
    color_override: values.color_override,
    reminder_for_client_id: values.reminder_for_client_id ?? null,
  }
}

// Edit ── single occurrence (creates override event + exception row).
export async function updateRecurringSingle(
  masterId: string,
  occurrenceDate: Date,
  values: EventFormValues
): Promise<void> {
  const supabase = createClient()
  const userId = await getUserId()
  const occISO = occurrenceDate.toISOString()

  // Remove any existing modified override for this occurrence.
  await supabase
    .from("events")
    .delete()
    .eq("parent_event_id", masterId)
    .eq("original_occurrence_date", occISO)

  // Insert override event.
  const { data: overrideRow, error: insertErr } = await supabase
    .from("events")
    .insert({
      ...eventPayload(values, userId),
      start_time: values.start_time.toISOString(),
      end_time: values.end_time.toISOString(),
      parent_event_id: masterId,
      original_occurrence_date: occISO,
      rrule: null,
      recurrence_end_date: null,
    })
    .select("id")
    .single()
  if (insertErr) throw insertErr

  // Remove any existing exception row for this date, then insert fresh.
  await supabase
    .from("event_exceptions")
    .delete()
    .eq("event_id", masterId)
    .eq("original_occurrence_date", occISO)

  const { error: exErr } = await supabase.from("event_exceptions").insert({
    user_id: userId,
    event_id: masterId,
    original_occurrence_date: occISO,
    action: "modified",
    modified_event_id: overrideRow.id,
  })

  if (exErr) {
    // Rollback override row on exception insert failure.
    await supabase.from("events").delete().eq("id", overrideRow.id)
    throw exErr
  }
}

// Edit ── this and following (truncates master, inserts new tail-series master).
export async function updateRecurringFollowing(
  masterId: string,
  occurrenceDate: Date,
  values: EventFormValues
): Promise<void> {
  const supabase = createClient()
  const userId = await getUserId()
  const occISO = occurrenceDate.toISOString()

  // Fetch master for its current rrule.
  const { data: master, error: fetchErr } = await supabase
    .from("events")
    .select("rrule, start_time, end_time")
    .eq("id", masterId)
    .single()
  if (fetchErr) throw fetchErr
  if (!master?.rrule) throw new Error("Master event has no rrule")

  // Truncate master series just before this occurrence.
  const newMasterEnd = new Date(occurrenceDate.getTime() - 1000)
  const newMasterRRule = applyUntilToRRule(
    master.rrule,
    new Date(master.start_time),
    newMasterEnd
  )

  const { error: masterUpdateErr } = await supabase
    .from("events")
    .update({
      rrule: newMasterRRule,
      recurrence_end_date: newMasterEnd.toISOString(),
    })
    .eq("id", masterId)
  if (masterUpdateErr) throw masterUpdateErr

  // Clean up future exceptions and overrides from the original master.
  await supabase
    .from("event_exceptions")
    .delete()
    .eq("event_id", masterId)
    .gte("original_occurrence_date", occISO)

  await supabase
    .from("events")
    .delete()
    .eq("parent_event_id", masterId)
    .gte("original_occurrence_date", occISO)

  // Tail series start: occurrence date + values' time-of-day.
  const tailStart = new Date(occurrenceDate)
  tailStart.setHours(
    values.start_time.getHours(),
    values.start_time.getMinutes(),
    0,
    0
  )
  const tailDuration =
    values.end_time.getTime() - values.start_time.getTime()
  const tailEnd = new Date(tailStart.getTime() + tailDuration)

  const { error: tailErr } = await supabase.from("events").insert({
    ...eventPayload(values, userId),
    start_time: tailStart.toISOString(),
    end_time: tailEnd.toISOString(),
    parent_event_id: masterId,
    rrule: values.rrule ?? null,
    recurrence_end_date: values.recurrence_end_date
      ? values.recurrence_end_date.toISOString()
      : null,
  })
  if (tailErr) throw tailErr
}

// Edit ── all occurrences (updates master, clears exceptions/overrides).
export async function updateRecurringAll(
  masterId: string,
  values: EventFormValues
): Promise<{ clearedCount: number }> {
  const supabase = createClient()

  // Count and clear exceptions.
  const { data: exRows } = await supabase
    .from("event_exceptions")
    .select("id")
    .eq("event_id", masterId)
  const clearedCount = exRows?.length ?? 0

  await supabase.from("event_exceptions").delete().eq("event_id", masterId)

  // Delete override events (single-occurrence rows pointing to this master).
  await supabase
    .from("events")
    .delete()
    .eq("parent_event_id", masterId)
    .not("original_occurrence_date", "is", null)

  // Update master.
  const { error } = await supabase
    .from("events")
    .update({
      type: values.type,
      title: values.title,
      business_id: values.business_id,
      client_id: values.client_id,
      meeting_purpose: values.meeting_purpose,
      golf_purpose: values.golf_purpose ?? null,
      start_time: values.start_time.toISOString(),
      end_time: values.end_time.toISOString(),
      all_day: values.all_day,
      location: values.location || null,
      description: values.description || null,
      color_override: values.color_override,
      reminder_for_client_id: values.reminder_for_client_id ?? null,
      rrule: values.rrule ?? null,
      recurrence_end_date: values.recurrence_end_date
        ? values.recurrence_end_date.toISOString()
        : null,
    })
    .eq("id", masterId)
  if (error) throw error

  return { clearedCount }
}

// Delete ── single occurrence (inserts cancelled exception).
export async function deleteRecurringSingle(
  masterId: string,
  occurrenceDate: Date
): Promise<void> {
  const supabase = createClient()
  const userId = await getUserId()
  const occISO = occurrenceDate.toISOString()

  // Remove any existing modified override for this occurrence first.
  await supabase
    .from("events")
    .delete()
    .eq("parent_event_id", masterId)
    .eq("original_occurrence_date", occISO)

  // Remove any existing exception, then insert cancelled.
  await supabase
    .from("event_exceptions")
    .delete()
    .eq("event_id", masterId)
    .eq("original_occurrence_date", occISO)

  const { error } = await supabase.from("event_exceptions").insert({
    user_id: userId,
    event_id: masterId,
    original_occurrence_date: occISO,
    action: "cancelled",
    modified_event_id: null,
  })
  if (error) throw error
}

// Delete ── this and following (truncates master series, cleans future rows).
export async function deleteRecurringFollowing(
  masterId: string,
  occurrenceDate: Date
): Promise<void> {
  const supabase = createClient()
  const occISO = occurrenceDate.toISOString()

  const { data: master, error: fetchErr } = await supabase
    .from("events")
    .select("rrule, start_time")
    .eq("id", masterId)
    .single()
  if (fetchErr) throw fetchErr
  if (!master?.rrule) throw new Error("Master event has no rrule")

  const newMasterEnd = new Date(occurrenceDate.getTime() - 1000)
  const newRRule = applyUntilToRRule(
    master.rrule,
    new Date(master.start_time),
    newMasterEnd
  )

  const { error: updateErr } = await supabase
    .from("events")
    .update({
      rrule: newRRule,
      recurrence_end_date: newMasterEnd.toISOString(),
    })
    .eq("id", masterId)
  if (updateErr) throw updateErr

  await supabase
    .from("event_exceptions")
    .delete()
    .eq("event_id", masterId)
    .gte("original_occurrence_date", occISO)

  await supabase
    .from("events")
    .delete()
    .eq("parent_event_id", masterId)
    .gte("original_occurrence_date", occISO)
}

// Delete ── all occurrences (deletes master + everything referencing it).
export async function deleteRecurringAll(masterId: string): Promise<void> {
  const supabase = createClient()

  // Delete children explicitly in case the DB lacks CASCADE.
  await supabase.from("event_exceptions").delete().eq("event_id", masterId)
  await supabase.from("events").delete().eq("parent_event_id", masterId)

  const { error } = await supabase.from("events").delete().eq("id", masterId)
  if (error) throw error
}
