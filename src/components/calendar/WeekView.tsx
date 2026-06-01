"use client"

import { useRef } from "react"
import { format, isToday, isSameDay } from "date-fns"
import { Repeat } from "lucide-react"
import { getWeekDays, HOURS_IN_VIEW } from "@/lib/date"
import { BUSINESSES, colorForEvent, shortJobNumber } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { layoutEventsForDay, topForTime, heightForEvent, HOUR_HEIGHT } from "./eventLayout"
import { TaskMarker } from "./TaskMarker"
import type { CalEvent } from "@/lib/hooks/useEvents"
import type { TaskWithRelations } from "@/lib/hooks/useTasks"

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

  const allDayEvents = events.filter((e) => e.all_day)
  const hasAllDayEvents = allDayEvents.length > 0
  const hasWeekTasks = days.some((d) =>
    tasks.some((t) => t.due_on === format(d, "yyyy-MM-dd") && t.status !== "done")
  )
  const showAllDayRow = hasAllDayEvents || hasWeekTasks
  const timedNonReminderEvents = events.filter((e) => e.type !== "reminder" && !e.all_day)

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

            return (
              <div key={day.toISOString()} className="flex-1 relative border-l border-border">
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

                {/* Regular events */}
                {layoutEvents.map((event) => {
                  const start = new Date(event.start_time)
                  const gridStart = new Date(day)
                  gridStart.setHours(HOURS_IN_VIEW[0], 0, 0, 0)
                  const renderStart = event.effectiveStart.getTime() < gridStart.getTime()
                    ? gridStart
                    : event.effectiveStart
                  const top = topForTime(renderStart)
                  const height = heightForEvent(renderStart, event.effectiveEnd)
                  const continuesBefore = event.continuesBefore || event.effectiveStart.getTime() < gridStart.getTime()
                  const continuesAfter = event.continuesAfter
                  const colors = eventColor(event)
                  const width = `${100 / event.cols}%`
                  const left = `${(event.col / event.cols) * 100}%`

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventTap(event)}
                      className="absolute rounded overflow-hidden text-left active:opacity-80"
                      style={{
                        top,
                        height,
                        left,
                        width,
                        paddingLeft: 2,
                        borderLeft: `3px solid ${colors.border}`,
                        backgroundColor: colors.bg,
                        color: colors.text,
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
