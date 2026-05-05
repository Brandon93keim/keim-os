"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type RecurringScope = "single" | "following" | "all"

export interface RecurringEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "edit" | "delete"
  occurrenceCount: { total: number; pastCount: number }
  onChoose: (scope: RecurringScope) => void
}

interface Option {
  value: RecurringScope
  label: string
  subtitle: (mode: "edit" | "delete", counts: { total: number; pastCount: number }) => string
  muted?: boolean
}

const OPTIONS: Option[] = [
  {
    value: "single",
    label: "This event only",
    subtitle: (mode) =>
      `Only this occurrence will be ${mode === "delete" ? "deleted" : "edited"}.`,
  },
  {
    value: "following",
    label: "This and following events",
    subtitle: (mode) =>
      `This occurrence and all future ones will be ${mode === "delete" ? "deleted" : "edited"}.`,
  },
  {
    value: "all",
    label: "All events",
    subtitle: (mode, { total, pastCount }) =>
      mode === "delete"
        ? `The entire series (${total} occurrence${total === 1 ? "" : "s"}, including ${pastCount} in the past) will be deleted.`
        : `Every occurrence will be edited, including ${pastCount} in the past.`,
    muted: true,
  },
]

export function RecurringEditDialog({
  open,
  onOpenChange,
  mode,
  occurrenceCount,
  onChoose,
}: RecurringEditDialogProps) {
  const [selected, setSelected] = useState<RecurringScope>("single")

  // Reset to safest option when dialog opens.
  // We use an uncontrolled-reset pattern via key, but here we just track selected.
  const allSelected = selected === "all"

  const actionLabel = mode === "delete" ? "Delete" : "Continue"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>
            {mode === "delete" ? "Delete recurring event" : "Edit recurring event"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-2 space-y-1">
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.value
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors",
                  isSelected ? "bg-muted" : "hover:bg-muted/50",
                  opt.muted && "opacity-70"
                )}
              >
                <input
                  type="radio"
                  name="recurringScope"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => setSelected(opt.value)}
                  className="mt-0.5 accent-primary shrink-0"
                />
                <div className="space-y-0.5 min-w-0">
                  <div className={cn("text-sm font-medium", opt.muted && "text-muted-foreground")}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-muted-foreground leading-snug">
                    {opt.subtitle(mode, occurrenceCount)}
                  </div>
                  {opt.value === "all" && isSelected && (
                    <div className="text-xs text-destructive font-medium pt-0.5">
                      This affects past occurrences and cannot be undone.
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        <DialogFooter className="px-4 py-3 border-t border-border bg-transparent mt-2 rounded-b-xl">
          <Button
            variant="outline"
            onClick={() => {
              setSelected("single")
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button
            variant={mode === "delete" && allSelected ? "destructive" : mode === "delete" ? "outline" : "default"}
            className={cn(
              mode === "delete" && !allSelected && "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            )}
            onClick={() => {
              const scope = selected
              setSelected("single")
              onChoose(scope)
            }}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
