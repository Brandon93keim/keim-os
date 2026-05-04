"use client"

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
import { useDeleteEvent, type CalEvent } from "@/lib/hooks/useEvents"
import { useClients } from "@/lib/hooks/useClients"
import { cn } from "@/lib/utils"
import { configFromRRule, describeRecurrence } from "@/lib/recurrence"

interface Props {
  open: boolean
  onClose: () => void
  event: CalEvent | null
  onEdit: (event: CalEvent) => void
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
  const deleteEvent = useDeleteEvent()
  const { data: clients = [] } = useClients()

  if (!event) return null

  const biz = BUSINESSES.find((b) => b.id === event.business_id)
  const client = clients.find((c) => c.id === event.client_id)
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)

  // Recurrence metadata
  const isRecurring = !!(event.is_recurring_instance || event.rrule)
  const deleteId = event.is_recurring_instance ? (event.master_id ?? event.id) : event.id

  let recurrenceLabel: string | null = null
  if (event.rrule) {
    try {
      const dtstart = event.master_start_time
        ? new Date(event.master_start_time)
        : new Date(event.start_time)
      recurrenceLabel = describeRecurrence(configFromRRule(event.rrule, dtstart))
    } catch {
      // ignore parse errors
    }
  }

  function handleDelete() {
    deleteEvent.mutate(deleteId, { onSuccess: onClose })
  }

  const dateStr = event.all_day
    ? format(start, "EEEE, MMMM d, yyyy")
    : `${format(start, "EEEE, MMMM d, yyyy")}  ·  ${format(start, "h:mm a")} – ${format(end, "h:mm a")}`

  return (
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
          {/* Job number */}
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

          {/* Date / time */}
          <div className="text-sm text-foreground">{dateStr}</div>

          {/* Recurrence label */}
          {recurrenceLabel && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Repeat size={12} className="shrink-0" />
              <span>Repeats {recurrenceLabel.toLowerCase()}</span>
            </div>
          )}

          {/* Client */}
          {client && (
            <div className="flex items-center gap-2 text-sm">
              <User size={15} className="text-muted-foreground shrink-0" />
              <span>{client.name}</span>
              {client.company && (
                <span className="text-muted-foreground">— {client.company}</span>
              )}
            </div>
          )}

          {/* Location */}
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

          {/* Description */}
          {event.description && (
            <p className="text-sm text-foreground whitespace-pre-wrap">{event.description}</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 flex gap-3 border-t border-border px-4 py-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
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
                <AlertDialogTitle>
                  {isRecurring ? "Delete entire series?" : "Delete event?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isRecurring
                    ? "This will delete all occurrences of this event. This cannot be undone."
                    : "This cannot be undone."}
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

          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            className="flex-1 h-11 gap-2"
            onClick={() => onEdit(event)}
          >
            <Edit2 size={16} />
            Edit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
