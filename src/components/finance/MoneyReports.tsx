"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/layout/PageHeader"
import { BusinessPnLReport } from "./BusinessPnLReport"
import { IncomeReview } from "./IncomeReview"

type Mode = "pnl" | "income"

const MODES: { key: Mode; label: string }[] = [
  { key: "pnl", label: "P&L" },
  { key: "income", label: "Income" },
]

export function MoneyReports() {
  const [mode, setMode] = useState<Mode>("pnl")

  const modeSwitch = (
    <div className="px-4 py-3 flex gap-2">
      <div className="flex rounded-lg border border-border overflow-hidden flex-1">
        {MODES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium transition-colors",
              mode === key
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Reports" backHref="/money" below={modeSwitch} />
      {mode === "pnl" ? <BusinessPnLReport /> : <IncomeReview />}
    </div>
  )
}
