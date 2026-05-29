"use client"

import { useState } from "react"
import { format } from "date-fns"
import { AlertCircle, Bell, MapPin, User, Edit2, Trash2, Repeat } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BUSINESSES } from "@/lib/constants"
import {
  useDeleteEvent,
  useDeleteRecurringSingle,
  useDeleteRecurringFollowing,
  useDeleteRecurringAll,
  useEventsForJob,
  type CalEvent,
} from "@/lib/hooks/useEvents"
import { useClients } from "@/lib/hooks/useClients"
import { useIsEventBilled } from "@/lib/hooks/useInvoices"
import { useUpdateJob } from "@/lib/hooks/useJobs"
import { configFromRRule, describeRecurrence } from "@/lib/recurrence"
import { countSeriesOccurrences } from "@/lib/queries/events"
import { RecurringEditDialog, type RecurringScope } from "./RecurringEditDialog"
import { EditJobDialog } from "@/components/jobs/EditJobDialog"

interface Props {
  open: boolean
  onClose: () => void
  event: CalEvent | null
  onEdit: (event: CalEvent, scope?: RecurringScope) => void
  onCreateInvoice?: (event: CalEvent) => void
}

const TYPE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  job: "Job",
  personal: "Personal",
  reminder: "Reminder",
}

const STATUS_VARIANT: Record<string, string> = {
  scheduled: "secondary",
  in_progress: "default",
  completed: "outline",
  cancelled: "destructive",
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    cancelled: "bg-muted text-muted-foreground",
    pro_bono: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  }
  const labels: Record<string, string> = {
    open: "Open",
    completed: "Completed",
    cancelled: "Cancelled",
    pro_bono: "Pro bono",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.open}`}
    >
      {labels[status] ?? status}
    </span>
  )
}

export function EventDetailSheet({ open, onClose, event, onEdit, onCreateInvoice }: Props) {
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false)
  const [recurringDialogMode, setRecurringDialogMode] = useState<"edit" | "delete">("edit")
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false)
  const [editJobOpen, setEditJobOpen] = useState(false)
  const [proBonoConfirmOpen, setProBonoConfirmOpen] = useState(false)
  const router = useRouter()

  const deleteEvent = useDeleteEvent()
  const deleteRecurringSingle = useDeleteRecurringSingle()
  const deleteRecurringFollowing = useDeleteRecurringFollowing()
  const deleteRecurringAll = useDeleteRecurringAll()
  const updateJob = useUpdateJob()
  const { data: clients = [] } = useClients()

  const jobId = event?.job?.id ?? null
  const { data: jobEvents = [] } = useEventsForJob(jobId)

  const isPastJob = event?.type === "job" && new Date(event.start_time) <= new Date()
  const { data: isBilled } = useIsEventBilled(isPastJob ? event!.id : null)
  const showInvoiceCTA = isPastJob && isBilled === false

  if (!event) return null

  const biz = BUSINESSES.find((b) => b.id === event.business_id)
  const client = clients.find((c) => c.id === event.client_id)
  const reminderClient = clients.find((c) => c.id === event.reminder_for_client_id)
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)
  const isReminder = event.type === "reminder"

  const isRecurring = !!(event.is_recurring_instance || event.rrule)
  const masterId = event.is_recurring_instance ? (event.master_id ?? event.id) : event.id
  const occurrenceDate = new Date(event.occurrence_date ?? event.start_time)

  let recurrenceLabel: string | null = null
  let occurrenceCount = { total: 0, pastCount: 0 }
  if (event.rrule) {
    try {
      const dtstart = event.master_start_time
        ? new Date(event.master_start_time)
        : new Date(event.start_time)
      recurrenceLabel = describeRecurrence(configFromRRule(event.rrule, dtstart))
      occurrenceCount = countSeriesOccurrences(event.rrule, dtstart, new Date())
    } catch {
      // ignore
    }
  }

  const otherEvents = jobEvents.filter((e) => e.id !== event.id)

  function handleRecurringAction(scope: RecurringScope) {
    setRecurringDialogOpen(false)
    if (recurringDialogMode === "edit") {
      onEdit(event!, scope)
      return
    }
    // delete
    if (scope === "single") {
      deleteRecurringSingle.mutate({ masterId, occurrenceDate }, { onSuccess: onClose })
    } else if (scope === "following") {
      deleteRecurringFollowing.mutate({ masterId, occurrenceDate }, { onSuccess: onClose })
    } else {
      setDeleteAllConfirmOpen(true)
    }
  }

  function handleDeleteAll() {
    setDeleteAllConfirmOpen(false)
    deleteRecurringAll.mutate(masterId, { onSuccess: onClose })
  }

  const dateStr = event.all_day
    ? format(start, "EEEE, MMMM d, yyyy")
    : `${format(start, "EEEE, MMMM d, yyyy")}  ·  ${format(start, "h:mm a")} – ${format(end, "h:mm a")}`

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[80dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        >
          <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
            <div className="flex items-start gap-2">
              <SheetTitle className="text-lg leading-tight flex-1 flex items-center gap-1.5">
                {isReminder && (
                  <Bell size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                )}
                {event.title}
              </SheetTitle>
              {isRecurring && (
                <Repeat size={14} className="text-muted-foreground shrink-0 mt-1" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              {!isReminder && (
                <Badge variant={STATUS_VARIANT[event.status] as "default" | "secondary" | "outline" | "destructive" ?? "secondary"}>
                  {event.status}
                </Badge>
              )}
              <Badge variant="outline">{TYPE_LABELS[event.type] ?? event.type}</Badge>
              {biz && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: biz.color, color: biz.textColor }}
                >
                  {biz.name}
                </span>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Parent job panel — shown when this is a job event with a linked job */}
            {event.type === "job" && event.job && !isReminder && (
              <div className="rounded-xl bg-muted p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Job
                    </span>
                    <span className="font-mono text-sm font-bold">
                      {event.job.job_number}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditJobOpen(true)}
                  >
                    Edit Job
                  </Button>
                </div>

                {event.job.title && (
                  <div className="text-sm font-medium">{event.job.title}</div>
                )}

                {event.job.description && (
                  <div className="text-xs text-muted-foreground whitespace-pre-line">
                    {event.job.description}
                  </div>
                )}

                {event.job.total_estimate != null && (
                  <div className="text-xs">
                    Estimate:{" "}
                    <span className="font-semibold tabular-nums">
                      ${event.job.total_estimate.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <StatusBadge status={event.job.status} />
                  {event.job.status === "open" && (
                    <button
                      type="button"
                      onClick={() => setProBonoConfirmOpen(true)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Mark pro bono
                    </button>
                  )}
                </div>

                {otherEvents.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Other events on this job
                    </div>
                    {otherEvents.map((e) => (
                      <div
                        key={e.id}
                        className="text-xs text-foreground"
                      >
                        {format(new Date(e.start_time), "MMM d, yyyy")} · {e.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Simple job display for events without a linked job snapshot */}
            {event.type === "job" && !event.job && event.job_number && !isReminder && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Job
                </span>
                <span className="font-mono text-sm font-bold">{event.job_number}</span>
                {event.job_total_amount != null && (
                  <span className="ml-auto text-sm font-semibold">
                    ${event.job_total_amount.toFixed(2)}
                  </span>
                )}
              </div>
            )}

            {showInvoiceCTA && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                    size={18}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Needs Invoice
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      This job is past-dated and hasn&apos;t been invoiced yet.
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (onCreateInvoice) {
                      onCreateInvoice(event)
                      onClose()
                    }
                  }}
                  disabled={!onCreateInvoice}
                  className="w-full h-9"
                  size="sm"
                >
                  Create Invoice
                </Button>
              </div>
            )}

            <div className="text-sm text-foreground">{dateStr}</div>

            {recurrenceLabel && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Repeat size={12} className="shrink-0" />
                <span>Repeats {recurrenceLabel.toLowerCase()}</span>
              </div>
            )}

            {/* Linked client card for reminders — tappable, navigates to client detail */}
            {isReminder && reminderClient && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  router.push(`/clients/${reminderClient.id}`)
                }}
                className="w-full flex items-center gap-2 p-3 rounded-xl bg-muted text-left active:opacity-70 transition-opacity"
              >
                <User size={15} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1 truncate">{reminderClient.name}</span>
                {reminderClient.company && (
                  <span className="text-sm text-muted-foreground truncate">— {reminderClient.company}</span>
                )}
                <Badge
                  variant={reminderClient.status === "active" ? "default" : "secondary"}
                  className="shrink-0 text-[10px]"
                >
                  {reminderClient.status}
                </Badge>
              </button>
            )}

            {/* Regular client display for non-reminder events */}
            {!isReminder && client && (
              <div className="flex items-center gap-2 text-sm">
                <User size={15} className="text-muted-foreground shrink-0" />
                <span>{client.name}</span>
                {client.company && (
                  <span className="text-muted-foreground">— {client.company}</span>
                )}
              </div>
            )}

            {event.location && (
              <a
                href={`https://maps.apple.com/?q=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-sm text-primary"
              >
                <MapPin size={15} className="shrink-0 mt-0.5" />
                <span>{event.location}</span>
              </a>
            )}

            {event.description && (
              <p className="text-sm text-foreground whitespace-pre-wrap">{event.description}</p>
            )}
          </div>

          <div
            className="shrink-0 flex gap-3 border-t border-border px-4 py-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {isRecurring ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-destructive hover:text-destructive shrink-0"
                onClick={() => {
                  setRecurringDialogMode("delete")
                  setRecurringDialogOpen(true)
                }}
              >
                <Trash2 size={18} />
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
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
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteEvent.mutate(event.id, { onSuccess: onClose })}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              className="flex-1 h-11 gap-2"
              onClick={() => {
                if (isRecurring) {
                  setRecurringDialogMode("edit")
                  setRecurringDialogOpen(true)
                } else {
                  onEdit(event)
                }
              }}
            >
              <Edit2 size={16} />
              Edit
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {isRecurring && (
        <RecurringEditDialog
          open={recurringDialogOpen}
          onOpenChange={setRecurringDialogOpen}
          mode={recurringDialogMode}
          occurrenceCount={occurrenceCount}
          onChoose={handleRecurringAction}
        />
      )}

      <AlertDialog open={deleteAllConfirmOpen} onOpenChange={setDeleteAllConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entire series?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all {occurrenceCount.total} occurrence{occurrenceCount.total === 1 ? "" : "s"}, including {occurrenceCount.pastCount} in the past. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditJobDialog
        open={editJobOpen}
        onClose={() => setEditJobOpen(false)}
        job={event.job ?? null}
      />

      <AlertDialog open={proBonoConfirmOpen} onOpenChange={setProBonoConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this job pro bono?</AlertDialogTitle>
            <AlertDialogDescription>
              It closes without an invoice; the estimate is kept as the comped value.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (event.job) {
                  updateJob.mutate(
                    { id: event.job.id, values: { status: "pro_bono" } },
                    { onSuccess: () => setProBonoConfirmOpen(false) }
                  )
                }
              }}
            >
              Mark pro bono
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
