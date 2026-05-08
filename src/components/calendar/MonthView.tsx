"use client"

import { useRef } from "react"
import { isSameDay, isToday, isSameMonth, format } from "date-fns"
import { getCalendarDays } from "@/lib/date"
import { BUSINESSES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { computeWeekBars, chunkIntoWeeks } from "@/lib/calendarBars"
import type { CalEvent } from "@/lib/hooks/useEvents"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const MAX_DOTS = 4

interface Props {
  anchorDate: Date
  selectedDate: Date | null
  events: CalEvent[]
  onDayTap: (day: Date) => void
  onPrev: () => void
  onNext: () => void
}

function getReminderDots(events: CalEvent[]) {
  return events.map((e) => {
    const biz = BUSINESSES.find((b) => b.id === e.business_id)
    return { color: biz?.color ?? "#9ca3af" }
  })
}

function getReminderEventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999)
  return events.filter((e) => {
    if (e.type !== "reminder") return false
    const start = new Date(e.start_time)
    const end = new Date(e.end_time)
    return start <= dayEnd && end >= dayStart
  })
}

export function MonthView({ anchorDate, selectedDate, events, onDayTap, onPrev, onNext }: Props) {
  const days = getCalendarDays(anchorDate)
  const weeks = chunkIntoWeeks(days)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const isVerticalScroll = useRef(false)

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
    if (Math.abs(dx) > 50) {
      dx < 0 ? onNext() : onPrev()
    }
    touchStartX.current = null
    touchStartY.current = null
    isVerticalScroll.current = false
  }

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="flex flex-col flex-1">
        {weeks.map((week, weekIdx) => {
          const weekStart = week[0]
          const { segments, overflow } = computeWeekBars(events, weekStart)

          return (
            <div key={weekIdx} className="relative grid grid-cols-7 flex-1 min-h-0">
              {week.map((day, colIdx) => {
                const reminderEvents = getReminderEventsForDay(events, day)
                const dots = getReminderDots(reminderEvents)
                const visibleDots = dots.slice(0, MAX_DOTS)
                const extraDots = dots.length > MAX_DOTS ? dots.length - MAX_DOTS : 0
                const overflowCount = overflow[colIdx]

                const isCurrentMonth = isSameMonth(day, anchorDate)
                const todayDay = isToday(day)
                const selected = selectedDate ? isSameDay(day, selectedDate) : false

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => onDayTap(day)}
                    className={cn(
                      "relative flex flex-col items-start border-b border-r border-border p-1 active:bg-muted/50 transition-colors min-h-0",
                      !isCurrentMonth && "opacity-40"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full leading-none mb-0.5",
                        todayDay && "bg-primary text-primary-foreground",
                        selected && !todayDay && "ring-2 ring-primary",
                        !todayDay && !selected && "text-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    {/* Reminder dots row */}
                    {(visibleDots.length > 0 || extraDots > 0) && (
                      <div className="w-full flex items-center gap-0.5 mt-0.5">
                        {visibleDots.map((dot, i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: dot.color }}
                          />
                        ))}
                        {extraDots > 0 && (
                          <span className="text-[9px] text-muted-foreground font-medium leading-none">
                            +{extraDots}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Overflow indicator */}
                    {overflowCount > 0 && (
                      <div className="mt-auto">
                        <span className="text-[9px] text-muted-foreground font-medium leading-none">
                          +{overflowCount}
                        </span>
                      </div>
                    )}
                  </button>
                )
              })}

              {/* Bar overlay — pointer-events-none so taps pass through to cells */}
              <div
                className="absolute inset-x-0 pointer-events-none"
                style={{ top: 26, bottom: 4, zIndex: 1 }}
              >
                {segments.map((seg, i) => (
                  <div
                    key={`${seg.event.id}-${weekIdx}-${i}`}
                    className="absolute"
                    style={{
                      left: `calc(${(seg.startCol / 7) * 100}% + 2px)`,
                      width: `calc(${((seg.endCol - seg.startCol + 1) / 7) * 100}% - 4px)`,
                      top: seg.lane * 7,
                      height: 5,
                      backgroundColor: seg.color,
                      borderTopLeftRadius: seg.continuesBefore ? 0 : 2,
                      borderBottomLeftRadius: seg.continuesBefore ? 0 : 2,
                      borderTopRightRadius: seg.continuesAfter ? 0 : 2,
                      borderBottomRightRadius: seg.continuesAfter ? 0 : 2,
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
