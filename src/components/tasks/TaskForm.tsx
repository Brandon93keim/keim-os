"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, parseISO } from "date-fns"
import { Trash2 } from "lucide-react"
import {
  taskFormSchema,
  type TaskFormValues,
  type TaskFormInput,
} from "@/lib/validations/task"
import { BUSINESSES } from "@/lib/constants"
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type TaskWithRelations,
} from "@/lib/hooks/useTasks"
import { useClients } from "@/lib/hooks/useClients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import type { BUSINESS_IDS } from "@/lib/validations/client"

interface Props {
  task?: TaskWithRelations | null
  onSuccess: () => void
  onCancel: () => void
}

function buildDefaultValues(task?: TaskWithRelations | null): TaskFormInput {
  if (task) {
    return {
      title: task.title,
      notes: task.notes ?? null,
      due_on: task.due_on ? parseISO(task.due_on) : null,
      due_time: task.due_time ?? null,
      client_id: task.client_id ?? null,
      business_id: (task.business_id as (typeof BUSINESS_IDS)[number] | null) ?? null,
    }
  }
  return {
    title: "",
    notes: null,
    due_on: new Date(),
    due_time: null,
    client_id: null,
    business_id: null,
  }
}

export function TaskForm({ task, onSuccess, onCancel }: Props) {
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: clients = [] } = useClients()

  const [calOpen, setCalOpen] = useState(false)

  const form = useForm<TaskFormInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: buildDefaultValues(task),
  })

  const watchedDueOn = form.watch("due_on")
  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(raw: TaskFormInput) {
    const values = raw as TaskFormValues
    const payload = {
      title: values.title,
      notes: values.notes ?? null,
      due_on: values.due_on ? format(values.due_on, "yyyy-MM-dd") : null,
      due_time: values.due_time ?? null,
      client_id: values.client_id ?? null,
      business_id: values.business_id ?? null,
    }

    if (task) {
      updateTask.mutate({ id: task.id, values: payload }, { onSuccess })
    } else {
      createTask.mutate(payload, { onSuccess })
    }
  }

  function handleDelete() {
    if (!task) return
    deleteTask.mutate(task.id, { onSuccess })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 pb-6 space-y-5">

          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input placeholder="Task title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Due date */}
          <FormField
            control={form.control}
            name="due_on"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date</FormLabel>
                <div className="flex gap-2">
                  <Popover open={calOpen} onOpenChange={setCalOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 justify-start font-normal h-9"
                      >
                        {field.value instanceof Date
                          ? format(field.value, "MMM d, yyyy")
                          : "No date (backlog)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value instanceof Date ? field.value : undefined}
                        onSelect={(date) => {
                          field.onChange(date ?? null)
                          if (!date) {
                            form.setValue("due_time", null)
                          }
                          setCalOpen(false)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {field.value && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3 text-muted-foreground"
                      onClick={() => {
                        field.onChange(null)
                        form.setValue("due_time", null)
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Due time */}
          <FormField
            control={form.control}
            name="due_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={cn(!watchedDueOn && "text-muted-foreground")}>
                  Due time
                </FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    className="h-9"
                    disabled={!watchedDueOn}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Business */}
          <FormField
            control={form.control}
            name="business_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business</FormLabel>
                <div className="flex flex-wrap gap-2">
                  <button
                    key="personal"
                    type="button"
                    onClick={() => field.onChange(field.value === null ? null : null)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]",
                      field.value === null
                        ? "bg-muted border-transparent text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Personal
                  </button>
                  {BUSINESSES.map((biz) => {
                    const selected = field.value === biz.id
                    return (
                      <button
                        key={biz.id}
                        type="button"
                        onClick={() => field.onChange(selected ? null : biz.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]",
                          selected
                            ? "border-transparent"
                            : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                        )}
                        style={selected ? { backgroundColor: biz.color, color: biz.textColor } : {}}
                      >
                        {biz.name}
                      </button>
                    )
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Client */}
          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                  value={field.value ?? "__none__"}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select client…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.company ? ` — ${c.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional notes…"
                    rows={3}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        {/* Sticky footer */}
        <div
          className="shrink-0 border-t border-border bg-popover px-4 py-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-3">
            {task && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive hover:text-destructive shrink-0"
                  >
                    <Trash2 size={18} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete task?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 h-11"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-11">
              {isSubmitting ? "Saving…" : task ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
