/**
 * Manual verification of recurrence helpers.
 * Run: npx tsx scripts/test-recurrence.ts
 */
import {
  buildRRule,
  rruleToString,
  parseRRule,
  getOccurrencesBetween,
  getAllOccurrencesCount,
  configFromRRule,
  type RecurrenceConfig,
} from "../src/lib/recurrence"

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function header(n: number, title: string) {
  console.log(`\n${"─".repeat(60)}`)
  console.log(`Scenario ${n}: ${title}`)
  console.log("─".repeat(60))
}

// ─────────────────────────────────────────────────────────────
// 1. Daily, 5 occurrences starting Jan 1 2026
// ─────────────────────────────────────────────────────────────
header(1, "Daily, 5 occurrences from Jan 1 2026")
{
  const dtstart = new Date("2026-01-01T00:00:00Z")
  const config: RecurrenceConfig = {
    freq: "DAILY",
    interval: 1,
    endType: "count",
    count: 5,
  }
  const rule = buildRRule(config, dtstart)
  const dates = rule.all().map(fmt)
  console.log("Got:     ", dates)
  console.log("Expected: ['2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05']")
  console.log("Pass?", JSON.stringify(dates) === JSON.stringify(["2026-01-01","2026-01-02","2026-01-03","2026-01-04","2026-01-05"]))
}

// ─────────────────────────────────────────────────────────────
// 2. Weekly Mon+Wed+Fri, Jan 5 2026, no end — occurrences in Jan
// ─────────────────────────────────────────────────────────────
header(2, "Weekly Mon+Wed+Fri from Jan 5 2026, occurrences in Jan")
{
  const dtstart = new Date("2026-01-05T00:00:00Z") // Monday
  const config: RecurrenceConfig = {
    freq: "WEEKLY",
    interval: 1,
    byweekday: [0, 2, 4], // MO=0, WE=2, FR=4
    endType: "never",
  }
  const rule = buildRRule(config, dtstart)
  const rruleStr = rruleToString(rule)
  console.log("RRULE:   ", rruleStr)

  const rangeStart = new Date("2026-01-01T00:00:00Z")
  const rangeEnd   = new Date("2026-02-01T00:00:00Z")
  const dates = getOccurrencesBetween(rruleStr, dtstart, rangeStart, rangeEnd)
  console.log("Got:     ", dates.map(fmt))
  console.log("Expected: ['2026-01-05','2026-01-07','2026-01-09','2026-01-12','2026-01-14','2026-01-16','2026-01-19','2026-01-21','2026-01-23','2026-01-26','2026-01-28','2026-01-30']")
}

// ─────────────────────────────────────────────────────────────
// 3. Monthly by_day (15th), Jan 15 2026, until Dec 31 2026
// ─────────────────────────────────────────────────────────────
header(3, "Monthly on 15th from Jan 15 2026, until Dec 31 2026")
{
  const dtstart = new Date("2026-01-15T00:00:00Z")
  const config: RecurrenceConfig = {
    freq: "MONTHLY",
    interval: 1,
    monthlyMode: "by_day",
    bymonthday: 15,
    endType: "until",
    until: new Date("2026-12-31T00:00:00Z"),
  }
  const rule = buildRRule(config, dtstart)
  const dates = rule.all().map(fmt)
  console.log("Got:     ", dates)
  console.log("Expected: 12 dates (Jan 15 – Dec 15)")
  console.log("Count:", dates.length, "| Pass?", dates.length === 12)
}

// ─────────────────────────────────────────────────────────────
// 4. Monthly 2nd Tuesday from Jan 13 2026, next 6 occurrences
// ─────────────────────────────────────────────────────────────
header(4, "Monthly 2nd Tuesday from Jan 13 2026, next 6")
{
  const dtstart = new Date("2026-01-13T00:00:00Z") // 2nd Tue of Jan 2026
  const config: RecurrenceConfig = {
    freq: "MONTHLY",
    interval: 1,
    monthlyMode: "by_weekday",
    bysetpos: 2,
    monthlyWeekday: 1, // TU=1
    endType: "count",
    count: 6,
  }
  const rule = buildRRule(config, dtstart)
  const dates = rule.all().map(fmt)
  console.log("Got:     ", dates)
  console.log("Expected: ['2026-01-13','2026-02-10','2026-03-10','2026-04-14','2026-05-12','2026-06-09']")
  console.log("Pass?", JSON.stringify(dates) === JSON.stringify(["2026-01-13","2026-02-10","2026-03-10","2026-04-14","2026-05-12","2026-06-09"]))
}

// ─────────────────────────────────────────────────────────────
// 5. Round-trip: build → toString → fromString → same occurrences
// ─────────────────────────────────────────────────────────────
header(5, "Round-trip: build → toString → fromString → same occurrences")
{
  const dtstart = new Date("2026-03-01T00:00:00Z")
  const config: RecurrenceConfig = {
    freq: "WEEKLY",
    interval: 2,
    byweekday: [0, 3], // MO, TH
    endType: "count",
    count: 8,
  }
  const rule1 = buildRRule(config, dtstart)
  const rruleStr = rruleToString(rule1)
  console.log("Stored RRULE:", rruleStr)

  const rule2 = parseRRule(rruleStr, dtstart)
  const dates1 = rule1.all().map(fmt)
  const dates2 = rule2.all().map(fmt)
  console.log("Original:  ", dates1)
  console.log("Round-trip:", dates2)
  console.log("Pass?", JSON.stringify(dates1) === JSON.stringify(dates2))

  // Also verify configFromRRule
  const parsedConfig = configFromRRule(rruleStr, dtstart)
  console.log("Parsed config:", JSON.stringify(parsedConfig, null, 2))
}

// ─────────────────────────────────────────────────────────────
// 6. Exception test: weekly Monday Jan 5 2026, cancel Jan 12
// ─────────────────────────────────────────────────────────────
header(6, "Weekly Monday, cancel Jan 12 → expect Jan 5, 19, 26")
{
  const dtstart = new Date("2026-01-05T00:00:00Z")
  const config: RecurrenceConfig = {
    freq: "WEEKLY",
    interval: 1,
    byweekday: [0], // MO
    endType: "never",
  }
  const rule = buildRRule(config, dtstart)
  const rruleStr = rruleToString(rule)

  const rangeStart = new Date("2026-01-01T00:00:00Z")
  const rangeEnd   = new Date("2026-02-01T00:00:00Z")

  const exceptions = [
    {
      original_occurrence_date: new Date("2026-01-12T00:00:00Z"),
      action: "cancelled" as const,
    },
  ]

  const dates = getOccurrencesBetween(rruleStr, dtstart, rangeStart, rangeEnd, exceptions)
  console.log("Got:     ", dates.map(fmt))
  console.log("Expected: ['2026-01-05','2026-01-19','2026-01-26']")
  console.log("Pass?", JSON.stringify(dates.map(fmt)) === JSON.stringify(["2026-01-05","2026-01-19","2026-01-26"]))
}

console.log("\n" + "═".repeat(60))
console.log("All scenarios complete.")
