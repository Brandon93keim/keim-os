"use client"

import { useEffect, useRef, useState } from "react"
import { format, isToday } from "date-fns"
import { Repeat } from "lucide-react"
import { BUSINESSES, colorForEvent, shortJobNumber } from "@/lib/constants"
import { roundToNearest15 } from "@/lib/date"
import { cn } from "@/lib/utils"
import { layoutEventsForDay, topForTime, heightForEvent, HOUR_HEIGHT, GRID_START_HOUR } from "./eventLayout"
import { TaskMarker } from "./TaskMarker"
import type { CalEvent } from "@/lib/hooks/useEvents"
import type { TaskWithRelations } from "@/lib/hooks/useTasks"

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i)
const DEFAULT_HOURS = Array.from({ length: 17 }, (_, i) => i + 6)

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

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isVerticalScroll.current = false
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current)
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (!isVerticalScroll.current && dy > 30 && dy > dx) {
      isVerticalScroll.current = true
    }
  }
  function handleTouchEnd(e: React.TouchEvent) {
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

          {/* Regular events */}
          {layoutEvents.map((event) => {
            const start = new Date(event.start_time)
            const end = new Date(event.end_time)
            const gridStartDate = new Date(anchorDate)
            gridStartDate.setHours(startHour, 0, 0, 0)
            const renderStart = event.effectiveStart.getTime() < gridStartDate.getTime()
              ? gridStartDate
              : event.effectiveStart
            const top = topForTime(renderStart) - (startHour - GRID_START_HOUR) * HOUR_HEIGHT
            const height = heightForEvent(renderStart, event.effectiveEnd)
            const continuesBefore = event.continuesBefore || event.effectiveStart.getTime() < gridStartDate.getTime()
            const continuesAfter = event.continuesAfter
            const colors = eventColor(event)
            const widthPct = 100 / event.cols
            const leftPct = (event.col / event.cols) * 100

            return (
              <button
                key={event.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onEventTap(event) }}
                className="absolute rounded overflow-hidden text-left active:opacity-80"
                style={{
                  top,
                  height,
                  left: `calc(2.5rem + ${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                  borderLeft: `3px solid ${colors.border}`,
                  backgroundColor: colors.bg,
                  color: colors.text,
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
