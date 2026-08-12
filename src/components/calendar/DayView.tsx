"use client"

import { useEffect, useRef, useState } from "react"
import { format, isToday } from "date-fns"
import { Repeat } from "lucide-react"
import { BUSINESSES, colorForEvent, shortJobNumber } from "@/lib/constants"
import { roundToNearest15 } from "@/lib/date"
import { cn } from "@/lib/utils"
import { layoutEventsForDay, topForTime, heightForEvent, HOUR_HEIGHT, GRID_START_HOUR } from "./eventLayout"
import { TaskMarker } from "./TaskMarker"
import { useRescheduleEvent } from "@/lib/hooks/useEvents"
import type { CalEvent } from "@/lib/hooks/useEvents"
import type { LayoutEvent } from "./eventLayout"
import type { TaskWithRelations } from "@/lib/hooks/useTasks"

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i)
const DEFAULT_HOURS = Array.from({ length: 17 }, (_, i) => i + 6)

// Drag-to-reschedule tuning.
const LONG_PRESS_MS = 280
const MOVE_CANCEL_PX = 8
const MINUTE_MS = 60_000
const FIFTEEN_MIN_MS = 15 * MINUTE_MS

interface DragState {
  eventId: string
  startMs: number      // the event's original start
  durationMs: number
  snappedStartMs: number
}

interface PendingMove {
  eventId: string
  startMs: number
  endMs: number
}

// Recurring instances and all-day events are tap-to-edit only for now.
function canDragEvent(event: CalEvent): boolean {
  return !event.all_day && !event.is_recurring_instance && !event.rrule
}

interface Props {
  anchorDate: Date
  events: CalEvent[]
  tasks: TaskWithRelations[]
  onEventTap: (event: CalEvent) => void
  onSlotTap: (slotTime: Date) => void
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

export function DayView({ anchorDate, events, tasks, onEventTap, onSlotTap, onPrev, onNext }: Props) {
  const [showEarlier, setShowEarlier] = useState(false)
  const [showLater, setShowLater] = useState(false)
  const [nowTop, setNowTop] = useState<number | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const isVerticalScroll = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
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

  const hours = (() => {
    if (showEarlier && showLater) return ALL_HOURS
    if (showEarlier) return Array.from({ length: 22 }, (_, i) => i)
    if (showLater) return Array.from({ length: 18 }, (_, i) => i + 6)
    return DEFAULT_HOURS
  })()

  const startHour = hours[0]
  const totalHeight = hours.length * HOUR_HEIGHT

  const dayStart = new Date(anchorDate); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(anchorDate); dayEnd.setHours(23, 59, 59, 999)

  // Bounds a dragged event is clamped to: the hour range currently rendered.
  const gridStartDate = new Date(anchorDate); gridStartDate.setHours(startHour, 0, 0, 0)
  const gridStartMs = gridStartDate.getTime()
  const gridEndMs = gridStartMs + hours.length * 60 * MINUTE_MS

  const allDayEvents = events.filter((e) => {
    if (!e.all_day) return false
    const start = new Date(e.start_time)
    const end = new Date(e.end_time)
    return start <= dayEnd && end >= dayStart
  })
  const timedNonReminderEvents = events.filter(
    (e) => e.type !== "reminder" && !e.all_day
  )
  const layoutEvents = layoutEventsForDay(timedNonReminderEvents, anchorDate)

  const dayStr = format(anchorDate, "yyyy-MM-dd")
  const dayTasks = tasks.filter((t) => t.due_on === dayStr && t.status !== "done")

  function computeNowTop(): number | null {
    if (!isToday(anchorDate)) return null
    const now = new Date()
    const hoursFrac = now.getHours() + now.getMinutes() / 60
    const top = (hoursFrac - startHour) * HOUR_HEIGHT
    if (top < 0 || top > totalHeight) return null
    return top
  }

  useEffect(() => {
    setNowTop(computeNowTop())
    const timer = setInterval(() => setNowTop(computeNowTop()), 60_000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate, startHour, totalHeight])

  // Scroll to current time or 8am on mount
  useEffect(() => {
    if (!scrollRef.current) return
    const target = nowTop ?? (8 - startHour) * HOUR_HEIGHT
    scrollRef.current.scrollTop = Math.max(0, target - 80)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate])

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
  // clamped so the whole event stays inside the rendered hour range.
  function snappedStartFor(deltaPx: number, originalStartMs: number, durationMs: number): number {
    const deltaMs = (deltaPx / HOUR_HEIGHT) * 60 * MINUTE_MS
    let ms = roundToNearest15(new Date(originalStartMs + deltaMs)).getTime()
    const maxStartMs = gridEndMs - durationMs
    if (ms > maxStartMs) ms = Math.floor(maxStartMs / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS
    if (ms < gridStartMs) ms = gridStartMs
    return ms
  }

  function handleEventPointerDown(e: React.PointerEvent<HTMLButtonElement>, event: LayoutEvent) {
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
      const state: DragState = { eventId: event.id, startMs, durationMs, snappedStartMs: startMs }
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

    // Moved before the press landed — hand the gesture back to scroll/swipe-nav.
    if (!dragRef.current) {
      if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
        clearLongPress()
        pointerRef.current = null
      }
      return
    }

    const next = snappedStartFor(dy, dragRef.current.startMs, dragRef.current.durationMs)
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
    setPendingMove({ eventId: state.eventId, startMs: startTime.getTime(), endMs: endTime.getTime() })
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
    // The gesture belonged to a drag — never flip the day on release.
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

  function handleGridTap(e: React.MouseEvent<HTMLDivElement>) {
    if (suppressClickRef.current) return
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hourFrac = y / HOUR_HEIGHT + startHour
    const slotDate = new Date(anchorDate)
    slotDate.setHours(Math.floor(hourFrac), Math.round((hourFrac % 1) * 60), 0, 0)
    onSlotTap(roundToNearest15(slotDate))
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Show earlier */}
      {!showEarlier && (
        <button
          type="button"
          onClick={() => setShowEarlier(true)}
          className="shrink-0 text-xs text-muted-foreground py-1.5 border-b border-border hover:text-foreground"
        >
          Show earlier hours
        </button>
      )}

      {/* All-day events + tasks row */}
      {(allDayEvents.length > 0 || dayTasks.length > 0) && (
        <div
          className="shrink-0 flex items-center gap-1.5 px-2 border-b border-border overflow-x-auto"
          style={{ height: 32 }}
        >
          <div className="w-10 shrink-0" />
          {allDayEvents.map((event) => {
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
                className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 h-6 text-[10px] font-medium active:opacity-70"
                style={{
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.bg,
                  color: colors.text,
                }}
              >
                <span className="truncate max-w-[120px]">{label}</span>
              </button>
            )
          })}
          {dayTasks.map((task) => (
            <TaskMarker key={task.id} task={task} today={today} />
          ))}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className="relative"
          style={{ height: totalHeight }}
          onClick={handleGridTap}
        >
          {/* Hour gridlines */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0"
              style={{ top: (hour - startHour) * HOUR_HEIGHT }}
            >
              <div className="flex items-start">
                <span className="w-10 shrink-0 text-right pr-2 text-[9px] text-muted-foreground -mt-2.5 select-none">
                  {hour === 0
                    ? "12a"
                    : hour === 12
                      ? "12p"
                      : hour > 12
                        ? `${hour - 12}p`
                        : `${hour}a`}
                </span>
                <div className="flex-1 border-t border-border/40" />
              </div>
              <div className="absolute left-10 right-0 border-t border-border/20" style={{ top: HOUR_HEIGHT / 2 }} />
            </div>
          ))}

          {/* Now indicator */}
          {nowTop !== null && (
            <div
              className="absolute left-10 right-0 z-10 pointer-events-none"
              style={{ top: nowTop }}
            >
              <div className="relative flex items-center">
                <div className="absolute -left-1 w-2 h-2 rounded-full bg-red-500" />
                <div className="flex-1 border-t-2 border-red-500" />
              </div>
            </div>
          )}

          {/* Snapped-time badge while dragging */}
          {drag && (
            <div
              className="absolute left-0 z-40 pointer-events-none"
              style={{ top: topForTime(new Date(drag.snappedStartMs)) - (startHour - GRID_START_HOUR) * HOUR_HEIGHT - 7 }}
            >
              <span className="ml-0.5 rounded bg-foreground px-1 py-0.5 text-[9px] font-semibold text-background">
                {format(new Date(drag.snappedStartMs), "h:mm")}
              </span>
            </div>
          )}

          {/* Regular events */}
          {layoutEvents.map((event) => {
            const isDragging = drag?.eventId === event.id
            // A drag (or a drop still awaiting its refetch) overrides the stored times.
            const override = isDragging && drag
              ? { startMs: drag.snappedStartMs, endMs: drag.snappedStartMs + drag.durationMs }
              : pendingMove?.eventId === event.id
                ? { startMs: pendingMove.startMs, endMs: pendingMove.endMs }
                : null

            const start = override ? new Date(override.startMs) : new Date(event.start_time)
            const end = override ? new Date(override.endMs) : new Date(event.end_time)
            const effectiveStart = override ? start : event.effectiveStart
            const effectiveEnd = override ? end : event.effectiveEnd
            const renderStart = effectiveStart.getTime() < gridStartMs ? gridStartDate : effectiveStart
            const top = topForTime(renderStart) - (startHour - GRID_START_HOUR) * HOUR_HEIGHT
            const height = heightForEvent(renderStart, effectiveEnd)
            // A moved event is always clamped inside the grid, so it never continues.
            const continuesBefore = override
              ? false
              : event.continuesBefore || event.effectiveStart.getTime() < gridStartMs
            const continuesAfter = override ? false : event.continuesAfter
            const colors = eventColor(event)
            const widthPct = 100 / event.cols
            const leftPct = (event.col / event.cols) * 100
            const draggable = canDragEvent(event)

            return (
              <button
                key={event.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (suppressClickRef.current) return
                  onEventTap(event)
                }}
                onPointerDown={(e) => handleEventPointerDown(e, event)}
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
                  left: `calc(2.5rem + ${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                  borderLeft: `3px solid ${colors.border}`,
                  backgroundColor: colors.bg,
                  color: colors.text,
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
                  <div className="absolute top-0 inset-x-0 flex items-center justify-center h-3 text-[7px] opacity-70 z-10" style={{ backgroundColor: colors.bg }}>↑</div>
                )}
                <div className="px-1.5 pt-1 relative" style={continuesBefore ? { paddingTop: '0.875rem' } : undefined}>
                  {(event.is_recurring_instance || event.rrule) && (
                    <Repeat
                      size={10}
                      className="absolute top-0 right-1 opacity-60"
                    />
                  )}
                  <div className="text-xs font-semibold leading-tight truncate pr-3">
                    {event.job_number ? `${shortJobNumber(event.job_number)} · ${event.title}` : event.title}
                  </div>
                  {height > 40 && (
                    <div className="text-[10px] opacity-80 leading-tight">
                      {format(start, "h:mm a")} – {format(end, "h:mm a")}
                    </div>
                  )}
                </div>
                {continuesAfter && (
                  <div className="absolute bottom-0 inset-x-0 flex items-center justify-center h-3 text-[7px] opacity-70" style={{ backgroundColor: colors.bg }}>↓</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Show later */}
      {!showLater && (
        <button
          type="button"
          onClick={() => setShowLater(true)}
          className="shrink-0 text-xs text-muted-foreground py-1.5 border-t border-border hover:text-foreground"
        >
          Show later hours
        </button>
      )}
    </div>
  )
}
