"use client"

import { useRef } from "react"
import { format, isToday, isSameDay } from "date-fns"
import { Bell, Repeat } from "lucide-react"
import { getWeekDays, HOURS_IN_VIEW } from "@/lib/date"
import { BUSINESSES, colorForEvent } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useClients } from "@/lib/hooks/useClients"
import { layoutEventsForDay, topForTime, heightForEvent, HOUR_HEIGHT } from "./eventLayout"
import type { CalEvent } from "@/lib/hooks/useEvents"

interface Props {
  anchorDate: Date
  events: CalEvent[]
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

function reminderColors(event: CalEvent): { bg: string; border: string; text: string } {
  const base = colorForEvent(event)
  return { bg: base + "26", border: base, text: base + "e6" }
}

export function WeekView({ anchorDate, events, onEventTap, onPrev, onNext }: Props) {
  const days = getWeekDays(anchorDate)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const isVerticalScroll = useRef(false)
  const totalHeight = HOURS_IN_VIEW.length * HOUR_HEIGHT
  const { data: clients = [] } = useClients()

  const allDayEvents = events.filter((e) => e.all_day)
  const hasAllDayEvents = allDayEvents.length > 0
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

      {/* All-day events row — shown only when there are all-day events in the week */}
      {hasAllDayEvents && (
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
            return (
              <div
                key={day.toISOString()}
                className="flex-1 border-l border-border flex items-center gap-0.5 px-0.5 py-1 overflow-hidden min-w-0"
              >
                {dayAllDay.map((event) => {
                  const base = colorForEvent(event)
                  const colors = { bg: base + "26", border: base, text: base + "e6" }
                  const isReminder = event.type === "reminder"
                  const linked = isReminder ? clients.find((c) => c.id === event.reminder_for_client_id) : null
                  const label = linked ? `${event.title} · ${linked.name}` : event.title
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
                      {isReminder && <Bell size={8} className="shrink-0" />}
                      <span className="truncate max-w-[60px]">{label}</span>
                    </button>
                  )
                })}
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
            const colDayStart = new Date(day); colDayStart.setHours(0, 0, 0, 0)
            const colDayEnd = new Date(day); colDayEnd.setHours(23, 59, 59, 999)
            const dayTimedReminders = events.filter((e) => {
              if (e.type !== "reminder" || e.all_day) return false
              const start = new Date(e.start_time)
              const end = new Date(e.end_time)
              return start <= colDayEnd && end >= colDayStart
            })

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
                  const end = new Date(event.end_time)
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
                          {event.title}
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

                {/* Timed reminders — 22px pill anchored to start time */}
                {dayTimedReminders.map((event) => {
                  const start = new Date(event.start_time)
                  const top = topForTime(start)
                  const colors = reminderColors(event)
                  const linked = clients.find((c) => c.id === event.reminder_for_client_id)
                  const label = linked ? `${event.title} · ${linked.name}` : event.title

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventTap(event)}
                      className="absolute left-0 right-0 flex items-center gap-0.5 rounded-full px-1 text-[9px] font-medium overflow-hidden z-10 active:opacity-70"
                      style={{
                        top,
                        height: 22,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.bg,
                        color: colors.text,
                      }}
                    >
                      <Bell size={8} className="shrink-0" />
                      <span className="truncate">{label}</span>
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
