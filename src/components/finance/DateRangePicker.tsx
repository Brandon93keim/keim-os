"use client"

import { type DateRange } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"

interface DateRangePickerProps {
  selected: DateRange | undefined
  onSelect: (range: DateRange | undefined) => void
  defaultMonth?: Date
}

export function DateRangePicker({ selected, onSelect, defaultMonth }: DateRangePickerProps) {
  return (
    <Calendar
      mode="range"
      selected={selected}
      onSelect={onSelect}
      numberOfMonths={1}
      defaultMonth={defaultMonth ?? selected?.from ?? new Date()}
      className="mx-auto"
    />
  )
}
