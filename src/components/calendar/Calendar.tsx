"use client"

import { useState, useCallback } from "react"
import { addDays, addHours, addMonths, addWeeks, startOfDay, subDays, subMonths, subWeeks } from "date-fns"
import { CalendarHeader } from "./CalendarHeader"
import { MonthView } from "./MonthView"
import { WeekView } from "./WeekView"
import { DayView } from "./DayView"
import { CalendarFAB } from "./CalendarFAB"
import { EventFormSheet } from "@/components/events/EventFormSheet"
import { EventDetailSheet } from "@/components/events/EventDetailSheet"
import { InvoiceFormSheet } from "@/components/invoices/InvoiceFormSheet"
import { getCalendarDays, getWeekDays } from "@/lib/date"
import { toast } from "sonner"
import { useEventsBetween, type CalEvent } from "@/lib/hooks/useEvents"
import { getInvoicePrefillForJob, type UnbilledJob } from "@/lib/queries/jobs"
import type { EventFormValues } from "@/lib/validations/event"
import type { RecurringScope } from "@/components/events/RecurringEditDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type CalendarView = "month" | "week" | "day"

interface FormDefaults {
  start_time?: Date
  end_time?: Date
  type?: EventFormValues["type"]
}

export function Calendar() {
  const [view, setView] = useState<CalendarView>("month")
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfDay(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [formDefaults, setFormDefaults] = useState<FormDefaults>({})
  const [editEvent, setEditEvent] = useState<CalEvent | null>(null)
  const [recurringEditScope, setRecurringEditScope] = useState<RecurringScope | undefined>()
  const [recurringMasterId, setRecurringMasterId] = useState<string | undefined>()
  const [recurringOccurrenceDate, setRecurringOccurrenceDate] = useState<Date | undefined>()

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null)

  const [pendingInvoicePrompt, setPendingInvoicePrompt] = useState<CalEvent | null>(null)
  const [prefillJob, setPrefillJob] = useState<UnbilledJob | null>(null)
  const [invoiceSheetOpen, setInvoiceSheetOpen] = useState(false)

  // Compute query window based on view
  const queryWindow = (() => {
    if (view === "month") {
      const days = getCalendarDays(anchorDate)
      return { start: days[0], end: addDays(days[41], 1) }
    }
    if (view === "week") {
      const days = getWeekDays(anchorDate)
      return { start: days[0], end: addDays(days[6], 1) }
    }
    return { start: startOfDay(anchorDate), end: addDays(startOfDay(anchorDate), 1) }
  })()

  const { data: events = [] } = useEventsBetween(queryWindow.start, queryWindow.end)

  function goToToday() {
    setAnchorDate(startOfDay(new Date()))
    setSelectedDate(null)
  }

  function goPrev() {
    if (view === "month") setAnchorDate((d) => subMonths(d, 1))
    else if (view === "week") setAnchorDate((d) => subWeeks(d, 1))
    else setAnchorDate((d) => subDays(d, 1))
  }

  function goNext() {
    if (view === "month") setAnchorDate((d) => addMonths(d, 1))
    else if (view === "week") setAnchorDate((d) => addWeeks(d, 1))
    else setAnchorDate((d) => addDays(d, 1))
  }

  function handleDayTap(day: Date) {
    setSelectedDate(day)
    setAnchorDate(day)
    setView("day")
  }

  function openNewEvent(defaults: FormDefaults = {}) {
    setEditEvent(null)
    setFormDefaults(defaults)
    setFormOpen(true)
  }

  const handleEventTap = useCallback((event: CalEvent) => {
    setDetailEvent(event)
    setDetailOpen(true)
  }, [])

  async function handleCreateInvoiceFromEvent(event: CalEvent) {
    const jobId = event.job_id
    if (!jobId) {
      toast.error("This event isn't linked to a job")
      return
    }
    try {
      const prefill = await getInvoicePrefillForJob(jobId)
      setPrefillJob(prefill)
      setInvoiceSheetOpen(true)
    } catch {
      toast.error("Couldn't load job for invoicing")
    }
  }

  function handleEditFromDetail(event: CalEvent, scope?: RecurringScope) {
    setDetailOpen(false)

    if (!scope) {
      setEditEvent(event)
      setRecurringEditScope(undefined)
      setRecurringMasterId(undefined)
      setRecurringOccurrenceDate(undefined)
      setFormDefaults({})
      setFormOpen(true)
      return
    }

    const masterId = event.master_id ?? event.id
    const occurrenceDate = new Date(event.occurrence_date ?? event.start_time)

    let eventToEdit: CalEvent
    if (scope === "all") {
      const duration = new Date(event.end_time).getTime() - new Date(event.start_time).getTime()
      const masterStart = event.master_start_time ?? event.start_time
      eventToEdit = {
        ...event,
        id: masterId,
        start_time: masterStart,
        end_time: new Date(new Date(masterStart).getTime() + duration).toISOString(),
        is_recurring_instance: false,
      }
    } else {
      eventToEdit = event
    }

    setEditEvent(eventToEdit)
    setRecurringEditScope(scope)
    setRecurringMasterId(masterId)
    setRecurringOccurrenceDate(occurrenceDate)
    setFormDefaults({})
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      <CalendarHeader
        view={view}
        anchorDate={anchorDate}
        onViewChange={(v) => { setView(v); setSelectedDate(null) }}
        onAnchorChange={(d) => { setAnchorDate(d); setSelectedDate(null) }}
        onToday={goToToday}
        onPrev={goPrev}
        onNext={goNext}
      />

      <div className="flex-1 overflow-hidden relative">
        {view === "month" && (
          <MonthView
            anchorDate={anchorDate}
            selectedDate={selectedDate}
            events={events}
            onDayTap={handleDayTap}
            onPrev={goPrev}
            onNext={goNext}
          />
        )}
        {view === "week" && (
          <WeekView
            anchorDate={anchorDate}
            events={events}
            onEventTap={handleEventTap}
            onPrev={goPrev}
            onNext={goNext}
          />
        )}
        {view === "day" && (
          <DayView
            anchorDate={anchorDate}
            events={events}
            onEventTap={handleEventTap}
            onSlotTap={(slotTime) => openNewEvent({ start_time: slotTime, end_time: addHours(slotTime, 1) })}
            onPrev={goPrev}
            onNext={goNext}
          />
        )}
      </div>

      <CalendarFAB
        view={view}
        anchorDate={anchorDate}
        selectedDate={selectedDate}
        onOpen={openNewEvent}
      />

      <EventFormSheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setRecurringEditScope(undefined)
          setRecurringMasterId(undefined)
          setRecurringOccurrenceDate(undefined)
        }}
        defaults={formDefaults}
        event={editEvent}
        recurringEditScope={recurringEditScope}
        recurringMasterId={recurringMasterId}
        recurringOccurrenceDate={recurringOccurrenceDate}
        onSaved={(result) => {
          if (
            result.isNew &&
            result.event.type === "job" &&
            new Date(result.event.start_time) <= new Date()
          ) {
            setPendingInvoicePrompt(result.event)
          }
        }}
      />

      <EventDetailSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        event={detailEvent}
        onEdit={handleEditFromDetail}
        onCreateInvoice={handleCreateInvoiceFromEvent}
      />

      <AlertDialog
        open={pendingInvoicePrompt !== null}
        onOpenChange={(open) => {
          if (!open) setPendingInvoicePrompt(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create invoice for this job?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingInvoicePrompt?.job_number ?? "This job"} can be
              invoiced now. You can also do it later from the Unbilled tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Skip</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingInvoicePrompt) return
                const event = pendingInvoicePrompt
                setPendingInvoicePrompt(null)
                handleCreateInvoiceFromEvent(event)
              }}
            >
              Create Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InvoiceFormSheet
        open={invoiceSheetOpen}
        onClose={() => {
          setInvoiceSheetOpen(false)
          setPrefillJob(null)
        }}
        prefillJob={prefillJob}
      />
    </div>
  )
}
