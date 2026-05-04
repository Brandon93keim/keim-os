import { isSameDay } from "date-fns"
import type { CalEvent } from "@/lib/hooks/useEvents"

export interface LayoutEvent extends CalEvent {
  col: number
  cols: number
}

export function layoutEventsForDay(events: CalEvent[], day: Date): LayoutEvent[] {
  const dayEvents = events
    .filter((e) => isSameDay(new Date(e.start_time), day))
    .sort((a, b) => {
      const diff = new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      if (diff !== 0) return diff
      return new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
    })

  const layout: LayoutEvent[] = []
  const colEnds: Date[] = []

  for (const event of dayEvents) {
    const start = new Date(event.start_time)
    const end = new Date(event.end_time)

    let col = colEnds.findIndex((endTime) => endTime <= start)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(end)
    } else {
      colEnds[col] = end
    }

    layout.push({ ...event, col, cols: 0 })
  }

  // Compute cols per event: max col index among all overlapping events + 1
  for (let i = 0; i < layout.length; i++) {
    const a = layout[i]
    const aStart = new Date(a.start_time).getTime()
    const aEnd = new Date(a.end_time).getTime()
    let maxCol = a.col

    for (let j = 0; j < layout.length; j++) {
      if (i === j) continue
      const b = layout[j]
      const bStart = new Date(b.start_time).getTime()
      const bEnd = new Date(b.end_time).getTime()
      if (aStart < bEnd && bStart < aEnd) {
        maxCol = Math.max(maxCol, b.col)
      }
    }

    layout[i].cols = maxCol + 1
  }

  return layout
}

export const HOUR_HEIGHT = 60
export const GRID_START_HOUR = 6

export function topForTime(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60
  return (hours - GRID_START_HOUR) * HOUR_HEIGHT
}

export function heightForEvent(start: Date, end: Date): number {
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  return Math.max(durationHours * HOUR_HEIGHT, 24)
}
