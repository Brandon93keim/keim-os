"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { CheckSquare, Plus } from "lucide-react"
import { useTasks, useToggleTaskStatus, type TaskWithRelations } from "@/lib/hooks/useTasks"
import { getEffectiveTaskStatus } from "@/lib/taskStatus"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/PageHeader"
import { TaskFormSheet } from "./TaskFormSheet"

type View = "open" | "done"

function formatTaskDue(task: TaskWithRelations): string | null {
  if (!task.due_on) return null
  const today = format(new Date(), "yyyy-MM-dd")
  const isToday = task.due_on === today
  const isOverdue = task.due_on < today

  let datePart: string
  if (isToday) {
    datePart = "Today"
  } else if (isOverdue) {
    datePart = `Overdue · ${format(parseISO(task.due_on), "MMM d")}`
  } else {
    datePart = format(parseISO(task.due_on), "MMM d")
  }

  if (task.due_time) {
    const [h, m] = task.due_time.split(":")
    const d = new Date()
    d.setHours(Number(h), Number(m), 0, 0)
    return `${datePart} · ${format(d, "h:mm a")}`
  }

  return datePart
}

interface TaskRowProps {
  task: TaskWithRelations
  onEdit: (task: TaskWithRelations) => void
}

function TaskRow({ task, onEdit }: TaskRowProps) {
  const toggle = useToggleTaskStatus()
  const isDone = task.status === "done"
  const business = task.business_id ? getBusinessById(task.business_id) : null
  const dueLabel = formatTaskDue(task)

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    toggle.mutate({ id: task.id, done: !isDone })
  }

  return (
    <button
      type="button"
      onClick={() => onEdit(task)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-accent/50 transition-colors"
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
        className="shrink-0 w-5 h-5 rounded border border-border flex items-center justify-center transition-colors hover:border-primary"
        style={isDone ? { backgroundColor: "hsl(var(--primary))", borderColor: "hsl(var(--primary))" } : {}}
      >
        {isDone && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {dueLabel && (
            <span className={`text-xs ${
              !isDone && task.due_on && task.due_on < format(new Date(), "yyyy-MM-dd")
                ? "text-destructive"
                : "text-muted-foreground"
            }`}>
              {dueLabel}
            </span>
          )}
          {task.client_name && dueLabel && (
            <span className="text-xs text-muted-foreground">·</span>
          )}
          {task.client_name && (
            <span className="text-xs text-muted-foreground truncate">{task.client_name}</span>
          )}
        </div>
      </div>

      {/* Business color dot */}
      {business ? (
        <div
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: business.color }}
        />
      ) : (
        <span className="h-2 w-2 shrink-0" />
      )}
    </button>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-4 pb-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-1 px-4 pt-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-5 w-5 rounded shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyOpen({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 pt-20 text-center">
      <div className="rounded-full bg-muted p-4">
        <CheckSquare size={28} className="text-muted-foreground" />
      </div>
      <p className="font-medium">No open tasks</p>
      <p className="text-sm text-muted-foreground">Create a task to get started.</p>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus size={16} />
        New task
      </button>
    </div>
  )
}

function EmptyDone() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 pt-20 text-center">
      <p className="font-medium text-muted-foreground">No completed tasks</p>
    </div>
  )
}

export function TaskList() {
  const { data: tasks, isLoading, error } = useTasks()
  const [view, setView] = useState<View>("open")
  const [editTask, setEditTask] = useState<TaskWithRelations | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const today = format(new Date(), "yyyy-MM-dd")

  const openTasks = (tasks ?? []).filter((t) => t.status !== "done")
  const doneTasks = (tasks ?? []).filter((t) => t.status === "done")

  // Bucket open tasks into urgency sections
  const overdue = openTasks.filter((t) => getEffectiveTaskStatus(t, today) === "overdue")
  const todayTasks = openTasks.filter((t) => t.due_on === today)
  const upcoming = openTasks.filter((t) => t.due_on && t.due_on > today)
  const noDate = openTasks.filter((t) => !t.due_on)

  const sections = [
    { key: "overdue", label: "Overdue", tasks: overdue },
    { key: "today", label: "Today", tasks: todayTasks },
    { key: "upcoming", label: "Upcoming", tasks: upcoming },
    { key: "nodate", label: "No date", tasks: noDate },
  ].filter((s) => s.tasks.length > 0)

  function handleEdit(task: TaskWithRelations) {
    setEditTask(task)
  }

  function handleEditClose() {
    setEditTask(null)
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        gearGutter
        below={
          <div className="px-4 pb-3">
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList className="w-full">
                <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
                <TabsTrigger value="done" className="flex-1">Done</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      />

      {/* Body */}
      <div className="pb-4">
        {isLoading && <ListSkeleton />}

        {error && (
          <div className="px-4 py-8 text-center text-sm text-destructive">
            Failed to load tasks.
          </div>
        )}

        {!isLoading && !error && view === "open" && (
          <>
            {sections.length === 0 && <EmptyOpen onNew={() => setCreateOpen(true)} />}
            {sections.map((section) => (
              <div key={section.key}>
                <SectionHeader label={section.label} />
                <div className="divide-y divide-border">
                  {section.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onEdit={handleEdit} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {!isLoading && !error && view === "done" && (
          <>
            {doneTasks.length === 0 && <EmptyDone />}
            <div className="divide-y divide-border mt-2">
              {doneTasks.map((task) => (
                <TaskRow key={task.id} task={task} onEdit={handleEdit} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="fixed z-30 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          bottom: "calc(var(--bottom-nav-clearance) + 0.5rem)",
          right: 16,
        }}
        aria-label="New task"
      >
        <Plus size={24} />
      </button>

      {/* Create sheet */}
      <TaskFormSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Edit sheet */}
      <TaskFormSheet
        open={!!editTask}
        onClose={handleEditClose}
        task={editTask}
      />
    </>
  )
}
