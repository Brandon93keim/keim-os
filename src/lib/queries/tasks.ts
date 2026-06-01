import { createClient } from "@/lib/supabase/client"

export type TaskRow = {
  id: string
  user_id: string
  title: string
  notes: string | null
  due_on: string | null
  due_time: string | null
  status: string
  completed_at: string | null
  client_id: string | null
  business_id: string | null
  job_id: string | null
  created_at: string
  updated_at: string
}

export type TaskWithRelations = TaskRow & {
  client_name: string | null
  job_number: string | null
  job_title: string | null
}

type TaskInsertValues = {
  title: string
  notes?: string | null
  due_on?: string | null
  due_time?: string | null
  client_id?: string | null
  business_id?: string | null
  job_id?: string | null
}

type TaskUpdateValues = Partial<TaskInsertValues> & {
  status?: string
  completed_at?: string | null
}

const TASK_SELECT =
  "*, client:clients(name), job:jobs(job_number, title)" as const

type TaskRaw = TaskRow & {
  client: { name: string } | null
  job: { job_number: string; title: string } | null
}

function mapTask(raw: TaskRaw): TaskWithRelations {
  const { client, job, ...rest } = raw
  return {
    ...rest,
    client_name: client?.name ?? null,
    job_number: job?.job_number ?? null,
    job_title: job?.title ?? null,
  }
}

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

export async function listTasks(): Promise<TaskWithRelations[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("user_id", userId)
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => mapTask(r as unknown as TaskRaw))
}

export async function createTask(values: TaskInsertValues): Promise<TaskWithRelations> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: values.title,
      notes: values.notes ?? null,
      due_on: values.due_on ?? null,
      due_time: values.due_time ?? null,
      client_id: values.client_id ?? null,
      business_id: values.business_id ?? null,
      job_id: values.job_id ?? null,
    })
    .select(TASK_SELECT)
    .single()
  if (error) throw error
  return mapTask(data as unknown as TaskRaw)
}

export async function updateTask(
  id: string,
  values: TaskUpdateValues
): Promise<TaskWithRelations> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("tasks")
    .update(values)
    .eq("id", id)
    .select(TASK_SELECT)
    .single()
  if (error) throw error
  return mapTask(data as unknown as TaskRaw)
}

export async function toggleTaskStatus(
  id: string,
  done: boolean
): Promise<TaskWithRelations> {
  return updateTask(id, {
    status: done ? "done" : "open",
    completed_at: done ? new Date().toISOString() : null,
  })
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("tasks").delete().eq("id", id)
  if (error) throw error
}

export async function listTasksForJob(jobId: string): Promise<TaskWithRelations[]> {
  const supabase = createClient()
  const userId = await getUserId()
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => mapTask(r as unknown as TaskRaw))
}
