"use client"

import { useToggleTaskStatus, type TaskWithRelations } from "@/lib/hooks/useTasks"
import { getEffectiveTaskStatus, STATUS_COLORS } from "@/lib/taskStatus"
import { getBusinessById } from "@/lib/constants"

interface Props {
  task: TaskWithRelations
  today: string
  compact?: boolean
}

export function TaskMarker({ task, today, compact }: Props) {
  const toggle = useToggleTaskStatus()
  const status = getEffectiveTaskStatus(task, today)
  const biz = task.business_id ? getBusinessById(task.business_id) : null
  const color = status === "overdue" ? STATUS_COLORS.overdue : (biz?.color ?? "#6B7280")

  function handleCheck(e: React.MouseEvent) {
    e.stopPropagation()
    toggle.mutate({ id: task.id, done: true })
  }

  return (
    <button
      type="button"
      onClick={handleCheck}
      aria-label={`Complete: ${task.title}`}
      className={`inline-flex items-center shrink-0 rounded-full overflow-hidden active:opacity-70 ${
        compact ? "gap-0.5 px-1 h-5" : "gap-1 px-1.5 h-6"
      }`}
      style={{
        backgroundColor: color + "26",
        border: `1px solid ${color}`,
        color: color + "e6",
      }}
    >
      {/* checkbox affordance */}
      <span
        className={`shrink-0 rounded-sm border flex items-center justify-center ${
          compact ? "w-3 h-3" : "w-3.5 h-3.5"
        }`}
        style={{ borderColor: color }}
      />
      <span className={`truncate font-medium ${compact ? "text-[9px] max-w-[55px]" : "text-[10px] max-w-[100px]"}`}>
        {task.title}
      </span>
    </button>
  )
}
