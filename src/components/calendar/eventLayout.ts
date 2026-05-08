import type { CalEvent } from "@/lib/hooks/useEvents"

export interface LayoutEvent extends CalEvent {
  col: number
  cols: number
  effectiveStart: Date
  effectiveEnd: Date
  continuesBefore: boolean
  continuesAfter: boolean
}

export function layoutEventsForDay(events: CalEvent[], day: Date): LayoutEvent[] {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999)

  const dayEvents = events
    .filter((e) => {
      const start = new Date(e.start_time)
      const end = new Date(e.end_time)
      return start <= dayEnd && end >= dayStart
    })
    .sort((a, b) => {
      const aEffStart = Math.max(new Date(a.start_time).getTime(), dayStart.getTime())
      const bEffStart = Math.max(new Date(b.start_time).getTime(), dayStart.getTime())
      const diff = aEffStart - bEffStart
      if (diff !== 0) return diff
      const aEffEnd = Math.min(new Date(a.end_time).getTime(), dayEnd.getTime())
      const bEffEnd = Math.min(new Date(b.end_time).getTime(), dayEnd.getTime())
      return bEffEnd - aEffEnd
    })

  const layout: LayoutEvent[] = []
  const colEnds: Date[] = []

  for (const event of dayEvents) {
    const effectiveStart = new Date(Math.max(new Date(event.start_time).getTime(), dayStart.getTime()))
    const effectiveEnd = new Date(Math.min(new Date(event.end_time).getTime(), dayEnd.getTime()))

    let col = colEnds.findIndex((endTime) => endTime <= effectiveStart)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(effectiveEnd)
    } else {
      colEnds[col] = effectiveEnd
    }

    layout.push({
      ...event,
      col,
      cols: 0,
      effectiveStart,
      effectiveEnd,
      continuesBefore: new Date(event.start_time) < dayStart,
      continuesAfter: new Date(event.end_time) > dayEnd,
    })
  }

  for (let i = 0; i < layout.length; i++) {
    const a = layout[i]
    const aStart = a.effectiveStart.getTime()
    const aEnd = a.effectiveEnd.getTime()
    let maxCol = a.col

    for (let j = 0; j < layout.length; j++) {
      if (i === j) continue
      const b = layout[j]
      const bStart = b.effectiveStart.getTime()
      const bEnd = b.effectiveEnd.getTime()
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
