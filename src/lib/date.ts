import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  format,
  roundToNearestMinutes,
} from "date-fns"

export {
  isSameDay,
  isToday,
  isSameMonth,
  startOfDay,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  startOfWeek,
  endOfWeek,
  format,
} from "date-fns"

export function startOfCalendarMonth(date: Date): Date {
  return startOfWeek(startOfMonth(date), { weekStartsOn: 0 })
}

export function endOfCalendarMonth(date: Date): Date {
  return endOfWeek(endOfMonth(date), { weekStartsOn: 0 })
}

export function getCalendarDays(date: Date): Date[] {
  const start = startOfCalendarMonth(date)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 0 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatTime(date: Date): string {
  return format(date, "h:mm a")
}

export function formatDate(date: Date): string {
  return format(date, "EEE, MMM d")
}

export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy")
}

export function formatWeekRange(date: Date): string {
  const start = startOfWeek(date, { weekStartsOn: 0 })
  const end = endOfWeek(date, { weekStartsOn: 0 })
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
  }
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`
}

export function roundUpToNextHalfHour(date: Date): Date {
  const rounded = roundToNearestMinutes(date, { nearestTo: 30, roundingMethod: "ceil" })
  return rounded
}

export function roundToNearest15(date: Date): Date {
  return roundToNearestMinutes(date, { nearestTo: 15 })
}

export const HOURS_IN_VIEW = Array.from({ length: 17 }, (_, i) => i + 6)
