"use client"

import { useState } from "react"
import { format } from "date-fns"
import { MapPin, User, Edit2, Trash2, Repeat } from "lucide-react"
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
  type CalEvent,
} from "@/lib/hooks/useEvents"
import { useClients } from "@/lib/hooks/useClients"
import { configFromRRule, describeRecurrence } from "@/lib/recurrence"
import { countSeriesOccurrences } from "@/lib/queries/events"
import { RecurringEditDialog, type RecurringScope } from "./RecurringEditDialog"

interface Props {
  open: boolean
  onClose: () => void
  event: CalEvent | null
  onEdit: (event: CalEvent, scope?: RecurringScope) => void
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

export function EventDetailSheet({ open, onClose, event, onEdit }: Props) {
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false)
  const [recurringDialogMode, setRecurringDialogMode] = useState<"edit" | "delete">("edit")
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false)

  const deleteEvent = useDeleteEvent()
  const deleteRecurringSingle = useDeleteRecurringSingle()
  const deleteRecurringFollowing = useDeleteRecurringFollowing()
  const deleteRecurringAll = useDeleteRecurringAll()
  const { data: clients = [] } = useClients()

  if (!event) return null

  const biz = BUSINESSES.find((b) => b.id === event.business_id)
  const client = clients.find((c) => c.id === event.client_id)
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)

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
              <SheetTitle className="text-lg leading-tight flex-1">{event.title}</SheetTitle>
              {isRecurring && (
                <Repeat size={14} className="text-muted-foreground shrink-0 mt-1" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant={STATUS_VARIANT[event.status] as "default" | "secondary" | "outline" | "destructive" ?? "secondary"}>
                {event.status}
              </Badge>
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
            {event.job_number && (
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

            <div className="text-sm text-foreground">{dateStr}</div>

            {recurrenceLabel && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Repeat size={12} className="shrink-0" />
                <span>Repeats {recurrenceLabel.toLowerCase()}</span>
              </div>
            )}

            {client && (
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
    </>
  )
}
