export type TaskStatus = "open" | "done" | "overdue"

type TaskLike = {
  status: string
  due_on: string | null
}

export function getEffectiveTaskStatus(task: TaskLike, today: string): TaskStatus {
  if (task.status === "done") return "done"
  if (task.due_on != null && task.due_on < today) return "overdue"
  return "open"
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open:    "Open",
  done:    "Done",
  overdue: "Overdue",
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  open:    "#2563EB",
  done:    "#16A34A",
  overdue: "#DC2626",
}
