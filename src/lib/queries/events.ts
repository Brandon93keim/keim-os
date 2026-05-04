import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"
import type { EventFormValues } from "@/lib/validations/event"

export type CalEvent = Tables<"events">

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
): Promise<CalEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .is("rrule", null)
    .lt("start_time", end.toISOString())
    .gte("end_time", start.toISOString())
    .order("start_time")
  if (error) throw error
  return data ?? []
}

export async function getEvent(id: string): Promise<CalEvent> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data
}

export async function createEvent(values: EventFormValues): Promise<CalEvent> {
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
): Promise<CalEvent> {
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
