"use client"

import { useRef } from "react"
import { format, isToday, isSameDay } from "date-fns"
import { getWeekDays, HOURS_IN_VIEW } from "@/lib/date"
import { BUSINESSES } from "@/lib/constants"
import { cn } from "@/lib/utils"
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
  const biz = BUSINESSES.find((b) => b.id === event.business_id)
  if (biz) {
    return {
      bg: biz.color + "d9",
      border: biz.color,
      text: biz.textColor === "white" ? "#fff" : "#000",
    }
  }
  return { bg: "#475569d9", border: "#475569", text: "#fff" }
}

export function WeekView({ anchorDate, events, onEventTap, onPrev, onNext }: Props) {
  const days = getWeekDays(anchorDate)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const isVerticalScroll = useRef(false)
  const totalHeight = HOURS_IN_VIEW.length * HOUR_HEIGHT

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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
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
            const layoutEvents = layoutEventsForDay(events, day)

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

                {/* Events */}
                {layoutEvents.map((event) => {
                  const start = new Date(event.start_time)
                  const end = new Date(event.end_time)
                  const top = topForTime(start)
                  const height = heightForEvent(start, end)
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
                      <div className="px-0.5 pt-0.5">
                        <div className="text-[10px] font-semibold leading-tight truncate">
                          {event.title}
                        </div>
                        <div className="text-[9px] opacity-80 leading-tight">
                          {format(start, "h:mma")}
                        </div>
                      </div>
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
