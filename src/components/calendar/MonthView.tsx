"use client"

import { useRef } from "react"
import { isSameDay, isToday, isSameMonth, format } from "date-fns"
import { getCalendarDays } from "@/lib/date"
import { BUSINESSES, colorForEvent } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { CalEvent } from "@/lib/hooks/useEvents"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const MAX_STRIPES = 3
const MAX_DOTS = 4

interface Props {
  anchorDate: Date
  selectedDate: Date | null
  events: CalEvent[]
  onDayTap: (day: Date) => void
  onPrev: () => void
  onNext: () => void
}

function getEventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999)
  return events.filter((e) => {
    const start = new Date(e.start_time)
    const end = new Date(e.end_time)
    return start <= dayEnd && end >= dayStart
  })
}

function getEventStripes(events: CalEvent[]) {
  const seen = new Set<string>()
  const stripes: Array<{ color: string }> = []
  for (const e of events) {
    const color = colorForEvent(e)
    if (!seen.has(color)) {
      seen.add(color)
      stripes.push({ color })
    }
  }
  return stripes
}

function getReminderDots(events: CalEvent[]) {
  return events.map((e) => {
    const biz = BUSINESSES.find((b) => b.id === e.business_id)
    return { color: biz?.color ?? "#9ca3af" }
  })
}

export function MonthView({ anchorDate, selectedDate, events, onDayTap, onPrev, onNext }: Props) {
  const days = getCalendarDays(anchorDate)
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

      {/* Day grid */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1">
        {days.map((day) => {
          const dayEvents = getEventsForDay(events, day)
          const reminderEvents = dayEvents.filter((e) => e.type === "reminder")
          const nonReminderEvents = dayEvents.filter((e) => e.type !== "reminder")

          const dots = getReminderDots(reminderEvents)
          const visibleDots = dots.slice(0, MAX_DOTS)
          const extraDots = dots.length > MAX_DOTS ? dots.length - MAX_DOTS : 0

          const stripes = getEventStripes(nonReminderEvents)
          const visibleStripes = stripes.slice(0, MAX_STRIPES)
          const extraStripes = stripes.length > MAX_STRIPES ? stripes.length - MAX_STRIPES : 0

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

              {/* Business stripes row */}
              <div className="w-full flex flex-col gap-px mt-auto">
                {visibleStripes.map((stripe, i) => (
                  <div
                    key={i}
                    className="h-[3px] w-full rounded-sm"
                    style={{ backgroundColor: stripe.color }}
                  />
                ))}
                {extraStripes > 0 && (
                  <span className="text-[9px] text-muted-foreground font-medium leading-none">
                    +{extraStripes}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
