"use client"

import { useState, useMemo, useEffect } from "react"
import { format, addYears } from "date-fns"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import {
  type RecurrenceConfig,
  type RecurrenceFreq,
  buildRRule,
  defaultRecurrenceConfig,
} from "@/lib/recurrence"

export interface RecurrencePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: RecurrenceConfig | null
  onChange: (config: RecurrenceConfig | null) => void
  dtstart: Date
}

type FrequencyOption = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom"

// Display order: Sun-first to match calendar grid.
// rruleDay uses rrule numbering: 0=Mon…6=Sun.
const WEEKDAY_DISPLAY = [
  { label: "S", rruleDay: 6 }, // Sunday
  { label: "M", rruleDay: 0 }, // Monday
  { label: "T", rruleDay: 1 }, // Tuesday
  { label: "W", rruleDay: 2 }, // Wednesday
  { label: "T", rruleDay: 3 }, // Thursday
  { label: "F", rruleDay: 4 }, // Friday
  { label: "S", rruleDay: 5 }, // Saturday
] as const

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const ORDINAL_NAMES = ["", "first", "second", "third", "fourth"]

function jsToRruleDay(jsDay: number): number {
  return (jsDay + 6) % 7
}

function freqToUnit(freq: RecurrenceFreq): string {
  switch (freq) {
    case "DAILY": return "day"
    case "WEEKLY": return "week"
    case "MONTHLY": return "month"
    case "YEARLY": return "year"
  }
}

function unitToFreq(unit: string): RecurrenceFreq {
  switch (unit) {
    case "day": return "DAILY"
    case "week": return "WEEKLY"
    case "month": return "MONTHLY"
    case "year": return "YEARLY"
    default: return "WEEKLY"
  }
}

function detectFreqOption(config: RecurrenceConfig | null, dtstart: Date): FrequencyOption {
  if (!config) return "none"
  const rruleDay = jsToRruleDay(dtstart.getDay())
  if (config.interval === 1 && config.endType === "never") {
    if (config.freq === "DAILY") return "daily"
    if (
      config.freq === "WEEKLY" &&
      config.byweekday?.length === 1 &&
      config.byweekday[0] === rruleDay
    ) return "weekly"
    if (
      config.freq === "MONTHLY" &&
      config.monthlyMode === "by_day" &&
      config.bymonthday === dtstart.getDate()
    ) return "monthly"
    if (config.freq === "YEARLY") return "yearly"
  }
  return "custom"
}

export function RecurrencePicker({
  open,
  onOpenChange,
  value,
  onChange,
  dtstart,
}: RecurrencePickerProps) {
  const rruleDay = jsToRruleDay(dtstart.getDay())
  const dayOfMonth = dtstart.getDate()
  const jsDay = dtstart.getDay()
  const nth = Math.min(Math.ceil(dayOfMonth / 7), 4)
  const dayName = DAY_NAMES[jsDay]!
  const ordinalName = ORDINAL_NAMES[nth]!
  const showLastOption = dayOfMonth > 21

  const [freqOption, setFreqOption] = useState<FrequencyOption>(() =>
    detectFreqOption(value, dtstart)
  )
  const [config, setConfig] = useState<RecurrenceConfig>(
    () => value ?? defaultRecurrenceConfig(dtstart)
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [untilOpen, setUntilOpen] = useState(false)

  useEffect(() => {
    if (open) {
      const detected = detectFreqOption(value, dtstart)
      setFreqOption(detected)
      setConfig(value ?? defaultRecurrenceConfig(dtstart))
      setShowAdvanced(detected === "custom")
      setUntilOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const previewDates = useMemo(() => {
    if (freqOption === "none") return []
    try {
      const rule = buildRRule(config, dtstart)
      return rule.all((_, i) => i < 5)
    } catch {
      return []
    }
  }, [config, dtstart, freqOption])

  function handleFreqOptionChange(option: FrequencyOption) {
    setFreqOption(option)
    if (option === "none") {
      onChange(null)
      onOpenChange(false)
      return
    }
    if (option === "daily") {
      setConfig({ freq: "DAILY", interval: 1, endType: "never" })
      setShowAdvanced(false)
    } else if (option === "weekly") {
      setConfig({ freq: "WEEKLY", interval: 1, byweekday: [rruleDay], endType: "never" })
      setShowAdvanced(false)
    } else if (option === "monthly") {
      setConfig({
        freq: "MONTHLY",
        interval: 1,
        monthlyMode: "by_day",
        bymonthday: dayOfMonth,
        endType: "never",
      })
      setShowAdvanced(false)
    } else if (option === "yearly") {
      setConfig({ freq: "YEARLY", interval: 1, endType: "never" })
      setShowAdvanced(false)
    } else if (option === "custom") {
      setShowAdvanced(true)
    }
  }

  function handleUnitChange(unit: string) {
    const newFreq = unitToFreq(unit)
    const base: RecurrenceConfig = {
      freq: newFreq,
      interval: config.interval,
      endType: config.endType,
      count: config.count,
      until: config.until,
    }
    if (newFreq === "WEEKLY") {
      base.byweekday = [rruleDay]
    } else if (newFreq === "MONTHLY") {
      base.monthlyMode = "by_day"
      base.bymonthday = dayOfMonth
    }
    setConfig(base)
  }

  function toggleWeekday(rd: number) {
    const current = config.byweekday ?? [rruleDay]
    const has = current.includes(rd)
    const next = has ? current.filter((d) => d !== rd) : [...current, rd]
    setConfig({ ...config, byweekday: next.length === 0 ? [rruleDay] : next })
  }

  function handleMonthlyModeChange(mode: "by_day" | "by_weekday_nth" | "by_weekday_last") {
    if (mode === "by_day") {
      const c = { ...config }
      c.monthlyMode = "by_day"
      c.bymonthday = dayOfMonth
      delete c.bysetpos
      delete c.monthlyWeekday
      setConfig(c)
    } else if (mode === "by_weekday_nth") {
      const c = { ...config }
      c.monthlyMode = "by_weekday"
      c.bysetpos = nth
      c.monthlyWeekday = rruleDay
      delete c.bymonthday
      setConfig(c)
    } else {
      const c = { ...config }
      c.monthlyMode = "by_weekday"
      c.bysetpos = -1
      c.monthlyWeekday = rruleDay
      delete c.bymonthday
      setConfig(c)
    }
  }

  function handleEndTypeChange(endType: "never" | "count" | "until") {
    if (endType === "never") {
      const c = { ...config }
      c.endType = "never"
      delete c.count
      delete c.until
      setConfig(c)
    } else if (endType === "count") {
      const c = { ...config }
      c.endType = "count"
      c.count = config.count ?? 10
      delete c.until
      setConfig(c)
    } else {
      const c = { ...config }
      c.endType = "until"
      c.until = config.until ?? addYears(dtstart, 1)
      delete c.count
      setConfig(c)
    }
  }

  const isActive = freqOption !== "none"

  const currentMonthlyMode =
    config.monthlyMode === "by_weekday" && config.bysetpos === -1
      ? "by_weekday_last"
      : config.monthlyMode === "by_weekday"
        ? "by_weekday_nth"
        : "by_day"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[90vh] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-2 shrink-0">
          <SheetTitle>Repeat</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
          {/* Frequency */}
          <div className="space-y-1.5">
            <Select
              value={freqOption}
              onValueChange={(v) => handleFreqOptionChange(v as FrequencyOption)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
            {isActive && !showAdvanced && (
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 underline"
                onClick={() => setShowAdvanced(true)}
              >
                Show options
              </button>
            )}
          </div>

          {/* Advanced controls */}
          {isActive && showAdvanced && (
            <>
              {/* Interval row */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Repeat every</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-border rounded-md overflow-hidden">
                    <button
                      type="button"
                      className="h-10 w-10 flex items-center justify-center text-lg shrink-0 hover:bg-muted transition-colors"
                      onClick={() =>
                        setConfig({ ...config, interval: Math.max(1, config.interval - 1) })
                      }
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={config.interval}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v) && v >= 1 && v <= 99)
                          setConfig({ ...config, interval: v })
                      }}
                      className="w-12 text-center rounded-none border-x border-border border-y-0 h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      className="h-10 w-10 flex items-center justify-center text-lg shrink-0 hover:bg-muted transition-colors"
                      onClick={() =>
                        setConfig({ ...config, interval: Math.min(99, config.interval + 1) })
                      }
                    >
                      +
                    </button>
                  </div>
                  <Select value={freqToUnit(config.freq)} onValueChange={handleUnitChange}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">day(s)</SelectItem>
                      <SelectItem value="week">week(s)</SelectItem>
                      <SelectItem value="month">month(s)</SelectItem>
                      <SelectItem value="year">year(s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Weekly weekday toggles */}
              {config.freq === "WEEKLY" && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">On</p>
                  <div className="flex gap-1">
                    {WEEKDAY_DISPLAY.map(({ label, rruleDay: rd }, i) => {
                      const selected = (config.byweekday ?? []).includes(rd)
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleWeekday(rd)}
                          className={cn(
                            "flex-1 h-9 rounded-md text-xs font-medium transition-colors",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "border border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Monthly mode */}
              {config.freq === "MONTHLY" && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Repeat on</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="monthlyMode"
                      checked={currentMonthlyMode === "by_day"}
                      onChange={() => handleMonthlyModeChange("by_day")}
                      className="accent-primary"
                    />
                    <span className="text-sm">On day {dayOfMonth}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="monthlyMode"
                      checked={currentMonthlyMode === "by_weekday_nth"}
                      onChange={() => handleMonthlyModeChange("by_weekday_nth")}
                      className="accent-primary"
                    />
                    <span className="text-sm">
                      On the {ordinalName} {dayName}
                    </span>
                  </label>
                  {showLastOption && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="monthlyMode"
                        checked={currentMonthlyMode === "by_weekday_last"}
                        onChange={() => handleMonthlyModeChange("by_weekday_last")}
                        className="accent-primary"
                      />
                      <span className="text-sm">On the last {dayName}</span>
                    </label>
                  )}
                </div>
              )}

              {/* Yearly: static info */}
              {config.freq === "YEARLY" && (
                <p className="text-sm text-muted-foreground">
                  On {format(dtstart, "MMMM d")}
                </p>
              )}
            </>
          )}

          {/* Ends */}
          {isActive && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Ends</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={config.endType === "never"}
                  onChange={() => handleEndTypeChange("never")}
                  className="accent-primary"
                />
                <span className="text-sm">Never</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={config.endType === "count"}
                  onChange={() => handleEndTypeChange("count")}
                  className="accent-primary"
                />
                <div className="flex items-center gap-2 text-sm">
                  <span>After</span>
                  <div className="flex items-center border border-border rounded-md overflow-hidden">
                    <button
                      type="button"
                      className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors"
                      onClick={() =>
                        setConfig({
                          ...config,
                          endType: "count",
                          count: Math.max(1, (config.count ?? 10) - 1),
                        })
                      }
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      value={config.count ?? 10}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v) && v >= 1)
                          setConfig({ ...config, endType: "count", count: v })
                      }}
                      className="w-12 text-center rounded-none border-x border-border border-y-0 h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors"
                      onClick={() =>
                        setConfig({
                          ...config,
                          endType: "count",
                          count: Math.min(999, (config.count ?? 10) + 1),
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                  <span>occurrences</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={config.endType === "until"}
                  onChange={() => handleEndTypeChange("until")}
                  className="accent-primary"
                />
                <div className="flex items-center gap-2 text-sm">
                  <span>On</span>
                  <Popover open={untilOpen} onOpenChange={setUntilOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 font-normal">
                        {format(config.until ?? addYears(dtstart, 1), "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={config.until ?? addYears(dtstart, 1)}
                        onSelect={(date) => {
                          if (!date) return
                          setConfig({ ...config, endType: "until", until: date })
                          setUntilOpen(false)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </label>
            </div>
          )}

          {/* Preview */}
          {isActive && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Next 5 occurrences</p>
              {previewDates.length > 0 ? (
                <ul className="space-y-1">
                  {previewDates.map((d, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {format(d, "EEE, MMM d, yyyy")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No occurrences match this rule
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="shrink-0 border-t border-border px-4 py-4 flex gap-3"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 h-11"
            onClick={() => {
              onChange(freqOption === "none" ? null : config)
              onOpenChange(false)
            }}
          >
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
