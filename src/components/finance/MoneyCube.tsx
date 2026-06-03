"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MoneyCubeProps {
  label: string
  value?: ReactNode
  sublabel?: string
  colorDot?: string
  onClick?: () => void
  className?: string
}

export function MoneyCube({ label, value, sublabel, colorDot, onClick, className }: MoneyCubeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col justify-between rounded-xl bg-muted/60 p-3 text-left transition-colors active:bg-muted hover:bg-muted/80 min-h-[5rem]",
        className
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {colorDot && (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorDot }} />
        )}
        <span className="text-xs text-muted-foreground truncate min-w-0">{label}</span>
      </div>
      {(value !== undefined || sublabel) && (
        <div className="mt-2">
          {value !== undefined && (
            <div className="font-semibold tabular-nums truncate">{value}</div>
          )}
          {sublabel && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{sublabel}</div>
          )}
        </div>
      )}
    </button>
  )
}
