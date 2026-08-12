"use client"

import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// Bounded range around the current year — deliberately small, since the strip
// only ever shows one year at a time and the calendar has no data far out.
const YEARS_BACK = 3
const YEARS_FORWARD = 5

interface Props {
  anchorDate: Date
  onSelectYear: (year: number) => void
}

export function YearSelector({ anchorDate, onSelectYear }: Props) {
  const selectedYear = anchorDate.getFullYear()
  const currentYear = new Date().getFullYear()
  const years = Array.from(
    { length: YEARS_BACK + YEARS_FORWARD + 1 },
    (_, i) => currentYear - YEARS_BACK + i
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold leading-tight active:opacity-70"
        >
          {selectedYear}
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="center" className="w-auto min-w-24">
        {years.map((year) => (
          <DropdownMenuItem
            key={year}
            onSelect={() => onSelectYear(year)}
            className={cn(
              "justify-center text-sm font-medium",
              year === selectedYear && "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground"
            )}
          >
            {year}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
