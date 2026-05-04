"use client"

import { useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 101 }, (_, i) => CURRENT_YEAR - 50 + i)

interface Props {
  open: boolean
  anchorDate: Date
  onSelect: (date: Date) => void
  onClose: () => void
}

export function MonthYearPicker({ open, anchorDate, onSelect, onClose }: Props) {
  const yearRef = useRef<HTMLDivElement>(null)
  const selectedYear = anchorDate.getFullYear()
  const selectedMonth = anchorDate.getMonth()

  useEffect(() => {
    if (open && yearRef.current) {
      const yearIndex = YEARS.indexOf(selectedYear)
      const itemHeight = 40
      yearRef.current.scrollTop = yearIndex * itemHeight - yearRef.current.clientHeight / 2 + itemHeight / 2
    }
  }, [open, selectedYear])

  function handleMonthSelect(month: number) {
    const currentYear = selectedYear
    const lastDay = new Date(currentYear, month + 1, 0).getDate()
    const day = Math.min(anchorDate.getDate(), lastDay)
    onSelect(new Date(currentYear, month, day))
  }

  function handleYearSelect(year: number) {
    const lastDay = new Date(year, selectedMonth + 1, 0).getDate()
    const day = Math.min(anchorDate.getDate(), lastDay)
    onSelect(new Date(year, selectedMonth, day))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xs p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm">Jump to month</DialogTitle>
        </DialogHeader>

        <div className="flex h-64">
          {/* Year list */}
          <div
            ref={yearRef}
            className="w-24 overflow-y-auto border-r border-border"
          >
            {YEARS.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => handleYearSelect(year)}
                className={cn(
                  "w-full h-10 text-sm font-medium transition-colors",
                  year === selectedYear
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {year}
              </button>
            ))}
          </div>

          {/* Month grid */}
          <div className="flex-1 grid grid-cols-3 content-start gap-1 p-2">
            {MONTH_NAMES.map((name, i) => (
              <button
                key={name}
                type="button"
                onClick={() => handleMonthSelect(i)}
                className={cn(
                  "h-12 rounded-lg text-sm font-medium transition-colors",
                  i === selectedMonth
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
