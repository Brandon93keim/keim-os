"use client"

import { useEffect, useRef, useMemo } from "react"
import { isSameDay, isToday, isSameMonth, format, startOfMonth } from "date-fns"
import { getCalendarDays } from "@/lib/date"
import { getBusinessById } from "@/lib/constants"
import { getEffectiveTaskStatus, STATUS_COLORS } from "@/lib/taskStatus"
import type { TaskWithRelations } from "@/lib/hooks/useTasks"
import { cn } from "@/lib/utils"
import { computeWeekBars, chunkIntoWeeks } from "@/lib/calendarBars"
import type { CalEvent } from "@/lib/hooks/useEvents"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MAX_DOTS = 4

function getMonthTint(date: Date): string {
  const hue = (date.getMonth() * 30) % 360
  return `hsl(${hue}, 8%, 8%)`
}

interface Props {
  anchorDate: Date
  selectedDate: Date | null
  events: CalEvent[]
  tasks: TaskWithRelations[]
  onDayTap: (day: Date) => void
  onAnchorChange: (date: Date) => void
  onPrev: () => void
  onNext: () => void
}


export function MonthView({ anchorDate, selectedDate, events, tasks, onDayTap, onAnchorChange, onPrev, onNext }: Props) {
  const today = format(new Date(), "yyyy-MM-dd")
  const month = useMemo(() => startOfMonth(anchorDate), [anchorDate])
  const weeks = useMemo(() => chunkIntoWeeks(getCalendarDays(month)), [month])

  // Twelve chips for the selected year only — the header's year selector
  // carries the year, so the strip needs no year text of its own.
  const year = anchorDate.getFullYear()
  const stripMonths = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)),
    [year]
  )

  const stripRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([])
  const didInitStripRef = useRef(false)

  // Keep the active chip centred as the anchor moves. Scrolling the strip
  // directly (rather than scrollIntoView) keeps ancestors from scrolling too.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const chip = chipRefs.current[anchorDate.getMonth()]
    if (!chip) return
    strip.scrollTo({
      left: chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2,
      behavior: didInitStripRef.current ? "smooth" : "auto",
    })
    didInitStripRef.current = true
  }, [anchorDate, stripMonths])

  // Horizontal swipe steps a month — same threshold logic as DayView/WeekView.
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
    if (Math.abs(dx) > 50) dx < 0 ? onNext() : onPrev()
    touchStartX.current = null
    touchStartY.current = null
    isVerticalScroll.current = false
  }

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Month strip */}
      <div
        ref={stripRef}
        className="relative shrink-0 flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stripMonths.map((m, i) => {
          const active = isSameMonth(m, anchorDate)
          return (
            <button
              key={format(m, "yyyy-MM")}
              ref={(el) => { chipRefs.current[i] = el }}
              type="button"
              onClick={() => onAnchorChange(startOfMonth(m))}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground active:bg-muted"
              )}
            >
              {format(m, "MMM")}
            </button>
          )
        })}
      </div>

      {/* The month fills the viewport exactly and never scrolls: the app shell
          already reserves --bottom-nav-clearance, so the height this column
          inherits stops clear of the bottom nav. */}
      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{ touchAction: "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="shrink-0 grid grid-cols-7 bg-background border-b border-border">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {name}
            </div>
          ))}
        </div>

        <div
          className="flex-1 min-h-0 flex flex-col"
          style={{ backgroundColor: getMonthTint(month) }}
        >
          {weeks.map((week, weekIdx) => {
            const weekStart = week[0]
            const { segments, overflow } = computeWeekBars(events, weekStart)

            return (
              // Rows split the leftover height evenly, so the grid ends flush
              // with the viewport whatever number of weeks a month spans.
              <div
                key={format(weekStart, "yyyy-MM-dd")}
                className="relative grid grid-cols-7 flex-1 min-h-0"
              >
                {week.map((day, colIdx) => {
                  const dayStr = format(day, "yyyy-MM-dd")
                  const dayTasks = tasks.filter((t) => t.due_on === dayStr)
                  const dots = dayTasks.map((t) => {
                    if (getEffectiveTaskStatus(t, today) === "overdue") return { color: STATUS_COLORS.overdue }
                    return { color: (t.business_id ? getBusinessById(t.business_id)?.color : undefined) ?? "#9ca3af" }
                  })
                  const visibleDots = dots.slice(0, MAX_DOTS)
                  const extraDots = dots.length > MAX_DOTS ? dots.length - MAX_DOTS : 0
                  const overflowCount = overflow[colIdx]
                  const isCurrentMonth = isSameMonth(day, month)
                  const todayDay = isToday(day)
                  const selected = selectedDate ? isSameDay(day, selectedDate) : false

                  return (
                    <button
                      key={dayStr}
                      type="button"
                      onClick={() => onDayTap(day)}
                      className={cn(
                        "relative flex flex-col items-start border-b border-r border-border p-1 active:bg-muted/50 transition-colors",
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

                <div
                  className="absolute inset-x-0 pointer-events-none"
                  style={{ top: 26, bottom: 4, zIndex: 1 }}
                >
                  {segments.map((seg, i) => (
                    <div
                      key={`${seg.event.id}-${weekIdx}-${i}`}
                      className="absolute flex items-center overflow-hidden"
                      style={{
                        left: `calc(${(seg.startCol / 7) * 100}% + 2px)`,
                        width: `calc(${(seg.widthFraction / 7) * 100}% - 4px)`,
                        top: seg.lane * 18,
                        height: 16,
                        backgroundColor: seg.color,
                        borderTopLeftRadius: seg.continuesBefore ? 0 : 2,
                        borderBottomLeftRadius: seg.continuesBefore ? 0 : 2,
                        borderTopRightRadius: seg.continuesAfter ? 0 : 2,
                        borderBottomRightRadius: seg.continuesAfter ? 0 : 2,
                      }}
                    >
                      {seg.widthFraction >= 0.6 && (
                        <span className="truncate text-[10px] leading-tight px-1 text-white font-medium">
                          {seg.event.title}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
