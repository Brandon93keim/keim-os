import { endOfDay, addDays, differenceInCalendarDays, startOfDay, isEqual, subMilliseconds } from "date-fns"
import { colorForEvent } from "@/lib/constants"
import type { CalEvent } from "@/lib/hooks/useEvents"

export type BarSegment = {
  event: CalEvent
  startCol: number
  endCol: number
  widthFraction: number // rendered span in day units (endCol - startCol)
  continuesBefore: boolean
  continuesAfter: boolean
  lane: number
  color: string
}

export type WeekBars = {
  segments: BarSegment[]
  overflow: number[] // length-7; overflow[col] = events that didn't fit
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
// Minimum rendered span (in day units) so brief events stay visible.
const MIN_SPAN = 0.12
// Gap tolerance (in day units) when deciding if two segments can share a lane.
const LANE_GAP_EPSILON = 0.05

export function computeWeekBars(
  events: CalEvent[],
  weekStart: Date,
  maxLanes = 3
): WeekBars {
  const weekEnd = endOfDay(addDays(weekStart, 6))
  const weekStartMs = weekStart.getTime()
  const overflow = [0, 0, 0, 0, 0, 0, 0]

  type Candidate = Omit<BarSegment, "lane">

  const candidates: Candidate[] = []

  for (const event of events) {
    if (event.type === "reminder") continue
    const eventStart = new Date(event.start_time)
    const eventEnd = new Date(event.end_time)
    if (eventStart > weekEnd || eventEnd < weekStart) continue

    // An event ending exactly at midnight occupies zero time on that day, so
    // treat its effective end as the final instant of the previous day.
    const effectiveEnd = isEqual(eventEnd, startOfDay(eventEnd))
      ? subMilliseconds(eventEnd, 1)
      : eventEnd

    const continuesBefore = eventStart < weekStart
    const continuesAfter = effectiveEnd > weekEnd

    let startCol: number
    let endCol: number

    if (event.all_day) {
      // All-day events occupy whole day cells: integer full-day spans where
      // endCol is the exclusive right boundary (day index + 1.0).
      startCol = continuesBefore
        ? 0
        : Math.min(6, Math.max(0, differenceInCalendarDays(startOfDay(eventStart), weekStart)))
      const endDay = continuesAfter
        ? 6
        : Math.min(6, Math.max(0, differenceInCalendarDays(startOfDay(effectiveEnd), weekStart)))
      endCol = endDay + 1
    } else {
      // Timed events map linearly midnight-to-midnight within each cell, so
      // e.g. noon sits 0.5 into the day. Clamp to the visible week window.
      startCol = continuesBefore
        ? 0
        : Math.min(7, Math.max(0, (eventStart.getTime() - weekStartMs) / MS_PER_DAY))
      endCol = continuesAfter
        ? 7
        : Math.min(7, Math.max(0, (effectiveEnd.getTime() - weekStartMs) / MS_PER_DAY))
    }

    // Enforce a minimum rendered span so short events stay visible. Anchor at
    // the start fraction, extending right; if that would overflow the day
    // cell, shrink toward the day boundary instead.
    if (endCol - startCol < MIN_SPAN) {
      const dayBoundary = Math.floor(startCol) + 1
      if (startCol + MIN_SPAN > dayBoundary) {
        endCol = dayBoundary
        startCol = dayBoundary - MIN_SPAN
      } else {
        endCol = startCol + MIN_SPAN
      }
    }

    candidates.push({
      event,
      startCol,
      endCol,
      widthFraction: endCol - startCol,
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

  // Greedy lane assignment: laneEnd[i] = endCol of last segment in lane i. A
  // segment joins a lane when it starts at/after that lane's end (within a
  // small gap epsilon), so touching same-day events can share a lane.
  const laneEnd: number[] = []
  const segments: BarSegment[] = []

  for (const c of candidates) {
    let assignedLane = -1
    for (let lane = 0; lane < laneEnd.length; lane++) {
      if (laneEnd[lane] - c.startCol <= LANE_GAP_EPSILON) {
        assignedLane = lane
        break
      }
    }
    if (assignedLane === -1) assignedLane = laneEnd.length

    if (assignedLane >= maxLanes) {
      const firstCol = Math.max(0, Math.floor(c.startCol))
      const lastCol = Math.min(6, Math.ceil(c.endCol) - 1)
      for (let col = firstCol; col <= lastCol; col++) {
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
