"use client"

import { Plus } from "lucide-react"
import { addHours, startOfDay } from "date-fns"
import { roundUpToNextHalfHour } from "@/lib/date"
import type { CalendarView } from "./Calendar"
import type { EventFormValues } from "@/lib/validations/event"

interface Props {
  view: CalendarView
  anchorDate: Date
  selectedDate: Date | null
  onOpen: (defaults: { start_time?: Date; end_time?: Date; type?: EventFormValues["type"] }) => void
}

export function CalendarFAB({ view, anchorDate, selectedDate, onOpen }: Props) {
  function handleTap() {
    const base = selectedDate ?? anchorDate
    const baseDay = startOfDay(base)

    let startTime: Date
    if (view === "day") {
      // Round up to next half hour from now if viewing today
      const now = new Date()
      if (baseDay.toDateString() === now.toDateString()) {
        startTime = roundUpToNextHalfHour(now)
      } else {
        const nine = new Date(baseDay)
        nine.setHours(9, 0, 0, 0)
        startTime = nine
      }
    } else {
      const nine = new Date(baseDay)
      nine.setHours(9, 0, 0, 0)
      startTime = nine
    }

    onOpen({ start_time: startTime, end_time: addHours(startTime, 1), type: "meeting" })
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className="fixed z-30 flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 text-white shadow-lg active:scale-95 transition-transform dark:bg-slate-100 dark:text-slate-900"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 80px)",
        right: "16px",
      }}
      aria-label="New event"
    >
      <Plus size={28} strokeWidth={2.5} />
    </button>
  )
}
