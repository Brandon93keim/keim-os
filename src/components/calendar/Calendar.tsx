"use client"

import { useState, useCallback } from "react"
import { addDays, addHours, addMonths, addWeeks, startOfDay, subDays, subMonths, subWeeks } from "date-fns"
import { toast } from "sonner"
import { CalendarHeader } from "./CalendarHeader"
import { MonthView } from "./MonthView"
import { WeekView } from "./WeekView"
import { DayView } from "./DayView"
import { CalendarFAB } from "./CalendarFAB"
import { EventFormSheet } from "@/components/events/EventFormSheet"
import { EventDetailSheet } from "@/components/events/EventDetailSheet"
import { getCalendarDays, getWeekDays } from "@/lib/date"
import { useEventsBetween, type CalEvent } from "@/lib/hooks/useEvents"
import type { EventFormValues } from "@/lib/validations/event"

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

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null)

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

  function handleEditFromDetail(event: CalEvent) {
    setDetailOpen(false)

    let eventToEdit = event
    if (event.is_recurring_instance && event.master_id) {
      // Inform user that editing affects the whole series (Phase 5d will add per-instance editing).
      toast.info(
        "Editing recurring events coming soon. Opening the master event — changes affect all occurrences."
      )
      // Reconstruct master event from the synthetic instance's copied fields.
      const duration =
        new Date(event.end_time).getTime() - new Date(event.start_time).getTime()
      const masterStart = event.master_start_time ?? event.start_time
      eventToEdit = {
        ...event,
        id: event.master_id,
        start_time: masterStart,
        end_time: new Date(new Date(masterStart).getTime() + duration).toISOString(),
        is_recurring_instance: false,
      }
    }

    setEditEvent(eventToEdit)
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
        onClose={() => setFormOpen(false)}
        defaults={formDefaults}
        event={editEvent}
      />

      <EventDetailSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        event={detailEvent}
        onEdit={handleEditFromDetail}
      />
    </div>
  )
}
