"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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

  // Internal state — year selection only highlights until month is tapped or Done
  const [pendingYear, setPendingYear] = useState(anchorDate.getFullYear())
  const [pendingMonth, setPendingMonth] = useState(anchorDate.getMonth())

  // Reset pending state whenever the picker opens
  useEffect(() => {
    if (open) {
      setPendingYear(anchorDate.getFullYear())
      setPendingMonth(anchorDate.getMonth())
    }
  }, [open, anchorDate])

  // Scroll the year list so the selected year is centered
  useEffect(() => {
    if (open && yearRef.current) {
      const yearIndex = YEARS.indexOf(pendingYear)
      const itemHeight = 40
      yearRef.current.scrollTop =
        yearIndex * itemHeight - yearRef.current.clientHeight / 2 + itemHeight / 2
    }
  }, [open, pendingYear])

  function applyAndClose(year: number, month: number) {
    const lastDay = new Date(year, month + 1, 0).getDate()
    const day = Math.min(anchorDate.getDate(), lastDay)
    onSelect(new Date(year, month, day))
  }

  function handleYearTap(year: number) {
    setPendingYear(year)
    // Do NOT close — just highlight
  }

  function handleMonthTap(month: number) {
    setPendingMonth(month)
    applyAndClose(pendingYear, month)
  }

  function handleDone() {
    applyAndClose(pendingYear, pendingMonth)
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
                onClick={() => handleYearTap(year)}
                className={cn(
                  "w-full h-10 text-sm font-medium transition-colors",
                  year === pendingYear
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
                onClick={() => handleMonthTap(i)}
                className={cn(
                  "h-12 rounded-lg text-sm font-medium transition-colors",
                  i === pendingMonth
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border px-4 py-3">
          <Button onClick={handleDone} className="w-full h-10">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
