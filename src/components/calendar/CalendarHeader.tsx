"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatWeekRange, formatDate } from "@/lib/date"
import { YearSelector } from "./YearSelector"
import type { CalendarView } from "./Calendar"

interface Props {
  view: CalendarView
  anchorDate: Date
  onViewChange: (v: CalendarView) => void
  onYearChange: (year: number) => void
  onToday: () => void
  onPrev: () => void
  onNext: () => void
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "month", label: "M" },
  { key: "week", label: "W" },
  { key: "day", label: "D" },
]

export function CalendarHeader({
  view,
  anchorDate,
  onViewChange,
  onYearChange,
  onToday,
  onPrev,
  onNext,
}: Props) {
  return (
    <div className="sticky top-0 z-20 bg-background border-b border-border shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 pr-10">
        <Button variant="ghost" size="sm" onClick={onToday} className="text-xs h-8 px-2">
          Today
        </Button>

        {/* Month view carries the month in the strip and the year beside the
            view toggle, so the centred slot is empty there. */}
        <div className="flex-1 flex justify-center min-w-0">
          {view !== "month" && (
            <span className="text-sm font-semibold leading-tight truncate">
              {view === "week" ? formatWeekRange(anchorDate) : formatDate(anchorDate)}
            </span>
          )}
        </div>

        {/* Year selector and view toggle read as one control cluster. */}
        <div className="flex items-center gap-1.5 shrink-0">
          {view === "month" && (
            <YearSelector anchorDate={anchorDate} onSelectYear={onYearChange} />
          )}

          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            {VIEWS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onViewChange(key)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  view === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Month view navigates by strip and year selector, so the arrows are
          week/day only. */}
      {view !== "month" && (
        <div className="flex items-center justify-between px-3 pb-1.5">
          <button
            onClick={onPrev}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground active:opacity-70"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onNext}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground active:opacity-70"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
