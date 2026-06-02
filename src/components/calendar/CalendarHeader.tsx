"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatMonthYear, formatWeekRange, formatDate } from "@/lib/date"
import { MonthYearPicker } from "./MonthYearPicker"
import type { CalendarView } from "./Calendar"

interface Props {
  view: CalendarView
  anchorDate: Date
  onViewChange: (v: CalendarView) => void
  onAnchorChange: (date: Date) => void
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
  onAnchorChange,
  onToday,
  onPrev,
  onNext,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const dateLabel =
    view === "month"
      ? formatMonthYear(anchorDate)
      : view === "week"
        ? formatWeekRange(anchorDate)
        : formatDate(anchorDate)

  return (
    <>
      <div className="sticky top-0 z-20 bg-background border-b border-border shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 pr-10">
          <Button variant="ghost" size="sm" onClick={onToday} className="text-xs h-8 px-2">
            Today
          </Button>

          <button
            onClick={() => view === "month" && setPickerOpen(true)}
            className={cn(
              "flex-1 text-center text-sm font-semibold leading-tight truncate",
              view === "month" && "cursor-pointer active:opacity-70"
            )}
          >
            {dateLabel}
          </button>

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
      </div>

      <MonthYearPicker
        open={pickerOpen}
        anchorDate={anchorDate}
        onSelect={(date) => {
          onAnchorChange(date)
          setPickerOpen(false)
        }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}
