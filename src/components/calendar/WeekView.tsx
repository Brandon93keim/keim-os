"use client"

import { useEffect, useRef, useState } from "react"
import { format, isToday, isSameDay } from "date-fns"
import { Repeat } from "lucide-react"
import { getWeekDays, HOURS_IN_VIEW, roundToNearest15 } from "@/lib/date"
import { BUSINESSES, colorForEvent, shortJobNumber } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { layoutEventsForDay, topForTime, heightForEvent, HOUR_HEIGHT } from "./eventLayout"
import { TaskMarker } from "./TaskMarker"
import { useRescheduleEvent } from "@/lib/hooks/useEvents"
import type { CalEvent } from "@/lib/hooks/useEvents"
import type { LayoutEvent } from "./eventLayout"
import type { TaskWithRelations } from "@/lib/hooks/useTasks"

// Drag-to-reschedule tuning — kept in step with DayView.
const LONG_PRESS_MS = 280
// Only a clearly horizontal drift aborts the pending lift — that's the one
// gesture still worth handing back (swipe to the prev/next week). Vertical
// drift no longer cancels: the event sets touch-action: none, so the browser is
// never going to steal a downward move for scrolling.
const SWIPE_ESCAPE_PX = 12
const MINUTE_MS = 60_000
const FIFTEEN_MIN_MS = 15 * MINUTE_MS

interface DragState {
  eventId: string
  dayKey: string       // the column the event was lifted from; it never leaves it
  startMs: number      // the event's original start
  durationMs: number
  snappedStartMs: number
  gridStartMs: number  // origin column's rendered hour range
  gridEndMs: number
}

interface PendingMove {
  eventId: string
  dayKey: string
  startMs: number
  endMs: number
}

// Recurring instances and all-day events are tap-to-edit only for now. Events
// that cross midnight are excluded too: a column-local drag can't move them
// without changing which day they belong to.
function canDragEvent(event: LayoutEvent): boolean {
  return (
    !event.all_day &&
    !event.is_recurring_instance &&
    !event.rrule &&
    !event.continuesBefore &&
    !event.continuesAfter
  )
}

interface Props {
  anchorDate: Date
  events: CalEvent[]
  tasks: TaskWithRelations[]
  onEventTap: (event: CalEvent) => void
  onPrev: () => void
  onNext: () => void
}

function eventColor(event: CalEvent): { bg: string; border: string; text: string } {
  if (event.color_override) {
    return { bg: event.color_override + "d9", border: event.color_override, text: "#fff" }
  }
  if (event.business_id) {
    const biz = BUSINESSES.find((b) => b.id === event.business_id)
    if (biz) {
      return {
        bg: biz.color + "d9",
        border: biz.color,
        text: biz.textColor === "white" ? "#fff" : "#000",
      }
    }
  }
  const base = colorForEvent(event)
  return { bg: base + "d9", border: base, text: "#fff" }
}

export function WeekView({ anchorDate, events, tasks, onEventTap, onPrev, onNext }: Props) {
  const days = getWeekDays(anchorDate)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const isVerticalScroll = useRef(false)
  const totalHeight = HOURS_IN_VIEW.length * HOUR_HEIGHT
  const today = format(new Date(), "yyyy-MM-dd")

  // ── Drag-to-reschedule state ──────────────────────────────────────────────
  const [drag, setDrag] = useState<DragState | null>(null)
  // Holds the dropped position until the refetch catches up, so the event
  // doesn't snap back to its old slot for a frame.
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const reschedule = useRescheduleEvent()
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragRef = useRef<DragState | null>(null)
  // True from drag activation until the gesture's touchend, so the container's
  // swipe-nav/scroll handlers stay out of the way.
  const dragActiveRef = useRef(false)
  const suppressClickRef = useRef(false)
  const suppressClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allDayEvents = events.filter((e) => e.all_day)
  const hasAllDayEvents = allDayEvents.length > 0
  const hasWeekTasks = days.some((d) =>
    tasks.some((t) => t.due_on === format(d, "yyyy-MM-dd") && t.status !== "done")
  )
  const showAllDayRow = hasAllDayEvents || hasWeekTasks
  const timedNonReminderEvents = events.filter((e) => e.type !== "reminder" && !e.all_day)

  // While a drag is live, block the browser's own scrolling. React's touchmove
  // listener is passive at the root, so this has to be a native non-passive one.
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const prevent = (e: TouchEvent) => e.preventDefault()
    document.addEventListener("touchmove", prevent, { passive: false })
    return () => document.removeEventListener("touchmove", prevent)
  }, [dragging])

  useEffect(() => {
    return () => {
      if (longPressRef.current) clearTimeout(longPressRef.current)
      if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current)
    }
  }, [])

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  // Swallow the synthetic click the browser may fire after a drag release.
  function suppressNextClick() {
    suppressClickRef.current = true
    if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current)
    suppressClickTimerRef.current = setTimeout(() => {
      suppressClickRef.current = false
      suppressClickTimerRef.current = null
    }, 350)
  }

  // Vertical pixels → minutes (HOUR_HEIGHT px == 60 min), snapped to :15 and
  // clamped to the origin column's hour range. Pointer x never participates, so
  // the event can only move in time, never across days.
  function snappedStartFor(deltaPx: number, state: DragState): number {
    const deltaMs = (deltaPx / HOUR_HEIGHT) * 60 * MINUTE_MS
    let ms = roundToNearest15(new Date(state.startMs + deltaMs)).getTime()
    const maxStartMs = state.gridEndMs - state.durationMs
    if (ms > maxStartMs) ms = Math.floor(maxStartMs / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS
    if (ms < state.gridStartMs) ms = state.gridStartMs
    return ms
  }

  function handleEventPointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    event: LayoutEvent,
    dayKey: string,
    gridStartMs: number,
    gridEndMs: number
  ) {
    if (dragRef.current) return   // a drag already owns the gesture
    dragActiveRef.current = false
    if (!canDragEvent(event)) return
    if (e.pointerType === "mouse" && e.button !== 0) return

    const el = e.currentTarget
    const pointerId = e.pointerId
    const startMs = new Date(event.start_time).getTime()
    const durationMs = Math.max(new Date(event.end_time).getTime() - startMs, FIFTEEN_MIN_MS)
    pointerRef.current = { id: pointerId, x: e.clientX, y: e.clientY }

    clearLongPress()
    longPressRef.current = setTimeout(() => {
      longPressRef.current = null
      if (!pointerRef.current || pointerRef.current.id !== pointerId) return
      const state: DragState = {
        eventId: event.id,
        dayKey,
        startMs,
        durationMs,
        snappedStartMs: startMs,
        gridStartMs,
        gridEndMs,
      }
      dragRef.current = state
      dragActiveRef.current = true
      setDrag(state)
      try { el.setPointerCapture(pointerId) } catch { /* capture is best-effort */ }
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(10)
      }
    }, LONG_PRESS_MS)
  }

  function handleEventPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== e.pointerId) return
    const dx = e.clientX - pointer.x
    const dy = e.clientY - pointer.y

    // Swiped sideways before the press landed — hand the gesture back to
    // swipe-nav. A vertical or ambiguous drift keeps the hold alive; the timer
    // is the only thing that decides whether this becomes a drag.
    if (!dragRef.current) {
      if (Math.abs(dx) > SWIPE_ESCAPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
        clearLongPress()
        pointerRef.current = null
      }
      return
    }

    const next = snappedStartFor(dy, dragRef.current)
    if (next !== dragRef.current.snappedStartMs) {
      dragRef.current = { ...dragRef.current, snappedStartMs: next }
      setDrag(dragRef.current)
    }
  }

  function handleEventPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    // Only the pointer that started the gesture can end it.
    if (pointerRef.current && pointerRef.current.id !== e.pointerId) return
    clearLongPress()
    const state = dragRef.current
    pointerRef.current = null
    dragRef.current = null
    if (!state) return   // never lifted — it was a tap, onClick opens the sheet

    setDrag(null)
    suppressNextClick()
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* already released */ }

    if (state.snappedStartMs === state.startMs) return
    const startTime = new Date(state.snappedStartMs)
    const endTime = new Date(state.snappedStartMs + state.durationMs)
    setPendingMove({
      eventId: state.eventId,
      dayKey: state.dayKey,
      startMs: startTime.getTime(),
      endMs: endTime.getTime(),
    })
    reschedule
      .mutateAsync({ id: state.eventId, startTime, endTime })
      .catch(() => { /* hook surfaces the error toast */ })
      .finally(() => setPendingMove(null))
  }

  function handleEventPointerCancel() {
    clearLongPress()
    const wasDragging = dragRef.current !== null
    pointerRef.current = null
    dragRef.current = null
    if (wasDragging) {
      setDrag(null)
      suppressNextClick()
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (dragActiveRef.current) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isVerticalScroll.current = false
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (dragActiveRef.current) return
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current)
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (!isVerticalScroll.current && dy > 30 && dy > dx) {
      isVerticalScroll.current = true
    }
  }
  function handleTouchEnd(e: React.TouchEvent) {
    // The gesture belonged to a drag — never flip the week on release.
    if (dragActiveRef.current) {
      dragActiveRef.current = false
      touchStartX.current = null
      touchStartY.current = null
      isVerticalScroll.current = false
      return
    }
    if (touchStartX.current === null || isVerticalScroll.current) {
      touchStartX.current = null
      touchStartY.current = null
      isVerticalScroll.current = false
      return
    }
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) dx < 0 ? onNext() : onPrev()
    touchStartX.current = null
    touchStartY.current = null
    isVerticalScroll.current = false
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Day headers */}
      <div className="flex shrink-0 border-b border-border">
        <div className="w-10 shrink-0" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "flex-1 text-center py-1.5",
              isSameDay(day, anchorDate) && "bg-muted/30"
            )}
          >
            <div className="text-[10px] font-medium text-muted-foreground uppercase">
              {format(day, "EEE")}
            </div>
            <div
              className={cn(
                "mx-auto w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold",
                isToday(day) && "bg-primary text-primary-foreground"
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* All-day row — shown when there are all-day events or tasks due this week */}
      {showAllDayRow && (
        <div className="flex shrink-0 border-b border-border" style={{ minHeight: 32 }}>
          <div className="w-10 shrink-0" />
          {days.map((day) => {
            const wDayStart = new Date(day); wDayStart.setHours(0, 0, 0, 0)
            const wDayEnd = new Date(day); wDayEnd.setHours(23, 59, 59, 999)
            const dayAllDay = allDayEvents.filter((e) => {
              const start = new Date(e.start_time)
              const end = new Date(e.end_time)
              return start <= wDayEnd && end >= wDayStart
            })
            const dayStr = format(day, "yyyy-MM-dd")
            const dayTasks = tasks.filter((t) => t.due_on === dayStr && t.status !== "done")
            return (
              <div
                key={day.toISOString()}
                className="flex-1 border-l border-border flex flex-wrap items-center gap-0.5 px-0.5 py-1 overflow-hidden min-w-0"
              >
                {dayAllDay.map((event) => {
                  const base = colorForEvent(event)
                  const colors = { bg: base + "26", border: base, text: base + "e6" }
                  const label = event.job_number
                    ? `${shortJobNumber(event.job_number)} · ${event.title}`
                    : event.title
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventTap(event)}
                      className="inline-flex items-center gap-0.5 rounded-full px-1.5 h-5 text-[9px] font-medium shrink-0 active:opacity-70"
                      style={{
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.bg,
                        color: colors.text,
                      }}
                    >
                      <span className="truncate max-w-[60px]">{label}</span>
                    </button>
                  )
                })}
                {dayTasks.map((task) => (
                  <TaskMarker key={task.id} task={task} today={today} compact />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: totalHeight }}>
          {/* Time gutter */}
          <div className="w-10 shrink-0 relative">
            {HOURS_IN_VIEW.map((hour) => (
              <div
                key={hour}
                className="absolute right-1 text-[9px] text-muted-foreground"
                style={{ top: (hour - HOURS_IN_VIEW[0]) * HOUR_HEIGHT - 6 }}
              >
                {hour === 12 ? "12p" : hour > 12 ? `${hour - 12}p` : `${hour}a`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const layoutEvents = layoutEventsForDay(timedNonReminderEvents, day)
            const dayKey = day.toISOString()
            // Bounds a dragged event is clamped to: this column's hour range.
            const gridStartDate = new Date(day)
            gridStartDate.setHours(HOURS_IN_VIEW[0], 0, 0, 0)
            const gridStartMs = gridStartDate.getTime()
            const gridEndMs = gridStartMs + HOURS_IN_VIEW.length * 60 * MINUTE_MS

            return (
              <div key={dayKey} className="flex-1 relative border-l border-border">
                {/* Hour gridlines */}
                {HOURS_IN_VIEW.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: (hour - HOURS_IN_VIEW[0]) * HOUR_HEIGHT }}
                  >
                    <div
                      className="absolute left-0 right-0 border-t border-border/20"
                      style={{ top: HOUR_HEIGHT / 2 }}
                    />
                  </div>
                ))}

                {/* Snapped-time badge while dragging this column's event */}
                {drag && drag.dayKey === dayKey && (
                  <div
                    className="absolute left-0 z-40 pointer-events-none"
                    style={{ top: topForTime(new Date(drag.snappedStartMs)) - 6 }}
                  >
                    <span className="ml-0.5 rounded bg-foreground px-1 py-px text-[8px] font-semibold text-background">
                      {format(new Date(drag.snappedStartMs), "h:mm")}
                    </span>
                  </div>
                )}

                {/* Regular events */}
                {layoutEvents.map((event) => {
                  const isDragging = drag?.eventId === event.id && drag.dayKey === dayKey
                  // A drag (or a drop still awaiting its refetch) overrides the stored times.
                  const override = isDragging && drag
                    ? { startMs: drag.snappedStartMs, endMs: drag.snappedStartMs + drag.durationMs }
                    : pendingMove?.eventId === event.id && pendingMove.dayKey === dayKey
                      ? { startMs: pendingMove.startMs, endMs: pendingMove.endMs }
                      : null

                  const start = override ? new Date(override.startMs) : new Date(event.start_time)
                  const effectiveStart = override ? start : event.effectiveStart
                  const effectiveEnd = override ? new Date(override.endMs) : event.effectiveEnd
                  const renderStart = effectiveStart.getTime() < gridStartMs
                    ? gridStartDate
                    : effectiveStart
                  const top = topForTime(renderStart)
                  const height = heightForEvent(renderStart, effectiveEnd)
                  // A moved event is always clamped inside the grid, so it never continues.
                  const continuesBefore = override
                    ? false
                    : event.continuesBefore || event.effectiveStart.getTime() < gridStartMs
                  const continuesAfter = override ? false : event.continuesAfter
                  const colors = eventColor(event)
                  const width = `${100 / event.cols}%`
                  const left = `${(event.col / event.cols) * 100}%`
                  const draggable = canDragEvent(event)

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => {
                        if (suppressClickRef.current) return
                        onEventTap(event)
                      }}
                      onPointerDown={(e) => handleEventPointerDown(e, event, dayKey, gridStartMs, gridEndMs)}
                      onPointerMove={handleEventPointerMove}
                      onPointerUp={handleEventPointerUp}
                      onPointerCancel={handleEventPointerCancel}
                      onContextMenu={draggable ? (e) => e.preventDefault() : undefined}
                      className={cn(
                        "absolute rounded overflow-hidden text-left select-none",
                        !isDragging && "active:opacity-80"
                      )}
                      style={{
                        top,
                        height,
                        left,
                        width,
                        paddingLeft: 2,
                        borderLeft: `3px solid ${colors.border}`,
                        backgroundColor: colors.bg,
                        color: colors.text,
                        // Safari locks touch-action in at gesture start, so this
                        // has to be here statically — flipping it once the
                        // long-press lifts is far too late. Without it the
                        // button inherits the scroller's pan-y and a
                        // straight-down move is claimed as a scroll
                        // (pointercancel) before the hold ever completes.
                        ...(draggable ? { touchAction: "none" as const } : null),
                        ...(isDragging
                          ? {
                              zIndex: 30,
                              opacity: 0.92,
                              transform: "scale(1.02)",
                              boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
                            }
                          : null),
                      }}
                    >
                      {continuesBefore && (
                        <div className="absolute top-0 inset-x-0 flex items-center justify-center h-2.5 text-[6px] opacity-70 z-10" style={{ backgroundColor: colors.bg }}>↑</div>
                      )}
                      <div className="px-0.5 pt-0.5 relative" style={continuesBefore ? { paddingTop: '0.75rem' } : undefined}>
                        {(event.is_recurring_instance || event.rrule) && (
                          <Repeat
                            size={8}
                            className="absolute top-0 right-0.5 opacity-60"
                          />
                        )}
                        <div className="text-[10px] font-semibold leading-tight truncate pr-2">
                          {event.job_number ? `${shortJobNumber(event.job_number)} · ${event.title}` : event.title}
                        </div>
                        <div className="text-[9px] opacity-80 leading-tight">
                          {format(start, "h:mma")}
                        </div>
                      </div>
                      {continuesAfter && (
                        <div className="absolute bottom-0 inset-x-0 flex items-center justify-center h-2.5 text-[6px] opacity-70" style={{ backgroundColor: colors.bg }}>↓</div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
