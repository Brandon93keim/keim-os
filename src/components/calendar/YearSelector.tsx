"use client"

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
        {/* Pill (matching the month strip's chip shape) rather than a labelled
            dropdown — the rounded affordance is what signals "tappable" here. */}
        <button
          type="button"
          className="shrink-0 rounded-full border border-border px-3 py-1 text-sm font-semibold leading-tight whitespace-nowrap transition-colors active:bg-muted active:opacity-70"
        >
          {selectedYear}
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
