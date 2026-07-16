"use client"

import { useEffect, useRef, useMemo } from "react"
import { isSameDay, isToday, isSameMonth, format, addMonths, startOfMonth } from "date-fns"
import { getCalendarDays } from "@/lib/date"
import { getBusinessById } from "@/lib/constants"
import { getEffectiveTaskStatus, STATUS_COLORS } from "@/lib/taskStatus"
import type { TaskWithRelations } from "@/lib/hooks/useTasks"
import { cn } from "@/lib/utils"
import { computeWeekBars, chunkIntoWeeks } from "@/lib/calendarBars"
import type { CalEvent } from "@/lib/hooks/useEvents"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MAX_DOTS = 4
const CENTER_IDX = 12
const MONTH_COUNT = 25
const STICKY_H = 30

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
}


export function MonthView({ anchorDate, selectedDate, events, tasks, onDayTap, onAnchorChange }: Props) {
  const today = format(new Date(), "yyyy-MM-dd")
  const months = useMemo(
    () => Array.from({ length: MONTH_COUNT }, (_, i) => startOfMonth(addMonths(startOfMonth(new Date()), i - CENTER_IDX))),
    []
  )

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastReportedRef = useRef<Date>(months[CENTER_IDX])
  const pendingScrollRef = useRef(false)

  // Synchronous scroll to today's month so IntersectionObserver fires with correct position
  useEffect(() => {
    const container = scrollContainerRef.current
    const target = sectionRefs.current[CENTER_IDX]
    if (container && target) {
      container.scrollTop = target.offsetTop - STICKY_H
    }
  }, [])

  // Scroll to anchorDate when changed externally (Today button or picker)
  useEffect(() => {
    const idx = months.findIndex((m) => isSameMonth(m, anchorDate))
    if (idx === -1) return
    if (isSameMonth(anchorDate, lastReportedRef.current)) return
    const target = sectionRefs.current[idx]
    if (!target) return
    pendingScrollRef.current = true
    target.scrollIntoView({ block: "start", behavior: "smooth" })
    lastReportedRef.current = months[idx]
    setTimeout(() => { pendingScrollRef.current = false }, 800)
  }, [anchorDate, months])

  // IntersectionObserver updates header label as user scrolls
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const visibleSet = new Set<number>()

    const observer = new IntersectionObserver(
      (entries) => {
        if (pendingScrollRef.current) return
        for (const entry of entries) {
          const idx = Number(entry.target.getAttribute("data-month-idx"))
          if (isNaN(idx)) continue
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            visibleSet.add(idx)
          } else {
            visibleSet.delete(idx)
          }
        }
        if (visibleSet.size === 0) return
        const topIdx = Math.min(...visibleSet)
        const month = months[topIdx]
        if (!isSameMonth(month, lastReportedRef.current)) {
          lastReportedRef.current = month
          onAnchorChange(month)
        }
      },
      { root: container, threshold: 0.5 }
    )

    sectionRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [months, onAnchorChange])

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto h-full select-none">
      {/* Sticky day-name header */}
      <div className="sticky top-0 z-10 grid grid-cols-7 bg-background border-b border-border">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {months.map((month, monthIdx) => {
        const days = getCalendarDays(month)
        const weeks = chunkIntoWeeks(days)

        return (
          <div
            key={monthIdx}
            ref={(el) => { sectionRefs.current[monthIdx] = el }}
            data-month-idx={monthIdx}
            style={{ backgroundColor: getMonthTint(month), scrollMarginTop: STICKY_H }}
          >
            <div className="px-3 py-2 text-sm font-semibold text-muted-foreground border-b border-border/40">
              {format(month, "MMMM yyyy")}
            </div>

            {weeks.map((week, weekIdx) => {
              const weekStart = week[0]
              const { segments, overflow } = computeWeekBars(events, weekStart)

              return (
                <div key={weekIdx} className="relative grid grid-cols-7 min-h-[90px]">
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
                        key={day.toISOString()}
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
                        key={`${seg.event.id}-${monthIdx}-${weekIdx}-${i}`}
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
        )
      })}
    </div>
  )
}
