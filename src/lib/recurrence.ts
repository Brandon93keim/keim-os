import { RRule, Weekday } from "rrule"
import { format } from "date-fns"

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"

export type MonthlyMode = "by_day" | "by_weekday"

export type RecurrenceEndType = "never" | "count" | "until"

export interface RecurrenceConfig {
  freq: RecurrenceFreq
  interval: number
  byweekday?: number[]       // WEEKLY: 0=MO … 6=SU (rrule convention)
  monthlyMode?: MonthlyMode  // MONTHLY only
  bymonthday?: number        // MONTHLY by_day: 1–31
  bysetpos?: number          // MONTHLY by_weekday: 1–4 or -1 (last)
  monthlyWeekday?: number    // MONTHLY by_weekday: 0=MO … 6=SU
  endType: RecurrenceEndType
  count?: number
  until?: Date
}

// rrule weekday constants indexed 0=MO … 6=SU
const RRULE_WEEKDAYS = [
  RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU,
]

const FREQ_MAP: Record<RecurrenceFreq, number> = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
}

const FREQ_REVERSE: Record<number, RecurrenceFreq> = {
  [RRule.DAILY]: "DAILY",
  [RRule.WEEKLY]: "WEEKLY",
  [RRule.MONTHLY]: "MONTHLY",
  [RRule.YEARLY]: "YEARLY",
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "last"]

// -----------------------------------------------------------------------
// buildRRule
// -----------------------------------------------------------------------
export function buildRRule(config: RecurrenceConfig, dtstart: Date): RRule {
  const opts: ConstructorParameters<typeof RRule>[0] = {
    freq: FREQ_MAP[config.freq],
    interval: config.interval,
    dtstart,
    wkst: RRule.SU,
  }

  if (config.freq === "WEEKLY" && config.byweekday?.length) {
    opts.byweekday = config.byweekday.map((d) => RRULE_WEEKDAYS[d])
  }

  if (config.freq === "MONTHLY") {
    if (config.monthlyMode === "by_day" && config.bymonthday != null) {
      opts.bymonthday = config.bymonthday
    } else if (
      config.monthlyMode === "by_weekday" &&
      config.bysetpos != null &&
      config.monthlyWeekday != null
    ) {
      opts.byweekday = [RRULE_WEEKDAYS[config.monthlyWeekday].nth(config.bysetpos)]
    }
  }

  if (config.endType === "count" && config.count != null) {
    opts.count = config.count
  } else if (config.endType === "until" && config.until != null) {
    opts.until = config.until
  }

  return new RRule(opts)
}

// -----------------------------------------------------------------------
// rruleToString — RRULE line only, no DTSTART
// -----------------------------------------------------------------------
export function rruleToString(rule: RRule): string {
  const full = rule.toString()
  // toString() returns "DTSTART:...\nRRULE:..." — strip DTSTART line
  const lines = full.split("\n")
  const rruleLine = lines.find((l) => l.startsWith("RRULE:"))
  return rruleLine ?? full
}

// -----------------------------------------------------------------------
// parseRRule — reconstruct RRule from stored string + dtstart
// -----------------------------------------------------------------------
export function parseRRule(rruleString: string, dtstart: Date): RRule {
  if (rruleString.includes("DTSTART")) {
    return RRule.fromString(rruleString)
  }
  const formatted = formatDateForRRule(dtstart)
  return RRule.fromString(`DTSTART:${formatted}\n${rruleString}`)
}

function formatDateForRRule(date: Date): string {
  // Must be UTC — toISOString gives "2026-03-01T00:00:00.000Z", strip separators
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

// -----------------------------------------------------------------------
// getOccurrencesBetween — expand rule, apply exception filter
// -----------------------------------------------------------------------
export function getOccurrencesBetween(
  rruleString: string,
  dtstart: Date,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: Array<{
    original_occurrence_date: Date
    action: "cancelled" | "modified"
  }> = []
): Date[] {
  const rule = parseRRule(rruleString, dtstart)
  const occurrences = rule.between(rangeStart, rangeEnd, true)

  const cancelledSet = new Set(
    exceptions
      .filter((ex) => ex.action === "cancelled" || ex.action === "modified")
      .map((ex) => ex.original_occurrence_date.toISOString().slice(0, 10))
  )

  return occurrences.filter(
    (d) => !cancelledSet.has(d.toISOString().slice(0, 10))
  )
}

// -----------------------------------------------------------------------
// getAllOccurrencesCount — total count, capped at limit for infinite rules
// -----------------------------------------------------------------------
export function getAllOccurrencesCount(
  rruleString: string,
  dtstart: Date,
  limit = 1000
): number {
  const rule = parseRRule(rruleString, dtstart)
  const opts = rule.options
  if (opts.count == null && opts.until == null) return limit
  const all = rule.all((_, i) => i < limit)
  return all.length
}

// -----------------------------------------------------------------------
// describeRecurrence — human-readable summary
// -----------------------------------------------------------------------
export function describeRecurrence(config: RecurrenceConfig): string {
  let base = ""

  switch (config.freq) {
    case "DAILY":
      base = config.interval === 1 ? "Daily" : `Every ${config.interval} days`
      break

    case "WEEKLY": {
      const days = (config.byweekday ?? [])
        .map((d) => WEEKDAY_NAMES[d])
        .join(", ")
      const on = days ? ` on ${days}` : ""
      base =
        config.interval === 1
          ? `Weekly${on}`
          : `Every ${config.interval} weeks${on}`
      break
    }

    case "MONTHLY": {
      if (config.monthlyMode === "by_day" && config.bymonthday != null) {
        base = `Monthly on day ${config.bymonthday}`
      } else if (
        config.monthlyMode === "by_weekday" &&
        config.bysetpos != null &&
        config.monthlyWeekday != null
      ) {
        const ord =
          config.bysetpos === -1
            ? "last"
            : ORDINALS[config.bysetpos] ?? `${config.bysetpos}th`
        const day = WEEKDAY_NAMES[config.monthlyWeekday]
        base = `Monthly on the ${ord} ${day}`
      } else {
        base = "Monthly"
      }
      if (config.interval > 1) base = `Every ${config.interval} months`
      break
    }

    case "YEARLY":
      base = config.interval === 1 ? "Yearly" : `Every ${config.interval} years`
      break
  }

  // End clause
  if (config.endType === "count" && config.count != null) {
    base += `, ${config.count} time${config.count === 1 ? "" : "s"}`
  } else if (config.endType === "until" && config.until != null) {
    base += `, until ${format(config.until, "MMM d, yyyy")}`
  }

  return base
}

// -----------------------------------------------------------------------
// configFromRRule — reverse-parse stored string back to RecurrenceConfig
// -----------------------------------------------------------------------
export function configFromRRule(
  rruleString: string,
  dtstart: Date
): RecurrenceConfig {
  const rule = parseRRule(rruleString, dtstart)
  const opts = rule.options

  const freq: RecurrenceFreq = FREQ_REVERSE[opts.freq] ?? "WEEKLY"
  const interval = opts.interval ?? 1

  const config: RecurrenceConfig = {
    freq,
    interval,
    endType: "never",
  }

  if (opts.count != null) {
    config.endType = "count"
    config.count = opts.count
  } else if (opts.until != null) {
    config.endType = "until"
    config.until = opts.until
  }

  if (freq === "WEEKLY" && opts.byweekday?.length) {
    // rrule stores simple weekly weekdays as plain numbers (0=MO … 6=SU)
    config.byweekday = (opts.byweekday as number[])
  }

  if (freq === "MONTHLY") {
    if (opts.bymonthday?.length) {
      config.monthlyMode = "by_day"
      config.bymonthday = opts.bymonthday[0]
    } else if ((opts as unknown as Record<string, unknown>).bynweekday) {
      // Monthly nth-weekday is stored in bynweekday as [[weekday, n], ...]
      const bynw = (opts as unknown as Record<string, unknown>).bynweekday as [number, number][]
      if (bynw?.length) {
        const [weekday, n] = bynw[0]
        config.monthlyMode = "by_weekday"
        config.monthlyWeekday = weekday
        config.bysetpos = n
      }
    }
  }

  return config
}

// -----------------------------------------------------------------------
// defaultRecurrenceConfig — sensible default when toggling repeat on
// -----------------------------------------------------------------------
export function defaultRecurrenceConfig(dtstart: Date): RecurrenceConfig {
  // Weekly on dtstart's weekday (JS: 0=Sun … 6=Sat; rrule: 0=MO … 6=SU)
  const jsDay = dtstart.getDay() // 0=Sun
  const rruleDay = jsDay === 0 ? 6 : jsDay - 1 // convert to MO=0…SU=6
  return {
    freq: "WEEKLY",
    interval: 1,
    byweekday: [rruleDay],
    endType: "never",
  }
}
