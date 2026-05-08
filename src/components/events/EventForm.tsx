"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, addHours } from "date-fns"
import { ChevronRight, Trash2 } from "lucide-react"
import {
  eventFormSchema,
  type EventFormValues,
  type EventFormInput,
} from "@/lib/validations/event"
import { BUSINESSES } from "@/lib/constants"
import { BUSINESS_IDS } from "@/lib/validations/client"
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useUpdateRecurringSingle,
  useUpdateRecurringFollowing,
  useUpdateRecurringAll,
  type CalEvent,
} from "@/lib/hooks/useEvents"
import { useClients } from "@/lib/hooks/useClients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import {
  type RecurrenceConfig,
  buildRRule,
  rruleToString,
  configFromRRule,
  describeRecurrence,
} from "@/lib/recurrence"
import { RecurrencePicker } from "./RecurrencePicker"
import type { RecurringScope } from "./RecurringEditDialog"

const EVENT_TYPES = [
  { value: "job", label: "Job" },
  { value: "meeting", label: "Meeting" },
  { value: "personal", label: "Personal" },
  { value: "reminder", label: "Reminder" },
  { value: "golf", label: "Golf" },
] as const

const MEETING_PURPOSES = [
  { value: "prospect_meeting", label: "Prospect" },
  { value: "existing_client", label: "Existing Client" },
  { value: "internal", label: "Internal" },
  { value: "personal", label: "Personal" },
] as const

interface FormDefaults {
  start_time?: Date
  end_time?: Date
  type?: EventFormValues["type"]
}

interface Props {
  event?: CalEvent | null
  defaults?: FormDefaults
  onSuccess: () => void
  onCancel: () => void
  recurringEditScope?: RecurringScope
  recurringMasterId?: string
  recurringOccurrenceDate?: Date
}

function buildDefaultValues(event?: CalEvent | null, defaults?: FormDefaults): EventFormInput {
  if (event) {
    const start = new Date(event.start_time)
    const end = new Date(event.end_time)
    return {
      type: event.type as EventFormValues["type"],
      title: event.title,
      business_id: (event.business_id as (typeof BUSINESS_IDS)[number] | null) ?? null,
      client_id: event.client_id ?? null,
      meeting_purpose: (event.meeting_purpose as EventFormValues["meeting_purpose"]) ?? null,
      start_time: start,
      end_time: end,
      all_day: event.all_day,
      location: event.location ?? "",
      description: event.description ?? "",
      job_total_amount: event.job_total_amount ?? null,
      color_override: event.color_override ?? null,
      rrule: null,
      recurrence_end_date: null,
      reminder_for_client_id: event.reminder_for_client_id ?? null,
    }
  }

  const start = defaults?.start_time ?? new Date()
  const end = defaults?.end_time ?? addHours(start, 1)

  return {
    type: defaults?.type ?? "job",
    title: "",
    business_id: null,
    client_id: null,
    meeting_purpose: null,
    start_time: start,
    end_time: end,
    all_day: false,
    location: "",
    description: "",
    job_total_amount: null,
    color_override: null,
    rrule: null,
    recurrence_end_date: null,
    reminder_for_client_id: null,
  }
}

function formatDateValue(date: Date) {
  return format(date, "MMM d, yyyy")
}

function timeToHHMM(date: Date): string {
  return format(date, "HH:mm")
}

function setTimeOnDate(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number)
  const result = new Date(base)
  result.setHours(h ?? 0, m ?? 0, 0, 0)
  return result
}

export function EventForm({
  event,
  defaults,
  onSuccess,
  onCancel,
  recurringEditScope,
  recurringMasterId,
  recurringOccurrenceDate,
}: Props) {
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()
  const updateRecurringSingle = useUpdateRecurringSingle()
  const updateRecurringFollowing = useUpdateRecurringFollowing()
  const updateRecurringAll = useUpdateRecurringAll()
  const { data: clients = [] } = useClients()

  // Tracks whether the user manually toggled all_day during this form session
  const userToggledAllDay = useRef(false)

  const form = useForm<EventFormInput>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: buildDefaultValues(event, defaults),
  })

  const watchedType = form.watch("type")
  const watchedAllDay = form.watch("all_day")
  const watchedStartTime = form.watch("start_time")
  const watchedDate = watchedStartTime instanceof Date ? watchedStartTime : new Date(watchedStartTime)

  const [calOpen, setCalOpen] = useState(false)
  const [recurrenceOpen, setRecurrenceOpen] = useState(false)
  const [recurrence, setRecurrence] = useState<RecurrenceConfig | null>(() => {
    // Single-occurrence edits are detached overrides — no recurrence.
    if (recurringEditScope === "single") return null
    if (event?.rrule) {
      try {
        const dtstart = event.master_start_time
          ? new Date(event.master_start_time)
          : new Date(event.start_time)
        return configFromRRule(event.rrule, dtstart)
      } catch {
        return null
      }
    }
    return null
  })

  const isSubmitting = form.formState.isSubmitting

  const showBusiness = watchedType === "meeting" || watchedType === "job" || watchedType === "reminder"
  const showClient = watchedType === "meeting" || watchedType === "job"
  const showReminderClient = watchedType === "reminder"
  const showPurpose = watchedType === "meeting"
  const showJobAmount = watchedType === "job"
  const isJob = watchedType === "job"

  async function onSubmit(rawValues: EventFormInput) {
    const values = rawValues as EventFormValues

    if (recurrence && values.type !== "job") {
      values.rrule = rruleToString(buildRRule(recurrence, values.start_time))
      values.recurrence_end_date =
        recurrence.endType === "until" ? (recurrence.until ?? null) : null
    } else {
      values.rrule = null
      values.recurrence_end_date = null
    }

    if (recurringEditScope && recurringMasterId) {
      if (recurringEditScope === "single" && recurringOccurrenceDate) {
        updateRecurringSingle.mutate(
          { masterId: recurringMasterId, occurrenceDate: recurringOccurrenceDate, values },
          { onSuccess }
        )
      } else if (recurringEditScope === "following" && recurringOccurrenceDate) {
        updateRecurringFollowing.mutate(
          { masterId: recurringMasterId, occurrenceDate: recurringOccurrenceDate, values },
          { onSuccess }
        )
      } else if (recurringEditScope === "all") {
        updateRecurringAll.mutate(
          { masterId: recurringMasterId, values },
          { onSuccess }
        )
      }
      return
    }

    if (event) {
      updateEvent.mutate({ id: event.id, values }, { onSuccess })
    } else {
      createEvent.mutate(values, { onSuccess })
    }
  }

  function handleDelete() {
    if (!event) return
    deleteEvent.mutate(event.id, { onSuccess })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 pb-6 space-y-5">

          {/* Scope banner for recurring edits */}
          {recurringEditScope === "single" && (
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Editing this occurrence only. Changes will not affect other occurrences.
            </div>
          )}
          {recurringEditScope === "following" && (
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Changes apply to this and all following occurrences.
            </div>
          )}
          {recurringEditScope === "all" && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              Changes apply to all occurrences, including past ones.
            </div>
          )}

          {/* Type segmented control */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {EVENT_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        field.onChange(value)
                        if (value === "reminder" && !userToggledAllDay.current) {
                          form.setValue("all_day", true)
                        }
                        if (value === "personal" || value === "golf") {
                          form.setValue("business_id", null)
                          form.setValue("client_id", null)
                          form.setValue("meeting_purpose", null)
                          form.setValue("reminder_for_client_id", null)
                        }
                        if (value !== "meeting") {
                          form.setValue("meeting_purpose", null)
                        }
                        if (value !== "job") {
                          form.setValue("job_total_amount", null)
                        }
                        if (value !== "reminder") {
                          form.setValue("reminder_for_client_id", null)
                        }
                        if (value === "reminder") {
                          form.setValue("client_id", null)
                        }
                        if (value === "job") {
                          setRecurrence(null)
                        }
                      }}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium transition-colors",
                        field.value === value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input
                    placeholder={
                      watchedType === "reminder"
                        ? "Reminder title (e.g. Follow up with Smith wedding)"
                        : "Event title"
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Business (single select chips) */}
          {showBusiness && (
            <FormField
              control={form.control}
              name="business_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Business{watchedType === "job" || watchedType === "meeting" ? "" : ""}
                  </FormLabel>
                  <div className="flex flex-wrap gap-2">
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
          )}

          {/* Client (for meeting / job) */}
          {showClient && (
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Client{watchedType === "job" ? " *" : ""}
                  </FormLabel>
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
          )}

          {/* Linked client (for reminders only — saves to reminder_for_client_id) */}
          {showReminderClient && (
            <FormField
              control={form.control}
              name="reminder_for_client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked client (optional)</FormLabel>
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
                  <p className="text-xs text-muted-foreground">
                    Reminder will link to this client&apos;s detail page
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Meeting purpose */}
          {showPurpose && (
            <FormField
              control={form.control}
              name="meeting_purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose *</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {MEETING_PURPOSES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => field.onChange(field.value === value ? null : value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]",
                          field.value === value
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* All-day toggle */}
          <FormField
            control={form.control}
            name="all_day"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <FormLabel className="mb-0">All day</FormLabel>
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => {
                    userToggledAllDay.current = true
                    field.onChange(!field.value)
                  }}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    field.value ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                      field.value ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </FormItem>
            )}
          />

          {/* Date picker */}
          <FormField
            control={form.control}
            name="start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date *</FormLabel>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {field.value instanceof Date
                        ? formatDateValue(field.value)
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value instanceof Date ? field.value : undefined}
                      onSelect={(date) => {
                        if (!date) return
                        const currentStart = field.value instanceof Date ? field.value : new Date()
                        const newStart = new Date(date)
                        newStart.setHours(currentStart.getHours(), currentStart.getMinutes(), 0, 0)
                        field.onChange(newStart)

                        const currentEnd = form.getValues("end_time")
                        const durationMs = (currentEnd instanceof Date ? currentEnd : new Date()).getTime() - currentStart.getTime()
                        const newEnd = new Date(newStart.getTime() + Math.max(durationMs, 3600_000))
                        form.setValue("end_time", newEnd)
                        setCalOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Start / End time */}
          {!watchedAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start *</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        value={field.value instanceof Date ? timeToHHMM(field.value) : ""}
                        onChange={(e) => {
                          const base = field.value instanceof Date ? field.value : new Date()
                          field.onChange(setTimeOnDate(base, e.target.value))
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End *</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        value={field.value instanceof Date ? timeToHHMM(field.value) : ""}
                        onChange={(e) => {
                          const base = watchedDate
                          field.onChange(setTimeOnDate(base, e.target.value))
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Repeat — hidden when editing a single occurrence (override has no rrule) */}
          {recurringEditScope !== "single" && (
            <div className={cn("space-y-1", isJob && "opacity-50")}>
              <Label>Repeat</Label>
              <button
                type="button"
                disabled={isJob}
                onClick={() => !isJob && setRecurrenceOpen(true)}
                className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed"
              >
                <span className={cn(!recurrence && "text-muted-foreground")}>
                  {recurrence ? describeRecurrence(recurrence) : "Does not repeat"}
                </span>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
              {isJob && (
                <p className="text-xs text-muted-foreground">
                  Jobs cannot repeat. Save the job, then use Duplicate to create a similar one.
                </p>
              )}
            </div>
          )}

          {/* Location */}
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Address or place name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Notes…" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Job total amount */}
          {showJobAmount && (
            <FormField
              control={form.control}
              name="job_total_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total amount</FormLabel>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">$</span>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="shrink-0 border-t border-border bg-popover px-4 py-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-3">
            {event && !recurringEditScope && (
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
                    <AlertDialogTitle>Delete event?</AlertDialogTitle>
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
              {isSubmitting ? "Saving…" : event ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </form>

      <RecurrencePicker
        open={recurrenceOpen}
        onOpenChange={setRecurrenceOpen}
        value={recurrence}
        onChange={setRecurrence}
        dtstart={watchedDate}
      />
    </Form>
  )
}
