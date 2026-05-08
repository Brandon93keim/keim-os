import { endOfDay, addDays, differenceInCalendarDays, startOfDay } from "date-fns"
import { colorForEvent } from "@/lib/constants"
import type { CalEvent } from "@/lib/hooks/useEvents"

export type BarSegment = {
  event: CalEvent
  startCol: number
  endCol: number
  continuesBefore: boolean
  continuesAfter: boolean
  lane: number
  color: string
}

export type WeekBars = {
  segments: BarSegment[]
  overflow: number[] // length-7; overflow[col] = events that didn't fit
}

export function computeWeekBars(
  events: CalEvent[],
  weekStart: Date,
  maxLanes = 3
): WeekBars {
  const weekEnd = endOfDay(addDays(weekStart, 6))
  const overflow = [0, 0, 0, 0, 0, 0, 0]

  type Candidate = Omit<BarSegment, "lane">

  const candidates: Candidate[] = []

  for (const event of events) {
    if (event.type === "reminder") continue
    const eventStart = new Date(event.start_time)
    const eventEnd = new Date(event.end_time)
    if (eventStart > weekEnd || eventEnd < weekStart) continue

    const continuesBefore = eventStart < weekStart
    const continuesAfter = eventEnd > weekEnd

    const startCol = continuesBefore
      ? 0
      : Math.min(6, Math.max(0, differenceInCalendarDays(startOfDay(eventStart), weekStart)))

    const endCol = continuesAfter
      ? 6
      : Math.min(6, Math.max(0, differenceInCalendarDays(startOfDay(eventEnd), weekStart)))

    candidates.push({
      event,
      startCol,
      endCol,
      continuesBefore,
      continuesAfter,
      color: colorForEvent(event),
    })
  }

  // Longer spans first within same start column for visual stability
  candidates.sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol
    return (b.endCol - b.startCol) - (a.endCol - a.startCol)
  })

  // Greedy lane assignment: laneEnd[i] = endCol of last segment in lane i
  const laneEnd: number[] = []
  const segments: BarSegment[] = []

  for (const c of candidates) {
    let assignedLane = -1
    for (let lane = 0; lane < laneEnd.length; lane++) {
      if (laneEnd[lane] < c.startCol) {
        assignedLane = lane
        break
      }
    }
    if (assignedLane === -1) assignedLane = laneEnd.length

    if (assignedLane >= maxLanes) {
      for (let col = c.startCol; col <= c.endCol; col++) {
        overflow[col]++
      }
    } else {
      laneEnd[assignedLane] = c.endCol
      segments.push({ ...c, lane: assignedLane })
    }
  }

  return { segments, overflow }
}

export function chunkIntoWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}
