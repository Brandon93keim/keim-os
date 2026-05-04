"use client"

import { useRef } from "react"
import { isSameDay, isToday, isSameMonth, format } from "date-fns"
import { getCalendarDays } from "@/lib/date"
import { BUSINESSES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { CalEvent } from "@/lib/hooks/useEvents"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface Props {
  anchorDate: Date
  selectedDate: Date | null
  events: CalEvent[]
  onDayTap: (day: Date) => void
  onPrev: () => void
  onNext: () => void
}

function getEventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  return events.filter((e) => isSameDay(new Date(e.start_time), day))
}

function getBusinessStripes(events: CalEvent[]) {
  const seen = new Set<string>()
  const stripes: Array<{ color: string }> = []
  for (const e of events) {
    if (e.business_id && !seen.has(e.business_id)) {
      seen.add(e.business_id)
      const biz = BUSINESSES.find((b) => b.id === e.business_id)
      if (biz) stripes.push({ color: biz.color })
    }
    if (stripes.length >= 4) break
  }
  return stripes
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
          const stripes = getBusinessStripes(dayEvents)
          const extra = stripes.length >= 4 ? dayEvents.length - 3 : 0
          const visibleStripes = extra > 0 ? stripes.slice(0, 3) : stripes
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

              {/* Business stripes */}
              <div className="w-full flex flex-col gap-px mt-auto">
                {visibleStripes.map((stripe, i) => (
                  <div
                    key={i}
                    className="h-[3px] w-full rounded-sm"
                    style={{ backgroundColor: stripe.color }}
                  />
                ))}
                {extra > 0 && (
                  <span className="text-[9px] text-muted-foreground font-medium leading-none">
                    +{extra}
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
